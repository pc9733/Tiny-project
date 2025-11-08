:root { --line:#eaeaea; --muted:#666; --primary:#0b5cff; }
* { box-sizing: border-box; }
body { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; background:#f7f8fa; margin:0; padding:28px; }
h1 { margin:0 0 16px; font-size:22px; }
.bar { display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
input[type="search"] { padding:10px 12px; border:1px solid #ccc; border-radius:10px; min-width:300px; }
button { padding:10px 14px; border-radius:10px; border:1px solid var(--primary); background:var(--primary); color:#fff; cursor:pointer; }
button.secondary { background:#fff; color:#111; border-color:#bbb; }
button.link { background:transparent; color:#0b5cff; border:0; padding:0; cursor:pointer; }
.table { width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; }
th, td { text-align:left; padding:12px 14px; border-bottom:1px solid var(--line); }
th { background:#fafafa; position:sticky; top:0; font-weight:600; }
.empty { padding:14px; color:var(--muted); }
.status { color:var(--muted); font-size:12px; }
.err { color:#b00020; font-size:12px; }
dialog { border:1px solid var(--line); border-radius:12px; padding:18px; width:min(680px,96vw); }
.row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.row label { display:flex; flex-direction:column; gap:6px; flex:1 1 260px; }
.row input, .row select { padding:10px 12px; border:1px solid #ccc; border-radius:10px; }
.actions { display:flex; gap:10px; justify-content:flex-end; }
