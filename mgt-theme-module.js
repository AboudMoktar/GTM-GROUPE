// MGT — habillage aux couleurs du logo (rouille / orange), à la place du bleu des autres sociétés.
// Actif seulement dans le module MGT : l'attribut data-soc="mgt" est posé sur <html>.
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
html[data-theme="dark"][data-soc="mgt"]{--accent:#E8602A;--accent-2:#F07A44;--accent-bg:#3A1D13;}
html[data-theme="dark"][data-soc="mgt"] .btn-primary{background:#C2410C;color:#fff;}
html[data-theme="dark"][data-soc="mgt"] .topbar{background:linear-gradient(120deg,#1B0D07 0%,#34170A 100%);}
`;
  document.head.appendChild(st);
  const sync = () => { try { const on = typeof activeModule !== 'undefined' && activeModule === 'mgt' && !!document.getElementById('main'); const r = document.documentElement; if(on) { if(r.getAttribute('data-soc') !== 'mgt') r.setAttribute('data-soc', 'mgt'); } else if(r.hasAttribute('data-soc')) r.removeAttribute('data-soc'); } catch(e) {} };
  ['nav', 'renderShell', 'chooseModule', 'chooseSociete'].forEach(n => { const f = window[n]; if(typeof f === 'function') window[n] = function(){ const r = f.apply(this, arguments); sync(); return r; }; });
  setInterval(sync, 600); sync();
})();
