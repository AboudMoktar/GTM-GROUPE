// MGT (rouille) et GADH (prune, or et turquoise du logo) : habillage aux couleurs du logo, à la place du bleu de TEK-TREND.
// L'attribut data-soc="mgt" ou "gadh" est posé sur <html> seulement dans le module concerné.
(function(){
  const st = document.createElement('style');
  st.textContent = `
html[data-soc="mgt"]{--accent:#B53802;--accent-2:#D4470A;--accent-bg:#FBEEE8;}
html[data-soc="mgt"] .btn-primary{box-shadow:0 2px 8px rgba(181,56,2,.28);}
html[data-soc="mgt"] .topbar,html[data-soc="mgt"] .deepbar{background:linear-gradient(120deg,#2A130A 0%,#4A200E 100%);}
html[data-soc="mgt"] .topbar .tek{color:#FF9A62;}
html[data-soc="mgt"] .sidebar{background:#2A130A;}
html[data-soc="mgt"] .hero-card{background:linear-gradient(100deg,rgba(181,56,2,.97) 0%,rgba(181,56,2,.75) 45%,rgba(181,56,2,.35) 100%),url('./hero-bg.jpg');background-size:cover;}
html[data-soc="mgt"] .field input:focus,html[data-soc="mgt"] .input-cell input:focus,html[data-soc="mgt"] .mgt-in:focus{border-color:var(--accent-2);box-shadow:0 0 0 3px var(--accent-bg);}
html[data-soc="mgt"] .fc-t th{background:#8F2C02;}
html[data-soc="gadh"]{--accent:#8B1F4B;--accent-2:#A8325F;--accent-bg:#F7ECF1;}
html[data-soc="gadh"] .btn-primary{box-shadow:0 2px 8px rgba(139,31,75,.28);}
html[data-soc="gadh"] .topbar,html[data-soc="gadh"] .deepbar{background:linear-gradient(120deg,#8B1F4B 0%,#6B1538 100%);border-bottom:3px solid #CFA824;}
html[data-soc="gadh"] .topbar .tek{color:#CFA824;}
html[data-soc="gadh"] .btn-primary{border-bottom:3px solid #CFA824;box-shadow:0 2px 8px rgba(139,31,75,.3);}
html[data-soc="gadh"] .bottomnav .active,html[data-soc="gadh"] .bottomnav .on{color:#CFA824;}
html[data-soc="gadh"] .sidebar{background:#6B1538;}
html[data-soc="gadh"] .hero-card{background:linear-gradient(100deg,rgba(139,31,75,.97) 0%,rgba(139,31,75,.75) 45%,rgba(139,31,75,.35) 100%),url('./hero-bg.jpg');background-size:cover;}
html[data-soc="gadh"] .field input:focus,html[data-soc="gadh"] .input-cell input:focus{border-color:#058A9E;box-shadow:0 0 0 3px rgba(5,138,158,.18);}
html[data-soc="gadh"] .fc-t th{background:#6B1538;}
html[data-theme="dark"][data-soc="gadh"]{--accent:#D4588A;--accent-2:#E57BA6;--accent-bg:#3A1426;}
html[data-theme="dark"][data-soc="gadh"] .btn-primary{background:#A8325F;color:#fff;}
html[data-theme="dark"][data-soc="gadh"] .topbar{background:linear-gradient(120deg,#4A0F27 0%,#3A0C1F 100%);}

html[data-soc="gadh"]{--bg:#FAF6EF;--surface-2:#F6EFE3;--surface-3:#F0E6D6;--border:#E8DCC8;--border-soft:#F0E6D6;}
html[data-soc="gadh"] .topbar,html[data-soc="gadh"] .deepbar{border-bottom:0;background:linear-gradient(90deg,#CFA824 0 34%,#058A9E 34% 67%,#C2477A 67% 100%) left bottom/100% 4px no-repeat,linear-gradient(120deg,#8B1F4B 0%,#5E1032 100%);padding-bottom:13px;}
html[data-soc="gadh"] .btn-primary{background:linear-gradient(145deg,#A8325F 0%,#7A1740 100%);border-radius:13px;border-bottom:3px solid #CFA824;}
html[data-soc="gadh"] .card{border:1px solid var(--border);border-top:3px solid #8B1F4B;border-radius:16px;}
html[data-soc="gadh"] main .card:nth-child(3n+2){border-top-color:#CFA824;}
html[data-soc="gadh"] main .card:nth-child(3n+3){border-top-color:#058A9E;}
html[data-soc="gadh"] main h2{font-weight:800;letter-spacing:-.02em;}
html[data-soc="gadh"] main h2::after{content:'';display:block;width:38px;height:4px;border-radius:3px;background:linear-gradient(90deg,#CFA824,#058A9E);margin-top:6px;}
html[data-soc="gadh"] .dd-jp:nth-child(4n+1){--c:#8B1F4B;}
html[data-soc="gadh"] .dd-jp:nth-child(4n+2){--c:#CFA824;}
html[data-soc="gadh"] .dd-jp:nth-child(4n+3){--c:#058A9E;}
html[data-soc="gadh"] .dd-jp:nth-child(4n+4){--c:#C2477A;}
html[data-soc="gadh"] .dd-bx{border-radius:14px;border-width:0 0 0 5px;border-style:solid;box-shadow:0 2px 10px rgba(94,16,50,.08);text-align:left;padding-left:14px;}
html[data-soc="gadh"] .dd-bx:nth-child(3n+1){border-color:#8B1F4B;}
html[data-soc="gadh"] .dd-bx:nth-child(3n+2){border-color:#CFA824;}
html[data-soc="gadh"] .dd-bx:nth-child(3n+3){border-color:#058A9E;}
html[data-soc="gadh"] .dd-bx-bad{border-color:#E5484D !important;}
html[data-soc="gadh"] .bottomnav{background:#fff;border-top:0;box-shadow:0 -6px 20px rgba(94,16,50,.10);}
html[data-soc="gadh"] .bottomnav button.active{color:#8B1F4B;font-weight:800;}
html[data-soc="gadh"] .bottomnav button.active::before{background:#CFA824;width:34px;height:4px;}
html[data-soc="gadh"] .bottomnav button.active svg{background:#F7ECF1;border-radius:12px;padding:5px 12px;width:44px;height:30px;box-sizing:border-box;color:#8B1F4B;}
html[data-soc="gadh"] .bottomnav .active,html[data-soc="gadh"] .bottomnav .on{color:#8B1F4B;}
html[data-soc="gadh"] .badge,html[data-soc="gadh"] .chip.on{background:#CFA824;color:#3A2A00;}
html[data-theme="dark"][data-soc="gadh"]{--bg:#17101A;--surface-2:#241826;--surface-3:#2E1F31;--border:#3D2B40;--border-soft:#2E1F31;}
html[data-theme="dark"][data-soc="gadh"] .bottomnav{background:#241826;}
html[data-theme="dark"][data-soc="gadh"] .bottomnav button.active{color:#E8C24A;}
html[data-theme="dark"][data-soc="gadh"] .bottomnav button.active svg{background:#3A1426;color:#E8C24A;}

html[data-soc="gadh"] body{background:radial-gradient(800px 380px at 105% -5%,rgba(207,168,36,.16),transparent 60%),radial-gradient(700px 420px at -10% 25%,rgba(5,138,158,.11),transparent 60%),#FAF7F2;background-attachment:fixed;}
html[data-soc="gadh"] .topbar,html[data-soc="gadh"] .deepbar{background:radial-gradient(260px 120px at 90% 0%,rgba(207,168,36,.35),transparent 70%),linear-gradient(135deg,#9A2455 0%,#5E1032 100%);border-radius:0 0 26px 26px;padding-bottom:12px;box-shadow:0 14px 30px -14px rgba(94,16,50,.55);}
html[data-soc="gadh"] .card{border:1px solid rgba(139,31,75,.06);border-top:1px solid rgba(139,31,75,.06);border-radius:22px;box-shadow:0 14px 34px -18px rgba(94,16,50,.28);padding:14px;}
html[data-soc="gadh"] main .card:nth-child(3n+2),html[data-soc="gadh"] main .card:nth-child(3n+3){border-top-color:rgba(139,31,75,.06);}
html[data-soc="gadh"] .dd-jp{border-radius:24px;border:0;box-shadow:0 16px 34px -20px color-mix(in srgb,var(--c) 70%,#000);background:linear-gradient(155deg,color-mix(in srgb,var(--c) 16%,#fff) 0%,#fff 65%);}
html[data-soc="gadh"] .dd-bx{border:0;border-radius:20px;text-align:left;padding:14px 16px;background:linear-gradient(160deg,color-mix(in srgb,var(--c,#8B1F4B) 14%,#fff) 0%,#fff 70%);box-shadow:0 12px 26px -18px color-mix(in srgb,var(--c,#8B1F4B) 80%,#000);}
html[data-soc="gadh"] .dd-bx:nth-child(3n+1){--c:#8B1F4B;}
html[data-soc="gadh"] .dd-bx:nth-child(3n+2){--c:#CFA824;}
html[data-soc="gadh"] .dd-bx:nth-child(3n+3){--c:#058A9E;}
html[data-soc="gadh"] .dd-bx-v{font-weight:800;color:var(--c,#8B1F4B);}
html[data-soc="gadh"] .dd-bx-l{text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);}
html[data-soc="gadh"] .btn-primary{background:linear-gradient(135deg,#B03466 0%,#7A1740 100%);border:0;border-radius:16px;box-shadow:0 10px 22px -10px rgba(139,31,75,.75),inset 0 -3px 0 rgba(207,168,36,.9);}
html[data-soc="gadh"] .field input,html[data-soc="gadh"] .field select,html[data-soc="gadh"] .field textarea{border-radius:14px;background:#fff;border:1.5px solid #EADFCE;}
html[data-soc="gadh"] main{padding-bottom:104px;}
html[data-soc="gadh"] .bottomnav{left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom));border-radius:26px;background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(139,31,75,.08);box-shadow:0 18px 40px -12px rgba(94,16,50,.45);padding:5px;gap:2px;}
html[data-soc="gadh"] .bottomnav button{border-radius:20px;min-height:50px;}
html[data-soc="gadh"] .bottomnav button.active{background:linear-gradient(135deg,#A8325F,#6B1538);color:#fff;box-shadow:0 8px 16px -8px rgba(139,31,75,.8);}
html[data-soc="gadh"] .bottomnav button.active::before{display:none;}
html[data-soc="gadh"] .bottomnav button.active::after{content:'';position:absolute;bottom:3px;width:5px;height:5px;border-radius:50%;background:#CFA824;}
html[data-soc="gadh"] .bottomnav button.active svg{background:none;padding:0;width:20px;height:20px;color:#fff;}
html[data-soc="gadh"] .bottomnav .active,html[data-soc="gadh"] .bottomnav .on{color:#fff;}
html[data-theme="dark"][data-soc="gadh"] body{background:radial-gradient(800px 380px at 105% -5%,rgba(207,168,36,.12),transparent 60%),#17101A;}
html[data-theme="dark"][data-soc="gadh"] .card,html[data-theme="dark"][data-soc="gadh"] .dd-bx,html[data-theme="dark"][data-soc="gadh"] .dd-jp{background:#241826;}
html[data-theme="dark"][data-soc="gadh"] .bottomnav{background:rgba(36,24,38,.92);}
html[data-theme="dark"][data-soc="gadh"] .bottomnav button.active{color:#fff;}
html[data-theme="dark"][data-soc="gadh"] .bottomnav button.active svg{color:#fff;background:none;}

/* ===== GADH — thème clair aux couleurs du bas du logo (reflets rose, jaune et turquoise pâles) =====
   Rose #C2336F · olive #A69C10 · turquoise #13939C ; fonds pâles #F8E4EC / #F6F3D6 / #DCEFF1.
   Remplace l'habillage prune foncé dans le thème clair ; le thème sombre garde le sien. */
html[data-soc="gadh"]:not([data-theme="dark"]){--accent:#B62E68;--accent-2:#C2336F;--accent-bg:#F8E4EC;--bg:#FBFAF8;--surface-2:#F7F5F1;--surface-3:#F0EDE7;--border:#E9E4DC;--border-soft:#F1EDE6;--ink:#2B2F36;}
html[data-soc="gadh"]:not([data-theme="dark"]) body{background:linear-gradient(180deg,rgba(248,228,236,.55) 0%,rgba(246,243,214,.35) 38%,rgba(220,239,241,.35) 100%),#FBFAF8;background-attachment:fixed;}
html[data-soc="gadh"]:not([data-theme="dark"]) .topbar,
html[data-soc="gadh"]:not([data-theme="dark"]) .deepbar{background:linear-gradient(90deg,#C2346E 0 33.3%,#C5BA3C 33.3% 66.6%,#138C94 66.6% 100%) left bottom/100% 3px no-repeat,linear-gradient(100deg,#F1D6E0 0%,#F2EFCD 52%,#CFE8EA 100%)!important;color:#2B2F36!important;border-radius:0 0 22px 22px;box-shadow:0 10px 24px -16px rgba(43,47,54,.35)!important;border-bottom:0!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .topbar *:not(svg):not(path):not(.notif-count):not(.sync-badge):not(.sync-badge *){color:#2B2F36;}
html[data-soc="gadh"]:not([data-theme="dark"]) .topbar button,
html[data-soc="gadh"]:not([data-theme="dark"]) .topbar .user-menu-btn,
html[data-soc="gadh"]:not([data-theme="dark"]) .deepbar button{background:rgba(255,255,255,.78)!important;color:#2B2F36!important;border:1px solid rgba(43,47,54,.08)!important;box-shadow:0 2px 6px -3px rgba(43,47,54,.25);}
html[data-soc="gadh"]:not([data-theme="dark"]) .topbar svg,
html[data-soc="gadh"]:not([data-theme="dark"]) .deepbar svg{color:#2B2F36;stroke:currentColor;}
html[data-soc="gadh"]:not([data-theme="dark"]) .deepbar .deep-titre{color:#2B2F36!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .card{background:#fff;border:1px solid #EFEAE3!important;border-radius:20px;box-shadow:0 10px 26px -20px rgba(43,47,54,.35)!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) main h2{color:#2B2F36;}
html[data-soc="gadh"]:not([data-theme="dark"]) main h2::after{background:linear-gradient(90deg,#C2336F 0 33%,#C9BF2A 33% 66%,#13939C 66%);}
html[data-soc="gadh"]:not([data-theme="dark"]) .btn-primary{background:#C2336F!important;color:#fff!important;border:0!important;border-radius:14px;box-shadow:0 8px 18px -10px rgba(194,51,111,.7)!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .btn-primary:hover{background:#B02A62!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .dd-jp:nth-child(4n+1),html[data-soc="gadh"]:not([data-theme="dark"]) .dd-bx:nth-child(3n+1){--c:#C2336F;}
html[data-soc="gadh"]:not([data-theme="dark"]) .dd-jp:nth-child(4n+2),html[data-soc="gadh"]:not([data-theme="dark"]) .dd-bx:nth-child(3n+2){--c:#8F870C;}
html[data-soc="gadh"]:not([data-theme="dark"]) .dd-jp:nth-child(4n+3),html[data-soc="gadh"]:not([data-theme="dark"]) .dd-bx:nth-child(3n+3){--c:#0F7F87;}
html[data-soc="gadh"]:not([data-theme="dark"]) .dd-jp:nth-child(4n+4){--c:#C2336F;}
html[data-soc="gadh"]:not([data-theme="dark"]) .dd-jp,html[data-soc="gadh"]:not([data-theme="dark"]) .dd-bx{box-shadow:0 10px 24px -20px rgba(43,47,54,.45)!important;border:1px solid color-mix(in srgb,var(--c,#C2336F) 14%,#fff)!important;background:linear-gradient(160deg,color-mix(in srgb,var(--c,#C2336F) 9%,#fff) 0%,#fff 70%)!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .bottomnav{background:rgba(255,255,255,.94)!important;border:1px solid #EFEAE3!important;box-shadow:0 14px 34px -14px rgba(43,47,54,.35)!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .bottomnav button{color:#5B616B!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .bottomnav button.active{background:#F8E4EC!important;color:#A8285F!important;box-shadow:none!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .bottomnav button.active svg{color:#A8285F!important;}
html[data-soc="gadh"]:not([data-theme="dark"]) .bottomnav button.active::after{background:#C9BF2A;}
html[data-soc="gadh"]:not([data-theme="dark"]) .chip.on,html[data-soc="gadh"]:not([data-theme="dark"]) .badge{background:#F6F3D6;color:#5E5806;}
@media (min-width:1024px){
  html[data-soc="gadh"]:not([data-theme="dark"]) .sidebar{background:linear-gradient(180deg,#FCF1F5 0%,#FBFAEF 50%,#EEF7F8 100%)!important;border-right:1px solid #EFEAE3!important;}
  html[data-soc="gadh"]:not([data-theme="dark"]) .sidebar nav button{color:#4A4F57!important;}
  html[data-soc="gadh"]:not([data-theme="dark"]) .sidebar nav button.active{background:#F8E4EC!important;color:#A8285F!important;}
  html[data-soc="gadh"]:not([data-theme="dark"]) .sidebar .side-sep{background:#EFEAE3;}
  html[data-soc="gadh"]:not([data-theme="dark"]) .topbar{border-radius:0;}
}
html[data-theme="dark"][data-soc="mgt"]{--accent:#E8602A;--accent-2:#F07A44;--accent-bg:#3A1D13;}
html[data-theme="dark"][data-soc="mgt"] .btn-primary{background:#C2410C;color:#fff;}
html[data-theme="dark"][data-soc="mgt"] .topbar{background:linear-gradient(120deg,#1B0D07 0%,#34170A 100%);}
`;
  document.head.appendChild(st);
  const quelle = () => { if(typeof activeModule === 'undefined' || !document.getElementById('main')) return '';
    if(activeModule === 'mgt') return 'mgt';
    if(activeModule === 'gadh' || activeModule === 'gadh-tableau' || ((activeModule === 'factures' || activeModule === 'machines') && typeof activeSociete !== 'undefined' && activeSociete === 'gadh')) return 'gadh'; if(typeof activeSociete === 'undefined' || !activeSociete || activeSociete === 'tek') return 'tek'; return ''; };
  const meta0 = (document.querySelector('meta[name="theme-color"]')||{}).content;
  const sync = () => { try { const mt = document.querySelector('meta[name="theme-color"]'); if(mt){ const w0 = quelle(); mt.content = w0 === 'gadh' ? (document.documentElement.getAttribute('data-theme') === 'dark' ? '#5E1032' : '#F8E4EC') : w0 === 'tek' ? '#06323C' : w0 === 'mgt' ? '#2A130A' : (meta0 || mt.content); } const w = quelle(), r = document.documentElement; if(w){ if(r.getAttribute('data-soc') !== w) r.setAttribute('data-soc', w); } else if(r.hasAttribute('data-soc')) r.removeAttribute('data-soc'); } catch(e) {} };
  ['nav', 'renderShell', 'chooseModule', 'chooseSociete'].forEach(n => { const f = window[n]; if(typeof f === 'function') window[n] = function(){ const r = f.apply(this, arguments); sync(); return r; }; });
  setInterval(sync, 600); sync();
})();
