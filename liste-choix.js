/* =====================================================================
   GTM — LISTES DE CHOIX (26/11/2026)
   Les champs « à suggestions » (<input list="…"> + <datalist>) n'ouvrent pas leur liste quand on touche la flèche
   sur Android (Chrome) : rien ne s'affiche. Ce script remplace, PARTOUT (application, CRM MGT, suivi des commandes),
   la liste du navigateur par une liste maison qui s'ouvre au toucher, se filtre pendant la saisie (sans accents ni
   majuscules) et fonctionne au doigt, à la souris et au clavier. Les valeurs restent celles du <datalist> d'origine
   (lues à chaque ouverture) et la saisie libre reste possible. Aucune donnée.
   ===================================================================== */
(function(){
  'use strict';
  if(window.__gtmListeChoix) return; window.__gtmListeChoix = 1;
  var MAX = 120, pan = null, champ = null, actif = -1, items = [];
  function norm(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function css(){
    if(document.getElementById('lc-style')) return;
    var st = document.createElement('style'); st.id = 'lc-style';
    st.textContent = '.lc-champ{background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%) !important;background-position:calc(100% - 17px) 52%,calc(100% - 12px) 52% !important;background-size:5px 5px,5px 5px !important;background-repeat:no-repeat !important;padding-right:30px !important;}'
      + '.lc-panneau{position:fixed;z-index:2147483000;max-height:min(46vh,340px);overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;color:#111827;border:1px solid #cfd6e0;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.22);padding:4px;font:15px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}'
      + '.lc-panneau[hidden]{display:none}.lc-opt{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:11px 12px;min-height:44px;border-radius:8px;cursor:pointer;}'
      + '.lc-opt small{display:block;color:#6b7280;font-size:12px;margin-top:2px}.lc-opt.on,.lc-opt:hover{background:#e8f0fe}.lc-vide{padding:11px 12px;color:#6b7280;font-size:13.5px}.lc-plus{padding:8px 12px;color:#6b7280;font-size:12px}'
      + 'html[data-theme="dark"] .lc-panneau,body.dark .lc-panneau,body.theme-dark .lc-panneau{background:#1b2129;color:#e8edf3;border-color:#2c3440}html[data-theme="dark"] .lc-opt small{color:#9aa5b4}html[data-theme="dark"] .lc-opt.on,html[data-theme="dark"] .lc-opt:hover{background:#26324a}'
      + '@media (prefers-color-scheme:dark){.lc-sombre .lc-panneau{background:#1b2129;color:#e8edf3;border-color:#2c3440}}';
    (document.head || document.documentElement).appendChild(st);
  }
  /* un champ à liste : on retient sa liste et on retire l'attribut list (sinon le navigateur ouvre aussi la sienne) */
  function equiper(inp){
    if(!inp || inp.__lc || inp.tagName !== 'INPUT') return;
    var id = inp.getAttribute('list'); if(!id) return;
    inp.__lc = 1; inp.setAttribute('data-lc-liste', id); inp.removeAttribute('list'); inp.classList.add('lc-champ');
    if(!inp.getAttribute('autocomplete')) inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-autocomplete', 'list'); inp.setAttribute('aria-expanded', 'false');
  }
  function balayer(r){ try{ (r || document).querySelectorAll('input[list]').forEach(equiper); }catch(e){} }
  function options(inp){
    var dl = document.getElementById(inp.getAttribute('data-lc-liste')); if(!dl) return [];
    var vus = {}, out = [];
    [].forEach.call(dl.querySelectorAll('option'), function(o){ var v = o.value != null && o.value !== '' ? o.value : o.textContent; if(v == null || v === '' || vus[v]) return; vus[v] = 1;
      var l = o.label && o.label !== v ? o.label : (o.textContent && o.textContent.trim() !== v ? o.textContent.trim() : ''); out.push({v:String(v), l:l}); });
    return out;
  }
  function placer(){
    if(!pan || !champ) return; var r = champ.getBoundingClientRect(), H = window.innerHeight, bas = H - r.bottom, haut = r.top;
    pan.style.left = Math.max(6, Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 6)) + 'px'; pan.style.width = Math.max(r.width, 220) + 'px';
    if(bas < 180 && haut > bas){ pan.style.top = ''; pan.style.bottom = (H - r.top + 4) + 'px'; pan.style.maxHeight = Math.min(340, haut - 12) + 'px'; }
    else { pan.style.bottom = ''; pan.style.top = (r.bottom + 4) + 'px'; pan.style.maxHeight = Math.min(340, Math.max(140, bas - 12)) + 'px'; }
  }
  function fermer(){ if(pan){ pan.hidden = true; pan.innerHTML = ''; } if(champ) champ.setAttribute('aria-expanded', 'false'); champ = null; actif = -1; items = []; }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function afficher(inp, tout){
    css(); if(!pan){ pan = document.createElement('div'); pan.className = 'lc-panneau'; pan.setAttribute('role', 'listbox'); pan.hidden = true; document.body.appendChild(pan);
      pan.addEventListener('pointerdown', function(e){ e.preventDefault(); });   // garder le focus dans le champ
      pan.addEventListener('mousedown', function(e){ e.preventDefault(); });
      pan.addEventListener('click', function(e){ var b = e.target.closest('.lc-opt'); if(b) choisir(+b.getAttribute('data-i')); }); }
    champ = inp; var L = options(inp), q = norm(inp.value);
    var exact = L.some(function(o){ return norm(o.v) === q; });
    items = (tout || !q || exact) ? L : L.filter(function(o){ return norm(o.v).indexOf(q) >= 0 || norm(o.l).indexOf(q) >= 0; });
    if(!L.length){ fermer(); return; }
    var vis = items.slice(0, MAX);
    pan.innerHTML = vis.length ? vis.map(function(o, i){ return '<button type="button" tabindex="-1" role="option" class="lc-opt" data-i="' + i + '">' + esc(o.v) + (o.l ? '<small>' + esc(o.l) + '</small>' : '') + '</button>'; }).join('')
      + (items.length > MAX ? '<div class="lc-plus">… ' + (items.length - MAX) + ' autre(s) : tapez quelques lettres pour filtrer</div>' : '')
      : '<div class="lc-vide">Aucun choix ne correspond : la saisie libre est gardée.</div>';
    actif = -1; pan.hidden = false; inp.setAttribute('aria-expanded', 'true'); placer();
  }
  function choisir(i){
    var o = items[i], inp = champ; if(!o || !inp) return;
    var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, o.v);
    inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true}));
    fermer();
  }
  function surligner(n){ var b = pan ? pan.querySelectorAll('.lc-opt') : []; if(!b.length) return; actif = (n + b.length) % b.length;
    [].forEach.call(b, function(x, k){ x.classList.toggle('on', k === actif); }); b[actif].scrollIntoView({block:'nearest'}); }
  var cible = function(e){ var t = e.target; return t && t.tagName === 'INPUT' && t.hasAttribute('data-lc-liste') && !t.disabled && !t.readOnly ? t : null; };
  document.addEventListener('focusin', function(e){ var t = cible(e); if(t) afficher(t, true); }, true);
  document.addEventListener('click', function(e){ var t = cible(e); if(t){ if(!pan || pan.hidden || champ !== t) afficher(t, true); return; }
    if(pan && !pan.hidden && !pan.contains(e.target)) fermer(); }, true);
  document.addEventListener('input', function(e){ var t = cible(e); if(t && e.isTrusted !== false && (!pan || pan.hidden || champ === t || !champ)) afficher(t, false); }, true);
  document.addEventListener('focusout', function(e){ var t = cible(e); if(t && t === champ) setTimeout(function(){ if(champ === t && document.activeElement !== t) fermer(); }, 160); }, true);
  document.addEventListener('keydown', function(e){ var t = cible(e); if(!t) return;
    if(e.key === 'ArrowDown'){ if(!pan || pan.hidden) afficher(t, true); else surligner(actif + 1); e.preventDefault(); }
    else if(e.key === 'ArrowUp' && pan && !pan.hidden){ surligner(actif - 1); e.preventDefault(); }
    else if(e.key === 'Enter' && pan && !pan.hidden && actif >= 0){ choisir(actif); e.preventDefault(); e.stopPropagation(); }
    else if(e.key === 'Escape' && pan && !pan.hidden){ fermer(); e.stopPropagation(); } }, true);
  window.addEventListener('resize', placer); window.addEventListener('scroll', function(e){ if(pan && !pan.hidden && !(e.target && pan.contains && e.target.nodeType === 1 && pan.contains(e.target))) placer(); }, true);
  function demarrer(){ balayer(document); new MutationObserver(function(ms){ for(var i = 0; i < ms.length; i++){ var m = ms[i];
      if(m.type === 'attributes'){ if(m.target.tagName === 'INPUT' && m.target.hasAttribute('list')){ m.target.__lc = 0; equiper(m.target); } continue; }
      for(var j = 0; j < m.addedNodes.length; j++){ var n = m.addedNodes[j]; if(n.nodeType !== 1) continue; if(n.tagName === 'INPUT') equiper(n); else if(n.querySelector && n.querySelector('input[list]')) balayer(n); } }
      if(champ && !document.documentElement.contains(champ)) fermer(); })
    .observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['list']}); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  window.GTM_LISTE_CHOIX = {equiper:equiper, balayer:balayer, fermer:fermer, ouvrir:function(inp){ equiper(inp); afficher(inp, true); }};
})();
