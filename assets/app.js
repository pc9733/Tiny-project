// ===== API CONFIG =====
// Adjust these if your routes differ.
const API_BASE = window.API_BASE || ""; // "" = same origin (e.g., reverse proxy or combined deploy)
const API = {
  LIST:   () => `${API_BASE}/api/roles`,          // GET
  CREATE: () => `${API_BASE}/api/roles`,          // POST
  UPDATE: (id) => `${API_BASE}/api/roles/${id}`,  // PUT
  DELETE: (id) => `${API_BASE}/api/roles/${id}`,  // DELETE
};

// ===== Gurgaon/Gurugram filter helpers =====
const CANON = { gurgaon: "gurgaon", gurugram: "gurgaon", noida: "noida", remote: "remote" };
function splitTerms(s = "") {
  return String(s).toLowerCase().replace(/&/g, " and ").split(/,|\/|;|\band\b/gi).map(t => t.trim()).filter(Boolean);
}
function canon(term) { return CANON[term] || term; }
function toCanonicalSet(s) {
  const terms = splitTerms(s); const set = new Set();
  for (const t of terms) { const c = canon(t); if (CANON[c] || Object.values(CANON).includes(c)) set.add(c); }
  return set;
}
function filterByLocation(rows = [], query = "") {
  const q = String(query || "").trim(); if (!q) return rows;
  const want = toCanonicalSet(q); if (want.size === 0) return rows;
  return rows.filter(r => { const item = toCanonicalSet(r?.location || ""); for (const w of want) if (item.has(w)) return true; return false; });
}

// ===== Utilities & DOM =====
const $ = (s) => document.querySelector(s);
const $rows = $("#rows"), $empty = $("#empty"), $input = $("#locationInput");
const $form = $("#form"), $id = $("#id"), $title = $("#title"), $company = $("#company"), $location = $("#location");
const $addBtn = $("#addBtn"), $saveBtn = $("#saveBtn"), $cancelBtn = $("#cancelBtn");
const $status = $("#status"), $error = $("#error");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function setStatus(msg){ $status.textContent = msg||""; }
function setError(msg){ $error.textContent = msg||""; }

// ===== State =====
const state = { all: [], query: "", editingId: null };

// ===== Rendering =====
function visibleRows(){ return filterByLocation(state.all, state.query); }
function render(){
  const list = visibleRows();
  if (!list.length) { $rows.innerHTML = ""; $empty.style.display = "block"; }
  else {
    $empty.style.display = "none";
    $rows.innerHTML = list.map((r)=>`
      <tr data-id="${escapeHtml(r.id || "")}">
        <td>${escapeHtml(r.title || "")}</td>
        <td>${escapeHtml(r.company || "")}</td>
        <td><span class="pill">${escapeHtml(r.location || "")}</span></td>
        <td>
          <button data-act="edit">Edit</button>
          <button data-act="del">Delete</button>
        </td>
      </tr>`).join("");
  }
}
function openForm(row){ $form.style.display="block"; $id.value=row?.id||""; $title.value=row?.title||""; $company.value=row?.company||""; $location.value=row?.location||""; state.editingId=row?.id||null; $title.focus(); }
function closeForm(){ $form.style.display="none"; $id.value=""; $title.value=""; $company.value=""; $location.value=""; state.editingId=null; }

// ===== API helpers =====
async function apiList(){
  setStatus("Loading…"); setError("");
  const r = await fetch(API.LIST(), { headers: { "Accept":"application/json" }});
  if (!r.ok) throw new Error(`List failed: ${r.status}`);
  const data = await r.json();
  // Expecting array of items: [{id, title, company, location}, ...]
  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
}
async function apiCreate(payload){
  const r = await fetch(API.CREATE(), { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`Create failed: ${r.status}`);
  return r.json();
}
async function apiUpdate(id, payload){
  const r = await fetch(API.UPDATE(id), { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`Update failed: ${r.status}`);
  return r.json();
}
async function apiDelete(id){
  const r = await fetch(API.DELETE(id), { method:"DELETE" });
  if (!r.ok) throw new Error(`Delete failed: ${r.status}`);
  return true;
}

// ===== Event wiring =====
$input?.addEventListener("input",(e)=>{ state.query = e.target.value || ""; render(); });
$addBtn?.addEventListener("click",()=> openForm(null));
$rows?.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button"); if(!btn) return;
  const tr = e.target.closest("tr"); const id = tr?.getAttribute("data-id"); if(!id && btn.getAttribute("data-act")!=="edit") return;
  try{
    setError("");
    if (btn.getAttribute("data-act")==="edit"){
      const row = state.all.find(x=>String(x.id)===String(id));
      openForm(row);
    } else if (btn.getAttribute("data-act")==="del"){
      await apiDelete(id);
      state.all = state.all.filter(x=>String(x.id)!==String(id));
      render();
      setStatus("Deleted.");
    }
  }catch(err){ setError(String(err.message||err)); }
});
$saveBtn?.addEventListener("click", async ()=>{
  const payload = { title:$title.value?.trim()||"", company:$company.value?.trim()||"", location:$location.value?.trim()||"" };
  try{
    setError(""); setStatus("Saving…");
    if (state.editingId){
      const updated = await apiUpdate(state.editingId, payload);
      const i = state.all.findIndex(x=>String(x.id)===String(state.editingId));
      if (i>=0) state.all[i] = { ...state.all[i], ...(updated||payload) };
      setStatus("Updated.");
    } else {
      const created = await apiCreate(payload);
      state.all.unshift(created?.item || created || payload); // accept any of these shapes
      setStatus("Created.");
    }
    closeForm(); render();
  }catch(err){ setError(String(err.message||err)); }
});
$cancelBtn?.addEventListener("click",()=> closeForm());

// ===== Initial load =====
(async function init(){
  try {
    state.all = await apiList();
    setStatus(`Loaded ${state.all.length} items.`);
    render();
  } catch(err){
    setError(String(err.message||err));
    // Show empty UI but keep app usable
    state.all = [];
    render();
  }
})();
