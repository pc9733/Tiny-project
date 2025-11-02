// Simple data layer using localStorage
const App = (() => {
  const KEY = "companies_v1";
  const $ = (s) => document.querySelector(s);

  const state = { rows: [], mode: "all", location: "" };

  function uid(){ return Math.random().toString(36).slice(2,10); }
  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) {               // seed first run
      const demo = [
        { id: uid(), company: "Adobe",        location: "Noida",    url: "https://careers.adobe.com/us/en" },
        { id: uid(), company: "Airtel",       location: "Gurugram", url: "https://airtel.darwinbox.in/ms/candidate/careers" },
        { id: uid(), company: "Algoworks",    location: "Noida",    url: "https://www.algoworks.com/careers/" },
        { id: uid(), company: "RemoteFirst",  location: "Remote",   url: "https://remoteok.com/remote-companies" }
      ];
      save(demo); return demo;
    }
    try { return JSON.parse(raw); } catch { return []; }
  }
  function save(rows){ localStorage.setItem(KEY, JSON.stringify(rows)); }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeAttr(s){ return String(s).replace(/"/g,"&quot;"); }

  function render(filter="") {
    const tbody = $("#tbody");
    const q = filter.trim().toLowerCase();

    // filter base dataset by page mode
    let rows = [...state.rows];
    if (state.mode === "filtered" && state.location) {
      const target = state.location.toLowerCase();
      rows = rows.filter(r => String(r.location).toLowerCase() === target);
    }

    // apply search
    const filtered = rows.filter(r =>
      !q ||
      r.company.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q) ||
      r.url.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td class="empty" colspan="4">No companies. Click “Add Company”.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => `
      <tr data-id="${r.id}">
        <td>${escapeHtml(r.company)}</td>
        <td><span class="tag">${escapeHtml(r.location)}</span></td>
        <td><a class="url" href="${escapeAttr(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.url)}</a></td>
        <td class="actions">
          <button class="btn" data-open="${r.id}">Open</button>
          <button class="btn" data-edit="${r.id}">Edit</button>
          <button class="btn danger" data-del="${r.id}">Delete</button>
        </td>
      </tr>
    `).join("");
  }

  function openModal(mode, row=null){
    $("#modalTitle").textContent = (mode === "edit") ? "Edit Company" : "Add Company";
    $("#fId").value = row?.id || "";
    $("#fCompany").value = row?.company || "";
    $("#fLocation").value = row?.location || "";
    $("#fUrl").value = row?.url || "";
    $("#modal").showModal();
    setTimeout(()=>$("#fCompany").focus(), 50);
  }

  function addOrUpdate(e){
    e.preventDefault();
    const id = $("#fId").value || uid();
    const row = {
      id,
      company: $("#fCompany").value.trim(),
      location: $("#fLocation").value,
      url: $("#fUrl").value.trim()
    };
    if (!row.company || !row.location || !row.url) return;

    const data = [...state.rows];
    const idx = data.findIndex(x => x.id === id);
    if (idx >= 0) data[idx] = row; else data.unshift(row);
    state.rows = data; save(state.rows);
    $("#modal").close();
    render($("#search")?.value || "");
  }

  function remove(id){
    if (!confirm("Delete this company?")) return;
    state.rows = state.rows.filter(x => x.id !== id);
    save(state.rows);
    render($("#search")?.value || "");
  }

  // import/export
  function exportJSON(){
    const blob = new Blob([JSON.stringify(state.rows, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "companies.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importJSON(file){
    const text = await file.text();
    const json = JSON.parse(text);
    if (!Array.isArray(json)) throw new Error("Invalid JSON");
    const cleaned = json.map(x => ({
      id: x.id || uid(),
      company: x.company || x.Company || "",
      location: x.location || x.Location || "",
      url: x.url || x["Careers URL"] || x.careers || ""
    })).filter(x => x.company && x.url &&
      ["gurgaon","gurugram","noida","remote"].includes(String(x.location).toLowerCase())
    );
    state.rows = cleaned; save(state.rows);
    render($("#search")?.value || "");
  }

  // Public mount
  function mount({mode="all", location=""}={}){
    state.mode = mode; state.location = location;
    state.rows = load();

    // events
    $("#addBtn")?.addEventListener("click", () => openModal("add"));
    $("#saveBtn")?.addEventListener("click", addOrUpdate);
    $("#search")?.addEventListener("input", (e) => render(e.target.value));
    $("#exportBtn")?.addEventListener("click", exportJSON);
    $("#importFile")?.addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { await importJSON(f); } catch(err){ alert("Import failed: " + err.message); }
      finally { e.target.value = ""; }
    });
    $("#tbody")?.addEventListener("click", (e) => {
      const openId = e.target.getAttribute("data-open");
      const editId = e.target.getAttribute("data-edit");
      const delId  = e.target.getAttribute("data-del");
      if (openId){
        const row = state.rows.find(x => x.id === openId);
        if (row?.url) window.open(row.url, "_blank", "noopener");
      }
      if (editId){
        const row = state.rows.find(x => x.id === editId);
        openModal("edit", row);
      }
      if (delId){ remove(delId); }
    });

    render();
  }

  return { mount };
})();
