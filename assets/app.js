// ===== API CONFIG =====
const BASE = ""; // adjust if backend lives elsewhere
const API = {
  list: () => `${BASE}/api/companies`,
  create: () => `${BASE}/api/companies`,
  update: (id) => `${BASE}/api/companies/${id}`,
  remove: (id) => `${BASE}/api/companies/${id}`,
};

// ===== DOM =====
const $ = (s) => document.querySelector(s);
const tbody = $("#tbody");
const empty = $("#empty");
const statusEl = $("#status");
const errorEl = $("#error");
const modal = $("#modal");
const form = $("#form");
const btnAdd = $("#btnAdd");
const btnAddBottom = $("#btnAddBottom");
const btnCancel = $("#btnCancel");
const fieldId = $("#id");
const fieldCompany = $("#company");
const fieldLocation = $("#location");

// guard for pages that don't host the CRUD UI (e.g., other templates)
if (tbody && form && modal && fieldCompany && fieldLocation) {
  const STORAGE_KEY = "tiny-project:companies";
  const FALLBACK_ROWS = [
    { id: "seed-infosys", company: "Infosys", location: "Gurgaon" },
    { id: "seed-hcl", company: "HCL Tech", location: "Noida" },
    { id: "seed-acc", company: "Accenture", location: "Gurgaon" },
    { id: "seed-pwc", company: "PwC India", location: "Gurgaon and Noida" },
  ];

  // ===== State =====
  let rows = [];
  let filterLocation = "";
  let apiOnline = true;

  // ===== Utils =====
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const setStatus = (msg = "") => { if (statusEl) statusEl.textContent = msg; };
  const setError = (msg = "") => { if (errorEl) errorEl.textContent = msg; };
  const randomId = () => (crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);

  const sanitizeRow = (item = {}) => ({
    id: item.id || randomId(),
    company: (item.company || "").trim(),
    location: (item.location || "").trim() || "Unknown",
  });

  const normalizeList = (data) => {
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return list.filter(Boolean).map(sanitizeRow);
  };

  const persistRows = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (_) {
      /* ignore storage issues */
    }
  };

  const loadStoredRows = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data.map(sanitizeRow) : [];
    } catch (_) {
      return [];
    }
  };

  async function apiGET(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  async function apiJSON(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json().catch(() => ({}));
  }

  const offlineNotice = (msg) => {
    setStatus(`${msg} (offline mode)`);
    setError("Backend unreachable. Changes are stored locally.");
  };

  function render() {
    const list = filterLocation
      ? rows.filter((r) => r.location.toLowerCase() === filterLocation)
      : rows;

    if (!list.length) {
      tbody.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";
    tbody.innerHTML = list
      .map(
        (r) => `
        <tr data-id="${esc(r.id)}">
          <td>${esc(r.company)}</td>
          <td>${esc(r.location)}</td>
          <td>
            <button class="link" data-act="edit">Edit</button>
            <span> | </span>
            <button class="link" data-act="del">Delete</button>
          </td>
        </tr>
      `.trim()
      )
      .join("");
  }

  function openModal(row = null) {
    form.reset();
    fieldId.value = row?.id || "";
    fieldCompany.value = row?.company || "";
    fieldLocation.value = row?.location || "";
    try {
      modal.showModal();
    } catch (_) {
      modal.setAttribute("open", "true");
    }
    fieldCompany.focus();
  }

  btnAdd?.addEventListener("click", () => openModal());
  btnAddBottom?.addEventListener("click", () => openModal());
  btnCancel?.addEventListener("click", () => modal.close());

  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr?.getAttribute("data-id");
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return;

    const act = btn.dataset.act;
    if (act === "edit") {
      openModal(row);
    } else if (act === "del") {
      if (!confirm(`Delete ${row.company || "this company"}?`)) return;
      deleteRow(row.id);
    }
  });

  async function deleteRow(id) {
    setError("");
    setStatus("Deleting…");
    let remote = true;
    if (apiOnline) {
      try {
        await apiJSON(API.remove(id), "DELETE");
        setError("");
      } catch (err) {
        remote = false;
        apiOnline = false;
        console.warn("Delete failed, keeping local only:", err);
      }
    } else {
      remote = false;
    }

    rows = rows.filter((r) => String(r.id) !== String(id));
    persistRows();
    render();
    if (remote) {
      setStatus("Deleted.");
    } else {
      offlineNotice("Deleted locally");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      company: fieldCompany.value.trim(),
      location: fieldLocation.value.trim(),
    };
    if (!payload.company || !payload.location) {
      setError("Company and location are required.");
      return;
    }

    const existingId = fieldId.value;
    setStatus("Saving…");
    setError("");

    if (existingId) {
      const idx = rows.findIndex((r) => String(r.id) === String(existingId));
      if (idx === -1) return;
      let updated = null;
      if (apiOnline) {
        try {
          updated = await apiJSON(API.update(existingId), "PUT", payload);
          apiOnline = true;
          setError("");
        } catch (err) {
          apiOnline = false;
          console.warn("Update failed, storing locally:", err);
        }
      }
      rows[idx] = sanitizeRow({ ...rows[idx], ...(updated || payload), id: existingId });
      persistRows();
      modal.close();
      render();
      if (apiOnline && updated) {
        setStatus("Updated.");
      } else {
        offlineNotice("Updated locally");
      }
    } else {
      let created = null;
      if (apiOnline) {
        try {
          created = await apiJSON(API.create(), "POST", payload);
          apiOnline = true;
          setError("");
        } catch (err) {
          apiOnline = false;
          console.warn("Create failed, storing locally:", err);
        }
      }
      const record = sanitizeRow(created || { ...payload, id: randomId() });
      rows.unshift(record);
      persistRows();
      modal.close();
      render();
      if (apiOnline && created) {
        setStatus("Created.");
      } else {
        offlineNotice("Created locally");
      }
    }
  });

  async function loadInitialRows() {
    setStatus("Loading…");
    setError("");
    try {
      const query = filterLocation ? `?location=${encodeURIComponent(filterLocation)}` : "";
      const data = await apiGET(`${API.list()}${query}`);
      rows = normalizeList(data);
      apiOnline = true;
      setError("");
      persistRows();
      setStatus(`Loaded ${rows.length} record(s).`);
    } catch (err) {
      console.warn("Initial fetch failed, using local fallback:", err);
      apiOnline = false;
      const stored = loadStoredRows();
      if (stored.length) {
        rows = stored;
        setStatus("Offline mode – showing saved data.");
      } else {
        rows = FALLBACK_ROWS.map((r) => ({ ...r }));
        setStatus("Offline mode – using sample data.");
      }
      setError("Backend unreachable. Working from local data.");
    }
    render();
  }

  const App = {
    async mount(options = {}) {
      filterLocation = (options.location || "").trim().toLowerCase();
      await loadInitialRows();
    },
  };

  window.App = App;
  document.addEventListener("DOMContentLoaded", () => {
    App.mount();
  });
} else {
  // still expose a no-op App for other pages
  window.App = window.App || {
    mount() {},
  };
}
