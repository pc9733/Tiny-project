:root{
  --bg:#0b0f14; --card:#121821; --muted:#1b2430; --border:#2a3443;
  --text:#e6edf3; --sub:#aab6c4; --accent:#5aa7ff; --danger:#ff6b6b;
}

*{box-sizing:border-box}
body{margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial,"Noto Sans";
  background:var(--bg); color:var(--text)}
.container{max-width:1100px; margin:20px auto 32px; padding:0 16px}

.topbar{display:flex; align-items:center; justify-content:space-between; padding:14px 16px 0}
.topbar h1{margin:0; font-size:22px}
.nav{display:flex; gap:10px; flex-wrap:wrap}
.nav a{color:var(--sub); text-decoration:none; padding:6px 10px; border:1px solid var(--border); border-radius:10px}
.nav a.active,.nav a:hover{color:var(--accent); border-color:var(--accent)}

.toolbar{display:flex; gap:8px; flex-wrap:wrap; margin:12px 0}
.search{flex:1; min-width:220px; padding:10px 12px; border-radius:10px; border:1px solid var(--border);
  background:transparent; color:var(--text)}
.btn{padding:8px 12px; border:1px solid var(--border); background:var(--muted); color:var(--text);
  border-radius:10px; cursor:pointer}
.btn:hover{border-color:var(--accent)}
.btn.primary{background:transparent; border-color:var(--accent); color:var(--accent)}
.btn.danger{border-color:var(--danger); color:var(--danger); background:transparent}

.card{background:var(--card); border:1px solid var(--border); border-radius:16px; overflow:hidden}
table{width:100%; border-collapse:collapse}
thead th{background:var(--muted); color:var(--sub); font-weight:600; text-align:left; font-size:13px; letter-spacing:.3px}
th,td{padding:12px 14px; border-bottom:1px solid var(--border); vertical-align:middle}
tr:hover td{background:rgba(255,255,255,0.02)}
.url{color:var(--accent); text-decoration:none; word-break:break-all}
.tag{padding:4px 8px; border:1px solid var(--border); border-radius:20px; font-size:12px; color:var(--sub)}
.actions{display:flex; gap:8px; flex-wrap:wrap}
.empty{padding:24px; color:var(--sub); text-align:center}

dialog{border:none; border-radius:16px; padding:0; max-width:520px; width:96%}
.modal{background:var(--card); border:1px solid var(--border); padding:20px; border-radius:16px}
.grid{display:grid; grid-template-columns:1fr; gap:12px}
.grid-2{grid-template-columns:1fr 1fr}
label{font-size:13px; color:var(--sub)}
input[type="text"], select{padding:10px 12px; background:transparent; color:var(--text); border:1px solid var(--border); border-radius:10px; width:100%}
.row{display:flex; gap:10px; justify-content:flex-end; margin-top:8px}
.muted{color:var(--sub); font-size:12px}
.tip{margin-top:10px}
