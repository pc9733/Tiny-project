// API-backed data layer (Flask + DynamoDB via /api/*)
const App = (() => {
  const $ = (s) => document.querySelector(s);

  const state = {
    rows: [],
    mode: "all",        // "all" | "filtered"
    location: "",       // when mode === "filtered"
    loading: false,
  };

  const VALID_LOCS = ["gurgaon","gurugram","noida","remote"];

  // ---------- Utilities ----------
  const uid = () => Math.random().toString(36).slice(2, 10);

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const escapeAttr = (s) => String(s).replace(/"/g, "&quot;");

  function normalizeLoc(x){
    const s = String(x||"").trim();
    const low = s.toLowerCase();
    if (low.includes("gurugram") || low.includes("gurgaon")) return "Gurugram";
    if (low.includes("gurugram and Noida") || low.includes("gurgaon and noida")) return "Gurugram & Noida";
    if (low.includes("noida")) return "Noida";
    if (low.includes("remote") || low.includes("wfh")) return "Remote";
    return s || "Gurugram";
  }

  function setLoading(on){
    state.loading = !!on;
    const tbody = $("#tbody");
    if (on && tbody){
      tbody.innerHTML = `<tr><td class="empty" colspan="4">Loading…</td></tr>`;
    }
  }

  // ---------- API helpers ----------
  async function apiList(location) {
    const url = location ? `/api/companies?location=${encodeURIComponent(location)}` : `/api/companies`;
    const r = await fetch(url, { headers: { "Accept": "application/json" }});
    if (!r.ok) throw new Error(`List failed: ${r.status}`);
    return await r.json();
  }

  async function apiCreate(row) {
    const r = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(`Create failed: ${r.status}`);
    return await r.json();
  }

  async function apiUpdate(id, patch) {
    const r = await fetch(`/api/companies/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`Update failed: ${r.status}`);
    return await r.json();
  }

  async function apiDelete(id) {
    const r = await fetch(`/api/companies/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`Delete failed: ${r.status}`);
  }

  // ---------- Render ----------
  function render(filter = "") {
    const tbody = $("#tbody");
    const q = (filter || "").trim().toLowerCase();

    let rows = [...state.rows];

    if (state.mode === "filtered" && state.location) {
      const target = state.location.toLowerCase();
      rows = rows.filter((r) => String(r.location || "").toLowerCase() === target);
    }

    const filtered = rows.filter(
      (r) =>
        !q ||
        (r.company || "").toLowerCase().includes(q) ||
        (r.location || "").toLowerCase().includes(q) ||
        (r.url || "").toLowerCase().includes(q)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td class="empty" colspan="4">No companies. Use “Add” or “Import”.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (r) => `
      <tr data-id="${r.id}">
        <td>${escapeHtml(r.company || "")}</td>
        <td><span class="tag">${escapeHtml(r.location || "")}</span></td>
        <td><a class="url" href="${escapeAttr(r.url || "")}" target="_blank" rel="noopener">${escapeHtml(r.url || "")}</a></td>
        <td class="actions">
          <button class="btn" data-open="${r.id}">Open</button>
          <button class="btn" data-edit="${r.id}">Edit</button>
          <button class="btn danger" data-del="${r.id}">Delete</button>
        </td>
      </tr>
    `
      )
      .join("");
  }

  // ---------- UI handlers ----------
  function openModal(mode, row = null) {
    $("#modalTitle").textContent = mode === "edit" ? "Edit Company" : "Add Company";
    $("#fId").value = row?.id || "";
    $("#fCompany").value = row?.company || "";
    $("#fLocation").value = row?.location || "";
    $("#fUrl").value = row?.url || "";
    $("#modal").showModal();
    setTimeout(() => $("#fCompany").focus(), 50);
  }

  async function addOrUpdate(e) {
    e.preventDefault();
    const id = $("#fId").value || uid();
    const row = {
      id,
      company: $("#fCompany").value.trim(),
      location: $("#fLocation").value,
      url: $("#fUrl").value.trim(),
    };
    if (!row.company || !row.location || !row.url) return;

    setLoading(true);
    try {
      const exists = state.rows.find((x) => x.id === id);
      if (exists) {
        await apiUpdate(id, { company: row.company, location: row.location, url: row.url });
      } else {
        await apiCreate(row);
      }
      await refresh(); // re-fetch from API to stay consistent
      $("#modal").close();
      render($("#search")?.value || "");
    } catch (err) {
      alert(err.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this company?")) return;
    setLoading(true);
    try {
      await apiDelete(id);
      await refresh();
      render($("#search")?.value || "");
    } catch (err) {
      alert(err.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  function pick(obj, keys){
    for (const k of keys) {
      const found = Object.keys(obj).find(h => h.toLowerCase().replace(/\s+/g,'').includes(k));
      if (found) return String(obj[found]).trim();
    }
    return "";
  }

  // ---------- Import/Export ----------
  function exportJSON() {
    const blob = new Blob([JSON.stringify(state.rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "companies.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJSON(file) {
    const text = await file.text();
    const json = JSON.parse(text);
    if (!Array.isArray(json)) throw new Error("Invalid JSON (need an array)");
    // normalize & filter
    const cleaned = json
      .map((x) => ({
        id: x.id || uid(),
        company: x.company || x.Company || "",
        location: normalizeLoc(x.location || x.Location || ""),
        url: x.url || x["Careers URL"] || x.careers || "",
      }))
      .filter((x) => x.company && x.url && VALID_LOCS.includes(String(x.location).toLowerCase()));
    await bulkUpsert(cleaned);
  }

  async function importExcel(file) {
    // Requires: <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const mapped = rows
      .map((r) => {
        const company = pick(r, ["company", "organisation", "organization", "employer", "name"]);
        const location = normalizeLoc(pick(r, ["location", "city", "region", "area"]));
        const url = pick(r, ["careersurl", "career", "careers", "jobs", "jobpage", "url", "website"]);
        return { id: uid(), company, location, url };
      })
      .filter((x) => x.company && x.url && VALID_LOCS.includes(x.location.toLowerCase()));

    if (!mapped.length) {
      alert("No valid rows found (need Company, Location, Careers URL; locations must be Gurgaon/Gurugram/Noida/Remote).");
      return;
    }
    await bulkUpsert(mapped);
  }

  async function bulkUpsert(items) {
    setLoading(true);
    try {
      // POST each item sequentially to keep it simple (could batch later)
      for (const it of items) {
        // de-dup by (company+url): if exists in state, update; else create
        const key = (x) => (x.company.toLowerCase() + "|" + x.url.toLowerCase());
        const existing = state.rows.find((r) => key(r) === key(it));
        if (existing) {
          await apiUpdate(existing.id, { company: it.company, location: it.location, url: it.url });
        } else {
          await apiCreate(it);
        }
      }
      await refresh();
      render($("#search")?.value || "");
    } catch (err) {
      alert(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Bulk UI actions ----------
  function openAllVisible() {
    const anchors = Array.from(document.querySelectorAll("#tbody a.url"));
    let count = 0;
    anchors.forEach((a) => {
      if (a && a.href) {
        window.open(a.href, "_blank", "noopener");
        count++;
      }
    });
    if (!count) alert("No visible rows to open.");
  }

  async function deleteAllVisible() {
    if (!confirm("Delete ALL visible rows?")) return;
    const ids = Array.from(document.querySelectorAll("#tbody tr[data-id]")).map((tr) => tr.getAttribute("data-id"));
    setLoading(true);
    try {
      for (const id of ids) {
        await apiDelete(id);
      }
      await refresh();
      render($("#search")?.value || "");
    } catch (err) {
      alert(err.message || "Bulk delete failed");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Data refresh ----------
  async function refresh() {
    const locForFetch =
      state.mode === "filtered" && state.location
        ? state.location
        : null;
    const items = await apiList(locForFetch);
    // Ensure shape + order (newest first by created_at if present)
    let rows = (items || []).map((x) => ({
      id: x.id,
      company: x.company,
      location: x.location,
      url: x.url,
      created_at: x.created_at || null,
    }));
    rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    state.rows = rows;
  }

  // ---------- Mount ----------
  async function mount({ mode = "all", location = "" } = {}) {
    state.mode = mode;
    state.location = location;

    // Wire events
    $("#addBtn")?.addEventListener("click", () => openModal("add"));
    $("#saveBtn")?.addEventListener("click", addOrUpdate);
    $("#search")?.addEventListener("input", (e) => render(e.target.value));
    $("#exportBtn")?.addEventListener("click", exportJSON);

    $("#importJsonFile")?.addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { await importJSON(f); } catch (err) { alert("Import failed: " + err.message); }
      finally { e.target.value = ""; }
    });

    $("#importExcelFile")?.addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { await importExcel(f); } catch (err) { alert("Excel import failed: " + err.message); }
      finally { e.target.value = ""; }
    });

    document.querySelector("#tbody")?.addEventListener("click", (e) => {
      const openId = e.target.getAttribute("data-open");
      const editId = e.target.getAttribute("data-edit");
      const delId  = e.target.getAttribute("data-del");
      if (openId) {
        const row = state.rows.find((x) => x.id === openId);
        if (row?.url) window.open(row.url, "_blank", "noopener");
      }
      if (editId) {
        const row = state.rows.find((x) => x.id === editId);
        openModal("edit", row);
      }
      if (delId) {
        remove(delId);
      }
    });

    // Initial load
    setLoading(true);
    try {
      await refresh();
      render();
    } catch (err) {
      // Helpful guidance if API/Nginx not ready
      const tbody = $("#tbody");
      if (tbody) {
        tbody.innerHTML = `<tr><td class="empty" colspan="4">
          API not reachable. Check:
          <ul style="margin:8px 0 0 16px; text-align:left">
            <li>Nginx proxy /api → 127.0.0.1:8000</li>
            <li>companies-api systemd service is running</li>
            <li>EC2 IAM role has DynamoDB access</li>
          </ul>
        </td></tr>`;
      }
    } finally {
      setLoading(false);
    }
  }

  return { mount };
})();
function closeAddModal() {
  // <dialog id="addDialog"> support
  const dlg = document.getElementById('addDialog');
  if (dlg) {
    if (typeof dlg.close === 'function') dlg.close();
    dlg.setAttribute('open', ''); // harmless if already closed
    dlg.removeAttribute('open');
  }
  // CSS modal fallback (e.g., class="hidden")
  const modal = document.getElementById('addModal');
  if (modal) modal.classList.add('hidden');
}

function resetAddForm() {
  const form = document.getElementById('companyForm');
  if (form) form.reset();
}

function onCancelAdd(e) {
  if (e) e.preventDefault();
  resetAddForm();
  closeAddModal();
}

document.getElementById('cancelBtn')?.addEventListener('click', onCancelAdd);