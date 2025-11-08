// Simple CRUD UI powered by backend/api/companies
const BASE = ""; // set to http://host:port if API is remote
const API = {
  list: () => `${BASE}/api/companies`,
  create: () => `${BASE}/api/companies`,
  update: (id) => `${BASE}/api/companies/${id}`,
  remove: (id) => `${BASE}/api/companies/${id}`,
};

const $ = (s) => document.querySelector(s);
const tbody = $("#tbody");
const empty = $("#empty");
const statusEl = $("#status");
const errorEl = $("#error");
const modal = $("#modal");
const form = $("#form");
const btnAddTop = $("#btnAdd");
const btnAddBottom = $("#btnAddBottom");
const btnCancel = $("#btnCancel");
const fieldId = $("#id");
const fieldCompany = $("#company");
const fieldLocation = $("#location");

const essentials = [tbody, empty, modal, form, fieldCompany, fieldLocation];
if (essentials.some((node) => !node)) {
  window.App = window.App || { mount() {} };
} else {
  const state = {
    rows: [],
    filterLocation: "",
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));

  const setStatus = (msg = "") => { if (statusEl) statusEl.textContent = msg; };
  const setError = (msg = "") => { if (errorEl) errorEl.textContent = msg; };

  async function apiGET(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  async function apiJSON(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json().catch(() => ({}));
  }

  const normalizeList = (data) => {
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return list
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        company: (item.company || "").trim(),
        location: (item.location || "").trim(),
      }))
      .filter((item) => item.company && item.location);
  };

  function render() {
    const display = state.filterLocation
      ? state.rows.filter((row) => (row.location || "").toLowerCase() === state.filterLocation)
      : state.rows;

    if (!display.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = display
      .map((row) => `
        <tr data-id="${esc(row.id)}">
          <td>${esc(row.company)}</td>
          <td>${esc(row.location)}</td>
          <td>
            <button class="link" data-act="edit">Edit</button>
            <span> | </span>
            <button class="link" data-act="del">Delete</button>
          </td>
        </tr>
      `)
      .join("");
  }

  const openDialog = () => {
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "true");
    }
  };

  const closeDialog = () => {
    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  };

  function openModal(row = null) {
    form.reset();
    fieldId.value = row?.id || "";
    fieldCompany.value = row?.company || "";
    fieldLocation.value = row?.location || "";
    openDialog();
    fieldCompany.focus();
  }

  function closeModal() {
    closeDialog();
  }

  async function loadRows() {
    setStatus("Loading…");
    setError("");
    try {
      const query = state.filterLocation ? `?location=${encodeURIComponent(state.filterLocation)}` : "";
      const data = await apiGET(`${API.list()}${query}`);
      state.rows = normalizeList(data);
      render();
      setStatus(`Loaded ${state.rows.length} record(s).`);
    } catch (err) {
      console.error("Failed to load rows", err);
      state.rows = [];
      render();
      setStatus("");
      setError("Unable to fetch data. Check API/credentials.");
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    const payload = {
      company: fieldCompany.value.trim(),
      location: fieldLocation.value.trim(),
    };

    if (!payload.company || !payload.location) {
      setError("Company and location are required.");
      return;
    }

    setStatus("Saving…");
    setError("");
    const id = fieldId.value;

    try {
      if (id) {
        const updated = await apiJSON(API.update(id), "PUT", payload);
        state.rows = state.rows.map((row) => (String(row.id) === String(id) ? {
          id,
          company: updated.company || payload.company,
          location: updated.location || payload.location,
        } : row));
        setStatus("Updated.");
      } else {
        const created = await apiJSON(API.create(), "POST", payload);
        state.rows = [{
          id: created.id,
          company: created.company || payload.company,
          location: created.location || payload.location,
        }, ...state.rows];
        setStatus("Created.");
      }
      closeModal();
      render();
    } catch (err) {
      console.error("Save failed", err);
      setStatus("");
      setError("Save failed. Check API or required fields.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this company?")) return;
    setStatus("Deleting…");
    setError("");
    try {
      await apiJSON(API.remove(id), "DELETE");
      state.rows = state.rows.filter((row) => String(row.id) !== String(id));
      render();
      setStatus("Deleted.");
    } catch (err) {
      console.error("Delete failed", err);
      setStatus("");
      setError("Delete failed. Check API permissions.");
    }
  }

  btnAddTop?.addEventListener("click", () => openModal());
  btnAddBottom?.addEventListener("click", () => openModal());
  btnCancel?.addEventListener("click", () => closeModal());
  form.addEventListener("submit", handleSave);

  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr?.getAttribute("data-id");
    const row = state.rows.find((r) => String(r.id) === String(id));
    if (!row) return;

    if (btn.dataset.act === "edit") {
      openModal(row);
    } else if (btn.dataset.act === "del") {
      handleDelete(row.id);
    }
  });

  const App = {
    mounted: false,
    async mount(options = {}) {
      this.mounted = true;
      state.filterLocation = (options.location || "").trim().toLowerCase();
      await loadRows();
    },
  };

  window.App = App;

  const start = () => {
    if (!window.App.mounted) {
      window.App.mount();
    }
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}
