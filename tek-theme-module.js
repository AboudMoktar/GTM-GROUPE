// TEK-TREND : habillage moderne (même style que GADH/MGT) sur tous les onglets Rendement et RH.
// data-soc="tek" est posé sur <html> par mgt-theme-module.js dans les modules TEK-TREND.
(function(){
  const st=document.createElement('style');
  st.textContent=`
html[data-soc="tek"]{--accent:#006070;--accent-2:#17959F;--accent-bg:#E3F2F3;}
html[data-soc="tek"] .btn-primary{box-shadow:0 2px 8px rgba(0,96,112,.28);}
html[data-soc="tek"] .topbar,html[data-soc="tek"] .deepbar{background:linear-gradient(120deg,#006070 0%,#074652 100%);border-bottom:3px solid #F2A93B;}
html[data-soc="tek"] .topbar .tek{color:#F2A93B;}
html[data-soc="tek"] .btn-primary{border-bottom:3px solid #F2A93B;box-shadow:0 2px 8px rgba(0,96,112,.3);}
html[data-soc="tek"] .bottomnav .active,html[data-soc="tek"] .bottomnav .on{color:#F2A93B;}
html[data-soc="tek"] .sidebar{background:#074652;}
html[data-soc="tek"] .hero-card{background:radial-gradient(320px 200px at 95% 0%,rgba(23,149,159,.55),transparent 70%),linear-gradient(135deg,#06323C 0%,#0A4D5C 55%,#0E6A78 100%);-webkit-backdrop-filter:none;backdrop-filter:none;filter:none;}
html[data-soc="tek"] .field input:focus,html[data-soc="tek"] .input-cell input:focus{border-color:#17959F;box-shadow:0 0 0 3px rgba(23,149,159,.18);}
html[data-soc="tek"] .fc-t th{background:#074652;}
html[data-theme="dark"][data-soc="tek"]{--accent:#2FB7A6;--accent-2:#5CD0C2;--accent-bg:#0f3a45;}
html[data-theme="dark"][data-soc="tek"] .btn-primary{background:#17959F;color:#fff;}
html[data-theme="dark"][data-soc="tek"] .topbar{background:linear-gradient(120deg,#06323C 0%,#04252D 100%);}
html[data-soc="tek"]{--bg:#F1F6F7;--surface-2:#EAF2F3;--surface-3:#E2ECEE;--border:#D5E2E5;--border-soft:#E2ECEE;}
html[data-soc="tek"] .topbar,html[data-soc="tek"] .deepbar{border-bottom:0;background:linear-gradient(90deg,#F2A93B 0 34%,#17959F 34% 67%,#2FB7A6 67% 100%) left bottom/100% 4px no-repeat,linear-gradient(120deg,#006070 0%,#06323C 100%);padding-bottom:13px;}
html[data-soc="tek"] .btn-primary{background:linear-gradient(145deg,#17959F 0%,#006070 100%);border-radius:13px;border-bottom:3px solid #F2A93B;}
html[data-soc="tek"] .card{border:1px solid var(--border);border-top:3px solid #006070;border-radius:16px;}
html[data-soc="tek"] main .card:nth-child(3n+2){border-top-color:#F2A93B;}
html[data-soc="tek"] main .card:nth-child(3n+3){border-top-color:#17959F;}
html[data-soc="tek"] main h2{font-weight:800;letter-spacing:-.02em;}
html[data-soc="tek"] main h2::after{content:'';display:block;width:38px;height:4px;border-radius:3px;background:linear-gradient(90deg,#F2A93B,#17959F);margin-top:6px;}
html[data-soc="tek"] .dd-jp:nth-child(4n+1){--c:#006070;}
html[data-soc="tek"] .dd-jp:nth-child(4n+2){--c:#F2A93B;}
html[data-soc="tek"] .dd-jp:nth-child(4n+3){--c:#17959F;}
html[data-soc="tek"] .dd-jp:nth-child(4n+4){--c:#2FB7A6;}
html[data-soc="tek"] .dd-bx{border-radius:14px;border-width:0 0 0 5px;border-style:solid;box-shadow:0 2px 10px rgba(6,50,60,.08);text-align:left;padding-left:14px;}
html[data-soc="tek"] .dd-bx:nth-child(3n+1){border-color:#006070;}
html[data-soc="tek"] .dd-bx:nth-child(3n+2){border-color:#F2A93B;}
html[data-soc="tek"] .dd-bx:nth-child(3n+3){border-color:#17959F;}
html[data-soc="tek"] .dd-bx-bad{border-color:#E5484D !important;}
html[data-soc="tek"] .bottomnav{background:#fff;border-top:0;box-shadow:0 -6px 20px rgba(6,50,60,.10);}
html[data-soc="tek"] .bottomnav button.active{color:#006070;font-weight:800;}
html[data-soc="tek"] .bottomnav button.active::before{background:#F2A93B;width:34px;height:4px;}
html[data-soc="tek"] .bottomnav button.active svg{background:#E3F2F3;border-radius:12px;padding:5px 12px;width:44px;height:30px;box-sizing:border-box;color:#006070;}
html[data-soc="tek"] .bottomnav .active,html[data-soc="tek"] .bottomnav .on{color:#006070;}
html[data-soc="tek"] .badge,html[data-soc="tek"] .chip.on{background:#F2A93B;color:#3A2A00;}
html[data-theme="dark"][data-soc="tek"]{--bg:#0a1a20;--surface-2:#12262e;--surface-3:#183440;--border:#244552;--border-soft:#183440;}
html[data-theme="dark"][data-soc="tek"] .bottomnav{background:#12262e;}
html[data-theme="dark"][data-soc="tek"] .bottomnav button.active{color:#F5BE64;}
html[data-theme="dark"][data-soc="tek"] .bottomnav button.active svg{background:#0f3a45;color:#F5BE64;}
html[data-soc="tek"] body{background:radial-gradient(800px 380px at 105% -5%,rgba(242,169,59,.16),transparent 60%),radial-gradient(700px 420px at -10% 25%,rgba(23,149,159,.11),transparent 60%),#F1F6F7;background-attachment:fixed;}
html[data-soc="tek"] .topbar,html[data-soc="tek"] .deepbar{background:radial-gradient(260px 120px at 90% 0%,rgba(242,169,59,.35),transparent 70%),linear-gradient(135deg,#0E7C8A 0%,#06323C 100%);border-radius:0 0 26px 26px;padding-bottom:12px;box-shadow:0 14px 30px -14px rgba(6,50,60,.55);}
html[data-soc="tek"] .card{border:1px solid rgba(0,96,112,.06);border-top:1px solid rgba(0,96,112,.06);border-radius:22px;box-shadow:0 14px 34px -18px rgba(6,50,60,.28);padding:14px;}
html[data-soc="tek"] main .card:nth-child(3n+2),html[data-soc="tek"] main .card:nth-child(3n+3){border-top-color:rgba(0,96,112,.06);}
html[data-soc="tek"] .dd-jp{border-radius:24px;border:0;box-shadow:0 16px 34px -20px color-mix(in srgb,var(--c) 70%,#000);background:linear-gradient(155deg,color-mix(in srgb,var(--c) 16%,#fff) 0%,#fff 65%);}
html[data-soc="tek"] .dd-bx{border:0;border-radius:20px;text-align:left;padding:14px 16px;background:linear-gradient(160deg,color-mix(in srgb,var(--c,#006070) 14%,#fff) 0%,#fff 70%);box-shadow:0 12px 26px -18px color-mix(in srgb,var(--c,#006070) 80%,#000);}
html[data-soc="tek"] .dd-bx:nth-child(3n+1){--c:#006070;}
html[data-soc="tek"] .dd-bx:nth-child(3n+2){--c:#F2A93B;}
html[data-soc="tek"] .dd-bx:nth-child(3n+3){--c:#17959F;}
html[data-soc="tek"] .dd-bx-v{font-weight:800;color:var(--c,#006070);}
html[data-soc="tek"] .dd-bx-l{text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);}
html[data-soc="tek"] .btn-primary{background:linear-gradient(135deg,#17959F 0%,#006070 100%);border:0;border-radius:16px;box-shadow:0 10px 22px -10px rgba(0,96,112,.75),inset 0 -3px 0 rgba(242,169,59,.9);}
html[data-soc="tek"] .field input,html[data-soc="tek"] .field select,html[data-soc="tek"] .field textarea{border-radius:14px;background:#fff;border:1.5px solid #D5E2E5;}
html[data-soc="tek"] main{padding-bottom:104px;}
html[data-soc="tek"] .bottomnav{left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom));border-radius:26px;background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(0,96,112,.08);box-shadow:0 18px 40px -12px rgba(6,50,60,.45);padding:5px;gap:2px;}
html[data-soc="tek"] .bottomnav button{border-radius:20px;min-height:50px;}
html[data-soc="tek"] .bottomnav button.active{background:linear-gradient(135deg,#17959F,#074652);color:#fff;box-shadow:0 8px 16px -8px rgba(0,96,112,.8);}
html[data-soc="tek"] .bottomnav button.active::before{display:none;}
html[data-soc="tek"] .bottomnav button.active::after{content:'';position:absolute;bottom:3px;width:5px;height:5px;border-radius:50%;background:#F2A93B;}
html[data-soc="tek"] .bottomnav button.active svg{background:none;padding:0;width:20px;height:20px;color:#fff;}
html[data-soc="tek"] .bottomnav .active,html[data-soc="tek"] .bottomnav .on{color:#fff;}
html[data-theme="dark"][data-soc="tek"] body{background:radial-gradient(800px 380px at 105% -5%,rgba(242,169,59,.12),transparent 60%),#0a1a20;}
html[data-theme="dark"][data-soc="tek"] .card,html[data-theme="dark"][data-soc="tek"] .dd-bx,html[data-theme="dark"][data-soc="tek"] .dd-jp{background:#12262e;}
html[data-theme="dark"][data-soc="tek"] .bottomnav{background:rgba(18,38,46,.92);}
html[data-theme="dark"][data-soc="tek"] .bottomnav button.active{color:#fff;}
html[data-theme="dark"][data-soc="tek"] .bottomnav button.active svg{color:#fff;background:none;}
html[data-soc="tek"] .hero-card{background:radial-gradient(320px 200px at 95% 0%,rgba(23,149,159,.55),transparent 70%),linear-gradient(135deg,#06323C 0%,#0A4D5C 55%,#0E6A78 100%);-webkit-backdrop-filter:none;backdrop-filter:none;filter:none;}
html[data-soc="tek"] .bottomnav button{font-size:10.5px;}
html[data-soc="tek"] .bottomnav button.active{background:linear-gradient(135deg,#17959F,#006070);}
html[data-theme="dark"][data-soc="tek"] .card,html[data-theme="dark"][data-soc="tek"] .dd-jp,html[data-theme="dark"][data-soc="tek"] .dd-bx{background:linear-gradient(160deg,color-mix(in srgb,var(--c,#17959F) 14%,#12262e) 0%,#12262e 75%);color:var(--ink);}
html[data-theme="dark"][data-soc="tek"] .card{background:#12262e;}
html[data-theme="dark"][data-soc="tek"] main h2,html[data-theme="dark"][data-soc="tek"] .hero-date h2{color:#E6EBF3 !important;}
html[data-theme="dark"][data-soc="tek"] .field input,html[data-theme="dark"][data-soc="tek"] .field select,html[data-theme="dark"][data-soc="tek"] .field textarea{background:#183440;border-color:#244552;color:var(--ink);}
html[data-theme="dark"][data-soc="tek"] .btn-primary{background:linear-gradient(135deg,#17959F,#006070);color:#fff;}
html[data-theme="dark"][data-soc="tek"] .topbar,html[data-theme="dark"][data-soc="tek"] .deepbar{background:radial-gradient(260px 120px at 90% 0%,rgba(242,169,59,.25),transparent 70%),linear-gradient(135deg,#074652 0%,#04252D 100%);}
`;
  document.head.appendChild(st);
})();
// Vue direction : indicateurs plus compacts
(function(){
  const s=document.createElement('style');
  s.textContent=`
html[data-theme] .dd-jauges4,html[data-theme] .dd-boites{gap:8px;margin-bottom:12px;}
html[data-theme] .dd-jp{padding:10px 10px 9px;border-radius:16px;}
html[data-theme] .dd-jp-t{font-size:9.5px;margin:0 0 5px;letter-spacing:.04em;}
html[data-theme] .dd-jp-svg{width:44px;height:44px;}
html[data-theme] .dd-jp-r{gap:8px;}
html[data-theme] .dd-jp-v{font-size:22px;}
html[data-theme] .dd-jp-v small{font-size:11px;}
html[data-theme] .dd-jp-s{margin-top:6px;padding:2px 8px;font-size:9.5px;}
html[data-theme] .dd-bx{padding:9px 10px 9px 14px;border-radius:14px;}
html[data-theme] .dd-bx::before{top:10px;bottom:10px;width:3px;}
html[data-theme] .dd-bx-l{font-size:9px;margin:0 0 3px;letter-spacing:.04em;}
html[data-theme] .dd-bx-v{font-size:20px;}
html[data-theme] .dd-bx-v small{font-size:11px;}
`;
  document.head.appendChild(s);
})();
