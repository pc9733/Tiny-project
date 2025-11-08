// ---------- Canonical mapping & helpers ----------
const CANON = {
  gurgaon: "gurgaon",
  gurugram: "gurgaon",
  noida: "noida",
  remote: "remote",
};

// Split on commas, slashes, semicolons, or the word "and"
function splitTerms(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/,|\/|;|\band\b/gi)
    .map((t) => t.trim())
    .filter(Boolean);
}

function canon(term) {
  return CANON[term] || term; // unknowns pass through
}

function toCanonicalSet(s) {
  const terms = splitTerms(s);
  const set = new Set();
  for (const t of terms) {
    const c = canon(t);
    // Keep only known canonical terms
    if (CANON[c] || Object.values(CANON).includes(c)) set.add(c);
  }
  return set;
}

function filterByLocation(rows = [], query = "") {
  const q = String(query || "").trim();
  if (!q) return rows;
  const want = toCanonicalSet(q);
  if (want.size === 0) return rows; // nothing recognized => don't filter

  return rows.filter((r) => {
    const itemSet = toCanonicalSet(r?.location || "");
    for (const w of want) if (itemSet.has(w)) return true; // ANY match
    return false;
  });
}

// ---------- Simple state + render ----------
const state = {
  all: Array.isArray(window.DATA) ? window.DATA.slice() : [],
  filtered: [],
  query: "",
};

const $rows = document.getElementById("rows");
const $empty = document.getElementById("empty");
const $input = document.getElementById("locationInput");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function render(list) {
  if (!Array.isArray(list) || list.length === 0) {
    $rows.innerHTML = "";
    $empty.style.display = "block";
    return;
  }
  $empty.style.display = "none";
  const html = list.map((r) => `
    <tr>
      <td>${escapeHtml(r.title || "")}</td>
      <td>${escapeHtml(r.company || "")}</td>
      <td><span class="pill">${escapeHtml(r.location || "")}</span></td>
    </tr>
  `).join("");
  $rows.innerHTML = html;
}

function apply() {
  const out = filterByLocation(state.all, state.query);
  state.filtered = out;
  render(out);
}

// Wire input
if ($input) {
  $input.addEventListener("input", (e) => {
    state.query = e.target.value || "";
    apply();
  });
}

// Initial paint
render(state.all);

// ---------- If you fetch data asynchronously, call setData(rows) ----------
window.setData = function setData(rows) {
  state.all = Array.isArray(rows) ? rows.slice() : [];
  apply();
};

// Example for real API usage (uncomment & adapt):
/*
fetch("https://your-backend.example.com/api/roles")
  .then(r => r.json())
  .then(rows => window.setData(rows))
  .catch(err => console.error("Data load failed:", err));
*/
