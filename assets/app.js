// API-backed data layer (Flask + DynamoDB via /api/*)
const App = (() => {
  const $ = (s) => document.querySelector(s);

  const state = {
    rows: [],
    mode: "all",        // "all" | "filtered"
    location: "",       // when mode === "filtered", value is one of the codes below
    loading: false,
  };

  // Canonical location codes we store & send to API
  const VALID_CODES = ["gurgaon", "noida", "remote", "gurgaon_noida"];

  // ---------- Utilities ----------
  const uid = () => Math.random().toString(36).slice(2, 10);

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const escapeAttr = (s) => String(s).replace(/"/g, "&quot;");

  // Map free-text -> canonical code
  function normalizeLoc(x) {
    const raw = String(x || "").trim().toLowerCase();
    if (!raw) return "";
    if (/\b(gurugram|gurgaon)\b/.test(raw)) {
      if (raw.includes("noida")) return "gurgaon_noida";
      return "gurgaon";
    }
    if (raw.includes("noida")) return "noida";
    if (raw.includes("remote") || raw.includes("wfh")) return "remote";
    // Try to accept already-canonical values
    if (VALID_CODES.includes(raw)) return raw;
    return ""; // unknown -> reject during validation
  }

  // code -> pretty label for display
  function prettyLoc(code) {
    switch ((code || "").toLowerCase()) {
      case "gurgaon": return "Gurgaon";
      case "noida": return "Noida";
      case "remote": return "Remote";
      case "gurgaon_noida": return "Gurgaon + Noida";
      default: return code || "";
    }
  }

  function setLoading(on) {
    state.loading = !!on;
    const tbody = $("#tbody");
    if (on && tbody) {
      tbody.innerHTML = `<tr><td class="empty" colspan="4">Loading…</td></tr>`;
    }
  }

  // ---------- API helpers ----------
  async function apiList(locationCode) {
    const loc = locationCode ? normalizeLoc(locationCode) : "";
    const url = loc ? `/api/companies?location=${encodeURIComponent(loc)}` : `/api/companies`;
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
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
      const target = (state.location || "").toLowerCase();
      rows = rows.filter((r) => String(r.location || "").toLowerCase() === target);
    }

    const filtered = rows.filter(
      (r) =>
        !q ||
        (r.company || "").toLowerCase().includes(q) ||
        prettyLoc(r.location || "").toLowerCase().includes(q) ||
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
        <td><span class="tag">${escapeHtml(prettyLoc(r.location || ""))}</span></td>
        <td><a class="url" href="${escapeAttr(r.url || "")}" target="_blank" rel="noopener">${escapeHtml(r.url || "")}</a></td>
        <td class="actions">
          <button class="btn" data-open="${r.id}">Open</button>
          <button class="btn" data-edit="${r.id}">Edit</button>
          <button class="btn danger" data-del="${r.id}">Delete</button>
        </td>
      </tr>`
      )
      .join("");
  }

  // ---------- UI handlers ----------
  function openModal(mode, row = null) {
    $("#modalTitle").textContent = mode === "edit" ? "Edit Company" : "Add Company";
    $("#fId").value = row?.id || "";
    $("#fCompany").value = row?.company || "";
    // Ensure dropdown shows the canonical code
    $("#fLocation").value = normalizeLoc(row?.location || "") || "";
    $("#fUrl").value = row?.url || "";
    $("#modal").showModal();
    setTimeout(() => $("#fCompany").focus(), 50);
  }

  async function addOrUpdate(e) {
    e.preventDefault();
    const id = $("#fId").value || uid();
    const company = $("#fCompany").value.trim();
    const locationCode = normalizeLoc($("#fLocation").value);
    const url = $("#fUrl").value.trim();

    if (!company || !locationCode || !url) return;

    const row = { id, company, location: locationCode, url };

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

  function pick(obj, keys) {
    for (const k of keys) {
      const found = Object.keys(obj).find((h) => h.toLowerCase().replace(/\s+/g, "").includes(k));
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

    const cleaned = json
      .map((x) => {
        const company = x.company || x.Company || "";
        const loc = normalizeLoc(x.location || x.Location || "");
        const url = x.url || x["Careers URL"] || x.careers || "";
        return { id: x.id || uid(), company, location: loc, url };
      })
      .filter((x) => x.company && x.url && VALID_CODES.includes(x.location));

    await bulkUpsert(cleaned);
  }

  async function importExcel(_file) {
    // Disabled unless XLSX lib is added to the page.
    alert("Excel import requires XLSX library. For now, use JSON Import.");
  }

  async function bulkUpsert(items) {
    setLoading(true);
    try {
      for (const it of items) {
        // de-dup by (company+url)
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
    const ids = Array.from(document.querySelectorAll("#tbody tr[data-id]")).map((tr) =>
      tr.getAttribute("data-id")
    );
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
    const locForFetch = state.mode === "filtered" && state.location ? state.location : null;
    const items = await apiList(locForFetch);
    // Ensure shape + order (newest first by created_at if present)
    let rows = (items || []).map((x) => ({
      id: x.id,
      company: x.company,
      location: normalizeLoc(x.location || x.loc || x.Location || x.location_code || ""), // sanitize
      url: x.url,
      created_at: x.created_at || null,
    }));
    rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    state.rows = rows;
  }

  // ---------- Mount ----------
  async function mount({ mode = "all", location = "" } = {}) {
    state.mode = mode;
    state.location = normalizeLoc(location) || "";

    // Wire events
    $("#addBtn")?.addEventListener("click", () => openModal("add"));
    $("#saveBtn")?.addEventListener("click", addOrUpdate);
    $("#search")?.addEventListener("input", (e) => render(e.target.value));
    $("#exportBtn")?.addEventListener("click", exportJSON);

    // Your HTML uses a single input#export/importFile — support that ID:
    $("#importFile")?.addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        if (f.name.toLowerCase().endsWith(".json")) {
          await importJSON(f);
        } else {
          await importExcel(f);
        }
      } catch (err) {
        alert("Import failed: " + (err.message || err));
      } finally {
        e.target.value = "";
      }
    });

    // Table row actions
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

    // Dialog cancel handling (method="dialog" auto-closes; we just reset fields)
    const dlg = $("#modal");
    dlg?.addEventListener("close", () => {
      if (dlg.returnValue === "cancel") {
        $("#fId").value = "";
        $("#fCompany").value = "";
        $("#fLocation").value = "";
        $("#fUrl").value = "";
      }
    });

    // Initial load
    setLoading(true);
    try {
      await refresh();
      render();
    } catch (err) {
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

// Legacy cancel helpers were pointing to non-existing IDs.
// Your <dialog method="dialog"> closes automatically on the Cancel button.
// No extra global handlers needed anymore.
