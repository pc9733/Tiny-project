// ===== API CONFIG: adjust if your backend routes differ =====
const BASE = ""; // same-origin; set to "http://<ip>:<port>" if API on another host
const API = {
  list:   () => `${BASE}/api/companies`,             // GET -> [{id,company,location}] or {items:[...]}
  create: () => `${BASE}/api/companies`,             // POST body {company,location}
  update: (id) => `${BASE}/api/companies/${id}`,     // PUT body {company,location}
  remove: (id) => `${BASE}/api/companies/${id}`,     // DELETE
};

// ===== DOM =====
const $ = (s) => document.querySelector(s);
const tbody = $("#tbody"), empty = $("#empty");
const search = $("#search"), statusEl = $("#status"), errorEl = $("#error");
const modal = $("#modal"), form = $("#form"), btnAdd = $("#btnAdd"), btnCancel = $("#btnCancel");
const fieldId = $("#id"), fieldCompany = $("#company"), fieldLocation = $("#location");

// ===== State =====
let rows = []; // [{id, company, location}]

// ===== Utils =====
const esc = (s) => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const setStatus = (m="") => statusEl.textContent = m;
const setError  = (m="") => errorEl.textContent  = m;

async function apiGET(url) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json' }});
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
async function apiJSON(url, method, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json().catch(() => ({}));
}

function render(list = rows) {
  const q = search.value.trim().toLowerCase();
  const data = q ? list.filter(r => (r.location||"").toLowerCase().includes(q)) : list;

  if (!data.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  tbody.innerHTML = data.map(r => `
    <tr data-id="${esc(r.id ?? "")}">
      <td>${esc(r.company || "")}</td>
      <td>${esc(r.location || "")}</td>
      <td>
        <button class="link" data-act="edit">Edit</button>
        <span> | </span>
        <button class="link" data-act="del">Delete</button>
      </td>
    </tr>
  `).join("");
}

// ===== Initial load =====
(async function init(){
  try {
    setError(""); setStatus("Loading…");
    const data = await apiGET(API.list());
    rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    setStatus(`Loaded ${rows.length} record(s).`);
    render();
  } catch (e) {
    setStatus(""); setError("Failed to load. Check API route/CORS.");
    rows = []; render();
  }
})();

// ===== Search =====
search.addEventListener("input", () => render());

// ===== Add =====
btnAdd.addEventListener("click", () => {
  form.reset();
  fieldId.value = "";
  modal.showModal();
  fieldCompany.focus();
});

// ===== Cancel =====
btnCancel.addEventListener("click", () => modal.close());

// ===== Row actions =====
tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  const tr = e.target.closest("tr"); const id = tr?.getAttribute("data-id");
  const act = btn.getAttribute("data-act");

  if (act === "edit") {
    const row = rows.find(r => String(r.id) === String(id));
    if (!row) return;
    fieldId.value = row.id || "";
    fieldCompany.value = row.company || "";
    fieldLocation.value = row.location || "";
    modal.showModal();
  } else if (act === "del") {
    try {
      setError(""); setStatus("Deleting…");
      await apiJSON(API.remove(id), "DELETE");
      rows = rows.filter(r => String(r.id) !== String(id));
      setStatus("Deleted.");
      render();
    } catch (e2) {
      setStatus(""); setError("Delete failed. Check API route/permissions.");
    }
  }
});

// ===== Save (Add/Edit) =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    company: fieldCompany.value.trim(),
    location: fieldLocation.value
  };
  if (!payload.company || !payload.location) return;

  try {
    setError(""); setStatus("Saving…");
    const id = fieldId.value;
    if (id) {
      const updated = await apiJSON(API.update(id), "PUT", payload);
      const i = rows.findIndex(r => String(r.id) === String(id));
      if (i >= 0) rows[i] = { ...rows[i], ...(updated || payload) };
      setStatus("Updated.");
    } else {
      const created = await apiJSON(API.create(), "POST", payload);
      const item = created?.item || created || { ...payload, id: crypto.randomUUID?.() || String(Date.now()) };
      rows.unshift(item);
      setStatus("Created.");
    }
    modal.close(); render();
  } catch (e3) {
    setStatus(""); setError("Save failed. Check API route/payload/CORS.");
  }
});
