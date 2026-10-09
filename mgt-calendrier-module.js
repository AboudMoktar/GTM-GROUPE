// Calendrier commercial MGT : vues Jour / Semaine / Mois inspirées du calendrier Apple, sans défilement horizontal.
// Les données restent celles du planning existant (client.planning + actions générées) ; heure et durée sont facultatives.
const CAL = {vue:'mois', ref:'', q:'', rech:false};
const CAL_COULEURS = {visite:'#0a84ff', appel:'#30b455', offre:'#ff9f0a', sav:'#ff453a', recouvrement:'#bf5af2', rappel:'#ff375f', fournisseur:'#5e5ce6', transit:'#5e5ce6', administr:'#8e8e93', document:'#8e8e93', rapport:'#8e8e93', calcul:'#8e8e93', redaction:'#64d2ff', email:'#64d2ff', recapitulatif:'#8e8e93'};
const CAL_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const CAL_MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const CAL_JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
function calCouleur(a){ const t = crmNorm(a.type || ''); for(const k in CAL_COULEURS) if(t.includes(k)) return CAL_COULEURS[k]; return '#2ec4b6'; }
function calISO(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function calDate(iso){ const [y, m, j] = iso.split('-').map(Number); return new Date(y, m - 1, j); }
function calAjouterJours(iso, n){ const d = calDate(iso); d.setDate(d.getDate() + n); return calISO(d); }
function calDebutSemaine(iso){ const d = calDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return calISO(d); }
function calMin(h){ const m = /^(\d{1,2}):(\d{2})/.exec(h || ''); return m ? Math.min(+m[1] * 60 + +m[2], 1439) : null; }
function calHeure(min){ return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
function calEvenements(){
  const q = crmNorm(CAL.q || '').trim(), par = {};
  crmToutesActions().forEach(a => {
    const iso = crmISO(a.date); if(!iso) return;
    if(crmNorm(a.status || '').includes('archive')) return;
    if(q && !crmNorm([crmNomClient(a.clientId), a.type, a.objective, a.commercial].join(' ')).includes(q)) return;
    const deb = calMin(a.heure), duree = Math.max(15, parseInt(a.duree, 10) || 60);
    const e = Object.assign({}, a, {iso, deb, fin: deb === null ? null : Math.min(deb + duree, 1440), couleur: calCouleur(a)});
    (par[iso] = par[iso] || []).push(e);
  });
  Object.values(par).forEach(l => l.sort((x, y) => (x.deb === null ? -1 : x.deb) - (y.deb === null ? -1 : y.deb)));
  return par;
}
let calEvtListe = [];
function calPastille(e, cls){
  const id = calEvtListe.push(e) - 1, faite = crmActionFaite(e) || crmActionReportee(e);
  return `<div class="cal-ev ${cls || ''}${faite ? ' cal-faite' : ''}" data-ev="${id}" style="--c:${e.couleur};"><span class="cal-ev-t">${e.deb !== null && cls !== 'cal-pt' ? '<b>' + calHeure(e.deb) + '</b> ' : ''}${esc(crmNomClient(e.clientId))}</span></div>`;
}
function calTitre(){
  const d = calDate(CAL.ref);
  if(CAL.vue === 'mois') return CAL_MOIS[d.getMonth()] + ' <span>' + d.getFullYear() + '</span>';
  if(CAL.vue === 'jour') return d.getDate() + ' ' + CAL_MOIS[d.getMonth()] + ' <span>' + d.getFullYear() + '</span>';
  const a = calDate(calDebutSemaine(CAL.ref)), b = calDate(calAjouterJours(calDebutSemaine(CAL.ref), 6));
  return a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + CAL_MOIS_C[a.getMonth()] : '') + ' – ' + b.getDate() + ' ' + CAL_MOIS_C[b.getMonth()] + ' <span>' + b.getFullYear() + '</span>';
}
function calVueMois(par){
  const auj = getTodayISO(), d = calDate(CAL.ref), an = d.getFullYear(), mo = d.getMonth();
  const prem = new Date(an, mo, 1), debut = calDebutSemaine(calISO(prem));
  const nbSem = Math.ceil(((prem.getDay() + 6) % 7 + new Date(an, mo + 1, 0).getDate()) / 7);
  const max = window.innerWidth < 700 ? 3 : 4;
  let h = `<div class="cal-semaine-tete">${CAL_JOURS.map(j => `<div>${j}</div>`).join('')}</div><div class="cal-mois" style="grid-template-rows:repeat(${nbSem},1fr);">`;
  for(let i = 0; i < nbSem * 7; i++){
    const iso = calAjouterJours(debut, i), dj = calDate(iso), ev = par[iso] || [];
    h += `<div class="cal-case${dj.getMonth() !== mo ? ' cal-autre' : ''}" data-jour="${iso}"><div class="cal-num${iso === auj ? ' cal-auj' : ''}">${dj.getDate()}</div>`
      + ev.slice(0, max).map(e => calPastille(e, 'cal-pt')).join('')
      + (ev.length > max ? `<div class="cal-plus">+${ev.length - max}<span class="cal-plus-txt"> autres</span></div>` : '') + '</div>';
  }
  return h + '</div>';
}
function calBornes(jours, par){
  let mn = 7 * 60, mx = 20 * 60;
  jours.forEach(iso => (par[iso] || []).forEach(e => { if(e.deb !== null){ mn = Math.min(mn, Math.floor(e.deb / 60) * 60); mx = Math.max(mx, Math.ceil(e.fin / 60) * 60); } }));
  return [mn / 60, Math.min(mx / 60, 24)];
}
function calColonnes(l){
  // Place les événements qui se chevauchent côte à côte.
  const cols = [], res = [];
  l.forEach(e => { let c = cols.findIndex(f => f <= e.deb); if(c < 0){ c = cols.length; cols.push(0); } cols[c] = e.fin; res.push({e, c}); });
  res.forEach(r => { r.n = Math.max(1, res.filter(o => o.e.deb < r.e.fin && o.e.fin > r.e.deb).reduce((m, o) => Math.max(m, o.c + 1), 0)); });
  return res;
}
function calGrille(jours, par, detail){
  const auj = getTodayISO(), [h0, h1] = calBornes(jours, par), HH = window.innerWidth < 700 ? 44 : (detail ? 64 : 54);
  const touteJournee = jours.map(iso => (par[iso] || []).filter(e => e.deb === null));
  const tete = `<div class="cal-gt" style="--n:${jours.length};"><div class="cal-gt-marge"></div>${jours.map(iso => { const d = calDate(iso), i = (d.getDay() + 6) % 7;
    return `<div class="cal-gt-jour" data-jour="${iso}"><div class="cal-gt-nom">${CAL_JOURS[i]}</div><div class="cal-num${iso === auj ? ' cal-auj' : ''}">${d.getDate()}</div></div>`; }).join('')}</div>`;
  const tj = touteJournee.some(l => l.length) ? `<div class="cal-gt cal-tj" style="--n:${jours.length};"><div class="cal-gt-marge cal-tj-lib">journée</div>${touteJournee.map(l => `<div class="cal-tj-col">${l.map(e => calPastille(e, detail ? 'cal-gros' : '')).join('')}</div>`).join('')}</div>` : '';
  let heures = ''; for(let h = h0; h < h1; h++) heures += `<div class="cal-h" style="height:${HH}px;"><span>${String(h).padStart(2, '0')}:00</span></div>`;
  const cols = jours.map(iso => {
    const evs = (par[iso] || []).filter(e => e.deb !== null);
    const blocs = calColonnes(evs).map(({e, c, n}) => {
      const top = (e.deb / 60 - h0) * HH, ht = Math.max((e.fin - e.deb) / 60 * HH - 2, 18), id = calEvtListe.push(e) - 1, faite = crmActionFaite(e) || crmActionReportee(e);
      return `<div class="cal-bloc${faite ? ' cal-faite' : ''}" data-ev="${id}" style="--c:${e.couleur};top:${top}px;height:${ht}px;left:${c / n * 100}%;width:calc(${100 / n}% - 2px);"><b>${esc(crmNomClient(e.clientId))}</b>${ht > 30 ? `<small>${calHeure(e.deb)}${detail ? ' – ' + calHeure(e.fin) : ''}${detail && e.type ? ' · ' + esc(e.type) : ''}</small>` : ''}${detail && ht > 54 && e.objective ? `<small>${esc(e.objective)}</small>` : ''}</div>`;
    }).join('');
    const now = iso === auj ? (() => { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); return m / 60 >= h0 && m / 60 <= h1 ? `<div class="cal-now" style="top:${(m / 60 - h0) * HH}px;"></div>` : ''; })() : '';
    return `<div class="cal-col${iso === auj ? ' cal-col-auj' : ''}" data-jour="${iso}" style="height:${(h1 - h0) * HH}px;">${blocs}${now}</div>`;
  }).join('');
  return `${tete}${tj}<div class="cal-scroll" id="cal-scroll"><div class="cal-gt cal-corps" style="--n:${jours.length};--hh:${HH}px;"><div class="cal-heures">${heures}</div>${cols}</div></div>`;
}
function renderMgtCalendrier(main){
  if(!CAL.ref) CAL.ref = getTodayISO();
  calEvtListe = [];
  const b = mgtSection(main, ICONS.calendarCheck + ' Calendrier', '');
  const par = calEvenements();
  const jours = CAL.vue === 'jour' ? [CAL.ref] : Array.from({length:7}, (_, i) => calAjouterJours(calDebutSemaine(CAL.ref), i));
  const corps = CAL.vue === 'mois' ? calVueMois(par) : calGrille(jours, par, CAL.vue === 'jour');
  const seg = [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']].map(([k, l]) => `<button class="${CAL.vue === k ? 'on' : ''}" onclick="calVue('${k}')">${l}</button>`).join('');
  b.innerHTML = `<div class="cal-wrap" id="cal-wrap">
    <div class="cal-barre">
      <div class="cal-nav"><button onclick="calPas(-1)" aria-label="Précédent">‹</button><button class="cal-auj-btn" onclick="calAujourdhui()">Aujourd'hui</button><button onclick="calPas(1)" aria-label="Suivant">›</button></div>
      <div class="cal-outils">
        <button onclick="calAlertes()" aria-label="À surveiller" title="À surveiller">🔔</button>
        <button onclick="calRecherche()" aria-label="Rechercher" title="Rechercher">🔍</button>
        <button onclick="calListe()" aria-label="Liste" title="Vue liste">☰</button>
        ${crmEd() ? '<button class="cal-plus-btn" onclick="calNouveau()" aria-label="Nouvelle action" title="Nouvelle action">+</button>' : ''}
      </div>
    </div>
    <div class="cal-titre">${calTitre()}</div>
    ${CAL.rech || CAL.q ? `<input id="cal-q" class="mgt-in cal-q" type="search" placeholder="Rechercher une action, un client…" value="${esc(CAL.q)}" oninput="calFiltre(this.value)" autocomplete="off">` : ''}
    <div class="cal-seg">${seg}</div>
    <div class="cal-corps-zone" id="cal-zone">${corps}</div></div>`;
  const sc = document.getElementById('cal-scroll'); if(sc) sc.scrollTop = Math.max(0, ((CAL.ref === getTodayISO() ? new Date().getHours() : 8) - 1 - calBornes(jours, par)[0]) * (window.innerWidth < 700 ? 44 : 54));
  calBrancher();
}
window.calVue = (v) => { CAL.vue = v; nav('mgt-agenda'); };
window.calPas = (n) => {
  const d = calDate(CAL.ref);
  if(CAL.vue === 'mois'){ d.setDate(1); d.setMonth(d.getMonth() + n); CAL.ref = calISO(d); }
  else CAL.ref = calAjouterJours(CAL.ref, n * (CAL.vue === 'jour' ? 1 : 7));
  nav('mgt-agenda');
};
window.calAujourdhui = () => { CAL.ref = getTodayISO(); nav('mgt-agenda'); };
window.calRecherche = () => { CAL.rech = !CAL.rech; if(!CAL.rech) CAL.q = ''; nav('mgt-agenda'); if(CAL.rech){ const i = document.getElementById('cal-q'); if(i) i.focus(); } };
let calDelaiFiltre = null;
window.calFiltre = (v) => { CAL.q = v; clearTimeout(calDelaiFiltre); calDelaiFiltre = setTimeout(() => { nav('mgt-agenda'); const i = document.getElementById('cal-q'); if(i){ i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); };
window.calListe = () => { CAL.vue = 'liste'; nav('mgt-agenda'); };
window.calNouveau = (iso) => {
  crmForm('planning', '');
  const j = iso || (CAL.vue === 'mois' ? '' : CAL.ref); if(j){ const f = document.getElementById('cf-date'); if(f) f.value = j; }
};
window.calAlertes = () => {
  const l = crmAlertes().slice(0, 40);
  mgtModal('À surveiller', l.length ? l.map(a => `<div class="session-row" style="align-items:flex-start;cursor:pointer;" onclick="mgtFermer();crmOuvrir('${a.clientId}')"><div style="flex:1;min-width:0;"><b style="font-size:13px;">${esc(crmNomClient(a.clientId))}</b><div style="font-size:12px;color:var(--ink-soft);">${esc(a.titre)}${a.detail ? ' · ' + esc(a.detail) : ''}</div></div>${crmBadge(a.niveau === 'crit' ? 'urgent' : 'à suivre', a.niveau === 'crit' ? 'bad' : 'warn')}</div>`).join('') : '<div style="padding:12px;color:var(--ink-soft);">Rien à signaler.</div>');
};
function calIndexPlanning(a){
  if(a.source !== 'manuel') return -1;
  const l = crmTableau((crmClients()[a.clientId] || {}).planning);
  const i = l.findIndex(x => x && x.id && x.id === a.id);
  return i >= 0 ? i : l.findIndex(x => x && x.date === a.date && x.objective === a.objective);
}
window.calDetails = (id) => {
  const e = calEvtListe[id]; if(!e) return;
  const i = calIndexPlanning(e), ed = crmEd() && i >= 0;
  const horaire = e.deb !== null ? calHeure(e.deb) + ' – ' + calHeure(e.fin) : 'Toute la journée';
  const ligne = (l, v) => v ? `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-soft);font-size:13.5px;"><div style="width:92px;color:var(--ink-soft);flex-shrink:0;">${l}</div><div style="flex:1;min-width:0;white-space:pre-line;">${esc(v)}</div></div>` : '';
  mgtModal(crmNomClient(e.clientId), `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="width:12px;height:12px;border-radius:4px;background:${e.couleur};"></span><b>${esc(e.type || 'Action')}</b></div>
    ${ligne('Date', crmDateFr(e.date) + ' · ' + horaire)}${ligne('Priorité', e.priority)}${ligne('Statut', e.status)}${ligne('Objectif', e.objective)}${ligne('Commercial', e.commercial)}${ligne('Motif', e.motif)}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
      ${ed ? `<button class="btn btn-primary" style="flex:1;" onclick="crmForm('planning','${e.clientId}',${i})">Modifier</button>` : ''}
      ${ed && crmActionAPlanifier(e) ? `<button class="btn btn-ghost" style="flex:1;" onclick="crmTerminerAction('${e.clientId}',${i});mgtFermer();">Terminer</button>` : ''}
      <button class="btn btn-ghost" style="flex:1;" onclick="mgtFermer();crmOuvrir('${e.clientId}')">Fiche client</button></div>`);
};
window.calModifier = (id) => { const e = calEvtListe[id]; if(!e) return; const i = calIndexPlanning(e); if(crmEd() && i >= 0) crmForm('planning', e.clientId, i); else calDetails(id); };
function calBrancher(){
  const z = document.getElementById('cal-wrap'); if(!z) return;
  let delai = null;
  z.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-ev]');
    if(el){ const id = +el.dataset.ev; clearTimeout(delai); delai = setTimeout(() => calDetails(id), 230); return; }
    const j = ev.target.closest('[data-jour]');
    if(j){ CAL.ref = j.dataset.jour; CAL.vue = 'jour'; nav('mgt-agenda'); }
  });
  z.addEventListener('dblclick', (ev) => { const el = ev.target.closest('[data-ev]'); if(el){ clearTimeout(delai); calModifier(+el.dataset.ev); } });
  let x0 = null, y0 = null;
  z.addEventListener('touchstart', (ev) => { x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; }, {passive:true});
  z.addEventListener('touchend', (ev) => {
    if(x0 === null) return; const dx = ev.changedTouches[0].clientX - x0, dy = ev.changedTouches[0].clientY - y0; x0 = null;
    if(Math.abs(dx) > 70 && Math.abs(dy) < 40) calPas(dx < 0 ? 1 : -1);
  }, {passive:true});
}
const calAgendaListe = window.renderMgtAgenda;
window.renderMgtAgenda = function(main){
  if(CAL.vue === 'liste'){
    calAgendaListe(main);
    const h = main.querySelector('.card'); if(h) h.insertAdjacentHTML('beforebegin', '<div class="cal-seg" style="margin-bottom:8px;"><button onclick="calVue(\'jour\')">Jour</button><button onclick="calVue(\'semaine\')">Semaine</button><button onclick="calVue(\'mois\')">Mois</button><button class="on">Liste</button></div>');
    return;
  }
  renderMgtCalendrier(main);
};
const calCss = document.createElement('style');
calCss.textContent = `
.cal-wrap{--rouge:#ff3b30;max-width:100%;overflow-x:hidden;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:10px 10px 8px;}
.cal-barre{display:flex;align-items:center;justify-content:space-between;gap:6px;}
.cal-nav,.cal-outils{display:flex;align-items:center;gap:4px;}
.cal-wrap button{font-family:inherit;}
.cal-nav button,.cal-outils button{background:none;border:none;color:var(--accent-2);font-size:21px;cursor:pointer;padding:4px 8px;border-radius:9px;line-height:1;}
.cal-nav button:hover,.cal-outils button:hover{background:var(--surface-2);}
.cal-nav .cal-auj-btn{font-size:14px;font-weight:600;}
.cal-outils button{font-size:17px;}
.cal-outils .cal-plus-btn{font-size:26px;font-weight:300;color:var(--rouge);}
.cal-titre{font-size:26px;font-weight:800;letter-spacing:-.02em;text-transform:capitalize;margin:6px 4px 8px;}
.cal-titre span{color:var(--ink-soft);font-weight:500;}
.cal-q{margin-bottom:8px;}
.cal-seg{display:flex;background:var(--surface-3);border-radius:10px;padding:2px;margin-bottom:10px;}
.cal-seg button{flex:1;border:none;background:none;padding:6px 4px;font-size:13px;font-weight:600;border-radius:8px;color:var(--ink);cursor:pointer;}
.cal-seg button.on{background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.18);}
.cal-semaine-tete{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));text-align:center;font-size:11px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;padding-bottom:4px;}
.cal-mois{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--border);border-left:1px solid var(--border);}
.cal-case{border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-width:0;min-height:74px;padding:3px 2px;cursor:pointer;overflow:hidden;}
.cal-case:hover{background:var(--surface-2);}
.cal-autre{opacity:.45;}
.cal-num{width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;font-size:14px;font-weight:600;margin:0 auto 2px;}
.cal-auj{background:var(--rouge);color:#fff;}
.cal-ev{display:block;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10px;line-height:1.35;border-radius:5px;padding:0 4px;margin:0 1px 2px;background:color-mix(in srgb,var(--c) 22%,transparent);border-left:3px solid var(--c);color:var(--ink);cursor:pointer;}
.cal-ev .cal-ev-t{display:block;overflow:hidden;text-overflow:ellipsis;}
.cal-pt{font-size:9.5px;padding:0 3px;border-left-width:2px;}
.cal-gros{font-size:12px;padding:2px 6px;}
.cal-faite{opacity:.5;}
.cal-plus{font-size:10px;font-weight:600;color:var(--ink-soft);text-align:center;}
.cal-plus-txt{display:none;}
.cal-gt{display:grid;grid-template-columns:38px repeat(var(--n),minmax(0,1fr));}
.cal-gt-jour{text-align:center;padding:2px 0 4px;cursor:pointer;border-left:1px solid var(--border-soft);}
.cal-gt-jour .cal-num{margin:0 auto 2px;}
.cal-gt-nom{font-size:10.5px;font-weight:600;color:var(--ink-soft);text-transform:uppercase;}
.cal-tj{border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.cal-tj-lib{font-size:9px;color:var(--ink-soft);display:flex;align-items:center;justify-content:center;text-align:center;}
.cal-tj-col{min-width:0;border-left:1px solid var(--border-soft);padding:2px 0;}
.cal-scroll{max-height:calc(100dvh - 330px);min-height:300px;overflow-y:auto;overflow-x:hidden;border-top:1px solid var(--border);}
.cal-corps{position:relative;}
.cal-heures{grid-column:1;}
.cal-h{border-top:1px solid var(--border-soft);position:relative;box-sizing:border-box;}
.cal-h span{position:absolute;top:-7px;right:4px;font-size:9.5px;color:var(--ink-soft);background:var(--surface);padding:0 2px;}
.cal-col{position:relative;border-left:1px solid var(--border-soft);min-width:0;background-image:linear-gradient(var(--border-soft) 1px,transparent 1px);background-size:100% var(--hh);}
.cal-col-auj{background-color:color-mix(in srgb,var(--rouge) 4%,transparent);}
.cal-bloc{position:absolute;box-sizing:border-box;overflow:hidden;border-radius:6px;padding:2px 4px;font-size:10px;line-height:1.25;background:color-mix(in srgb,var(--c) 24%,var(--surface));border-left:3px solid var(--c);color:var(--ink);cursor:pointer;}
.cal-bloc b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;}
.cal-bloc small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9.5px;color:var(--ink-soft);}
.cal-now{position:absolute;left:0;right:0;height:2px;background:var(--rouge);z-index:2;pointer-events:none;}
@media (min-width:700px){
  .cal-case{min-height:112px;padding:4px;}
  .cal-num{margin:0 0 3px;}
  .cal-ev{font-size:11.5px;padding:1px 6px;}
  .cal-plus{text-align:left;padding-left:6px;font-size:11.5px;}
  .cal-plus-txt{display:inline;}
  .cal-gt{grid-template-columns:54px repeat(var(--n),minmax(0,1fr));}
  .cal-bloc{font-size:12px;padding:3px 6px;}.cal-bloc b{font-size:12.5px;}.cal-bloc small{font-size:11px;}
  .cal-titre{font-size:30px;}
  .cal-scroll{max-height:calc(100dvh - 300px);}
}
@media (max-width:420px){.cal-wrap{padding:8px 4px 6px;}.cal-titre{font-size:22px;}.cal-nav button{padding:4px 5px;}}
`;
document.head.appendChild(calCss);
