// Société du module ouvert : attribut data-soc="tek" | "gadh" | "mgt" sur <html> (accent de la charte, voir charte.css).
(function(){
  const st = document.createElement('style');
  // Les couleurs sont dans charte.css (couleur de la société en accent seulement). Ici : rien d'autre.
  st.textContent = '';
  document.head.appendChild(st);
  const quelle = () => { if(typeof activeModule === 'undefined' || !document.getElementById('main')) return '';
    if(activeModule === 'mgt') return 'mgt';
    if(activeModule === 'gadh' || activeModule === 'gadh-tableau' || ((activeModule === 'factures' || activeModule === 'machines') && typeof activeSociete !== 'undefined' && activeSociete === 'gadh')) return 'gadh'; // Modules TEK-TREND : aucun habillage, apparence de l'application Gestion Rendement d'origine.
    if(typeof activeSociete !== 'undefined' && activeSociete === 'tek') return 'tek';
    return ''; };
  const meta0 = (document.querySelector('meta[name="theme-color"]')||{}).content;
  const sync = () => { try { const mt = document.querySelector('meta[name="theme-color"]'); if(mt){ const w0 = quelle(); mt.content = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0A111D' : '#0F1B2D'; void w0; void meta0; } const w = quelle(), r = document.documentElement; const app = !!(document.getElementById('main') && typeof gtmStyleApp === 'function' && gtmStyleApp()); if(r.hasAttribute('data-style-app') !== app){ if(app) r.setAttribute('data-style-app', ''); else r.removeAttribute('data-style-app'); } if(typeof themeAppliquer === 'function' && typeof themeActuel === 'function'){ const voulu = app ? 'light' : themeActuel(); if(r.getAttribute('data-theme') !== voulu) themeAppliquer(themeActuel()); } if(w){ if(r.getAttribute('data-soc') !== w) r.setAttribute('data-soc', w); } else if(r.hasAttribute('data-soc')) r.removeAttribute('data-soc'); } catch(e) {} };
  ['nav', 'renderShell', 'chooseModule', 'chooseSociete'].forEach(n => { const f = window[n]; if(typeof f === 'function') window[n] = function(){ const r = f.apply(this, arguments); sync(); return r; }; });
  setInterval(sync, 600); sync();
})();
