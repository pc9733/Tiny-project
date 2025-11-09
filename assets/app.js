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
const form = $("#form") || modal?.querySelector("form");
const btnAddTop = $("#btnAdd") || $("#addBtn");
const btnAddBottom = $("#btnAddBottom");
const btnCancel = $("#btnCancel")
  || modal?.querySelector("button[value='cancel']")
  || modal?.querySelector("button[type='button']");
const fieldId = $("#id") || $("#fId");
const fieldCompany = $("#company") || $("#fCompany");
const fieldLocation = $("#location") || $("#fLocation");
const fieldUrl = $("#url") || $("#fUrl");

const essentials = [tbody, modal, form, fieldCompany, fieldLocation];
if (essentials.some((node) => !node)) {
  window.App = window.App || { mount() {} };
} else {
  const state = {
    rows: [],
    filterLocation: "",
  };

  const table = tbody.closest("table");
  const showUrlColumn = Boolean(
    table?.querySelector("[data-col='url']")
      || document.querySelector("th[data-col='url']")
  );
  const tableColumnCount = table?.querySelectorAll("thead th").length || (showUrlColumn ? 4 : 3);

  const LOCATION_LABELS = {
    gurgaon: "Gurgaon",
    gurugram: "Gurugram",
    gurgaon_noida: "Gurgaon + Noida",
    noida: "Noida",
    delhi: "Delhi",
    remote: "Remote",
  };

  const normalizeLocationCode = (value = "") => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return "";
    if (normalized.includes("gurgaon") && normalized.includes("noida")) {
      return "gurgaon_noida";
    }
    if (normalized === "gurgaon_noida" || normalized === "gurgaon+noida") {
      return "gurgaon_noida";
    }
    if (normalized === "gurgaon" || normalized === "gurugram") {
      return "gurgaon";
    }
    if (normalized === "work from home") {
      return "remote";
    }
    return normalized.replace(/\s+/g, " ").trim().replace(/\s+/g, "_");
  };

  const decorateRow = (item = {}) => {
    const company = (item.company || "").trim();
    const locationRaw = (item.location || "").trim();
    const url = (item.url || "").trim();
    const locationCode = normalizeLocationCode(locationRaw || item.location_code || "");
    let location = locationRaw;
    if (!location) {
      location = LOCATION_LABELS[locationCode] || "";
    } else if (location.trim().toLowerCase() === locationCode) {
      location = LOCATION_LABELS[locationCode] || location;
    }
    return {
      id: item.id,
      company,
      location,
      locationCode,
      url,
    };
  };

  const setLocationFieldValue = (value) => {
    if (!fieldLocation) return;
    const input = (value || "").trim();
    if (!input) {
      fieldLocation.value = "";
      return;
    }
    const targetCode = normalizeLocationCode(input);
    const option = Array.from(fieldLocation.options || []).find((opt) => {
      const raw = (opt.value || opt.textContent || "").trim();
      if (!raw) return false;
      const normalized = normalizeLocationCode(raw);
      if (targetCode) {
        return normalized === targetCode;
      }
      return raw.toLowerCase() === input.toLowerCase();
    });
    if (option) {
      fieldLocation.value = option.value || option.textContent;
    } else {
      fieldLocation.value = input;
    }
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
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch (err) {
        // swallow parse errors so we can throw the default message
      }
      throw new Error(message);
    }
    return res.json();
  }

  async function apiJSON(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    let payload = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (err) {
        payload = text;
      }
    }

    if (!res.ok) {
      const message =
        (payload && typeof payload === "object" && payload.error)
          || (typeof payload === "string" && payload)
          || `${res.status} ${res.statusText}`;
      const error = new Error(message);
      error.status = res.status;
      error.payload = payload;
      throw error;
    }

    return payload && typeof payload === "object" ? payload : {};
  }

  const normalizeList = (data) => {
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return list
      .filter(Boolean)
      .map((item) => decorateRow(item))
      .filter((item) => item.company && item.location);
  };

  function render() {
    const display = state.filterLocation
      ? state.rows.filter((row) => (row.locationCode || "") === state.filterLocation)
      : state.rows;

    if (!display.length) {
      tbody.innerHTML = `<tr><td class="empty" colspan="${tableColumnCount}">No records.</td></tr>`;
      if (empty) empty.style.display = "block";
      return;
    }

    if (empty) empty.style.display = "none";
    tbody.innerHTML = display
      .map((row) => `
        <tr data-id="${esc(row.id)}">
          <td>${esc(row.company)}</td>
          <td>${esc(row.location)}</td>
          ${showUrlColumn
            ? `<td data-col="url">${row.url
                ? `<a href="${esc(row.url)}" target="_blank" rel="noopener">${esc(row.url)}</a>`
                : "<span class=\"muted\">—</span>"}</td>`
            : ""}
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
    setLocationFieldValue(row?.location || row?.locationCode || "");
    if (fieldUrl) {
      fieldUrl.value = row?.url || "";
    }
    if (!row && state.filterLocation && fieldLocation) {
      setLocationFieldValue(state.filterLocation);
    }
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
      const data = await apiGET(API.list());
      state.rows = normalizeList(data);
      render();
      setStatus(`Loaded ${state.rows.length} record(s).`);
    } catch (err) {
      console.error("Failed to load rows", err);
      state.rows = [];
      render();
      setStatus("");
      setError(err?.message || "Unable to fetch data. Check API/credentials.");
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    const company = fieldCompany.value.trim();
    const locationInput = fieldLocation.value?.trim?.() || "";
    const locationText = (() => {
      if (!fieldLocation) return "";
      if (fieldLocation.tagName === "SELECT") {
        const opt = fieldLocation.options[fieldLocation.selectedIndex];
        return (opt?.textContent || "").trim();
      }
      return locationInput;
    })();

    const locationNormalized = normalizeLocationCode(locationInput || locationText);
    const locationLabel = locationNormalized
      ? LOCATION_LABELS[locationNormalized] || locationText || locationInput
      : locationInput || locationText;

    const payload = {
      company,
      location: (locationLabel || "").trim(),
    };
    if (fieldUrl) {
      payload.url = fieldUrl.value.trim();
    }

    if (!payload.company || !payload.location) {
      setError("Company and location are required.");
      return;
    }

    if (fieldUrl && fieldUrl.required && !payload.url) {
      setError("Careers URL is required.");
      return;
    }

    setStatus("Saving…");
    setError("");
    const id = fieldId.value;

    try {
      if (id) {
        const updated = await apiJSON(API.update(id), "PUT", payload);
        state.rows = state.rows.map((row) => {
          if (String(row.id) !== String(id)) return row;
          return decorateRow({
            id,
            company: updated.company || payload.company,
            location: updated.location || payload.location,
            url: updated.url || payload.url || row.url || "",
          });
        });
        setStatus("Updated.");
      } else {
        const created = await apiJSON(API.create(), "POST", payload);
        const nextRow = decorateRow({
          id: created.id,
          company: created.company || payload.company,
          location: created.location || payload.location,
          url: created.url || payload.url || "",
        });
        state.rows = [nextRow, ...state.rows];
        setStatus("Created.");
      }
      closeModal();
      render();
    } catch (err) {
      console.error("Save failed", err);
      setStatus("");
      setError(err?.message || "Save failed. Check API or required fields.");
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
      setError(err?.message || "Delete failed. Check API permissions.");
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
      state.filterLocation = normalizeLocationCode(options.location || "");
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
