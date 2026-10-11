// MGT (rouille) et GADH (bordeaux, avec or et turquoise du logo) : habillage aux couleurs du logo, à la place du bleu de TEK-TREND.
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
html[data-soc="gadh"]{--accent:#781230;--accent-2:#9C1F45;--accent-bg:#F8ECEF;}
html[data-soc="gadh"] .btn-primary{box-shadow:0 2px 8px rgba(120,18,48,.28);}
html[data-soc="gadh"] .topbar,html[data-soc="gadh"] .deepbar{background:linear-gradient(120deg,#2A0A14 0%,#4A1024 100%);}
html[data-soc="gadh"] .topbar .tek{color:#E3B52B;}
html[data-soc="gadh"] .sidebar{background:#2A0A14;}
html[data-soc="gadh"] .hero-card{background:linear-gradient(100deg,rgba(120,18,48,.97) 0%,rgba(120,18,48,.75) 45%,rgba(120,18,48,.35) 100%),url('./hero-bg.jpg');background-size:cover;}
html[data-soc="gadh"] .field input:focus,html[data-soc="gadh"] .input-cell input:focus{border-color:var(--accent-2);box-shadow:0 0 0 3px var(--accent-bg);}
html[data-soc="gadh"] .fc-t th{background:#5E0E26;}
html[data-theme="dark"][data-soc="gadh"]{--accent:#D6456F;--accent-2:#E5688A;--accent-bg:#3A1220;}
html[data-theme="dark"][data-soc="gadh"] .btn-primary{background:#A81C48;color:#fff;}
html[data-theme="dark"][data-soc="gadh"] .topbar{background:linear-gradient(120deg,#1B070E 0%,#340F1D 100%);}
html[data-theme="dark"][data-soc="mgt"]{--accent:#E8602A;--accent-2:#F07A44;--accent-bg:#3A1D13;}
html[data-theme="dark"][data-soc="mgt"] .btn-primary{background:#C2410C;color:#fff;}
html[data-theme="dark"][data-soc="mgt"] .topbar{background:linear-gradient(120deg,#1B0D07 0%,#34170A 100%);}
`;
  document.head.appendChild(st);
  const quelle = () => { if(typeof activeModule === 'undefined' || !document.getElementById('main')) return '';
    if(activeModule === 'mgt') return 'mgt';
    if(activeModule === 'gadh' || ((activeModule === 'factures' || activeModule === 'machines') && typeof activeSociete !== 'undefined' && activeSociete === 'gadh')) return 'gadh'; return ''; };
  const sync = () => { try { const w = quelle(), r = document.documentElement; if(w){ if(r.getAttribute('data-soc') !== w) r.setAttribute('data-soc', w); } else if(r.hasAttribute('data-soc')) r.removeAttribute('data-soc'); } catch(e) {} };
  ['nav', 'renderShell', 'chooseModule', 'chooseSociete'].forEach(n => { const f = window[n]; if(typeof f === 'function') window[n] = function(){ const r = f.apply(this, arguments); sync(); return r; }; });
  setInterval(sync, 600); sync();
})();
