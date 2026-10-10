// Rendement : « Fiche chaîne » — saisie, par ouvrière, des pièces produites à chaque heure, avec l'objectif par heure
// (réduit automatiquement selon l'état RH : absence, retard, sortie), les pertes / arrêts et l'état du jour.
const FC_MOTIFS = ['Panne machine', 'Attente matière', 'Changement de série', 'Retouche / qualité', 'Réglage', 'Autre'];
let fcDate = null;
const fcListe = (v) => Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
function fcParams(){ const p = getJSON('fc_params', null) || {}; return {chain:p.chain ? fcListe(p.chain) : null, obj:p.obj || {}, poste:p.poste || {}, postes:fcListe(p.postes), polyv:fcListe(p.polyv)}; }
function fcSaveParams(p){ setJSON('fc_params', p); }
// Jour : modèles en cours (plusieurs possibles), affectations « modèle:poste » → ouvrières, postes validés
function fcJour(date){
  const d = getJSON('fc_' + date, null) || {}; let modeles = fcListe(d.modeles); if(!modeles.length && d.modele) modeles = [d.modele];
  const aff = {}; Object.keys(d.aff || {}).forEach(k => { const kk = (String(k).indexOf(':') < 0 && d.modele) ? d.modele + ':' + k : k; aff[kk] = fcListe(d.aff[k]); });
  const vol = {}; Object.keys(d.vol || {}).forEach(k => { vol[k] = fcListe(d.vol[k]).map(x => ({t:parseInt(x.t) || 0, cle:x.cle})).sort((a, b) => a.t - b.t); });
  return {rows:d.rows || {}, modeles, aff, valid:d.valid || {}, vol};
}
function fcSaveJour(date, d){ setJSON('fc_' + date, d); }
// Modèles : liste ordonnée d'opérations (postes) {nom, cadence (pièces/h par ouvrière), emps (ouvrières par défaut)}.
function fcModeles(){ return fcListe(getJSON('fc_modeles', null)).map(m => ({id:m.id, nom:m.nom || 'Modèle', ops:fcListe(m.ops).map(o => ({nom:o.nom || 'Poste', cadence:o.cadence, emps:fcListe(o.emps)}))})); }
function fcSaveModeles(l){ setJSON('fc_modeles', l); }
// Affectation du jour. Une ouvrière fixe n'est que sur UN poste. Une VOLANTE (équilibrage) est sur un seul poste à la fois, mais change de poste
// en cours de journée (heure de changement enregistrée) : sa cadence s'ajoute à celle du poste, uniquement pendant la période où elle y est.
function fcAff(date){
  const jour = fcJour(date), mods = fcModeles(), sel = jour.modeles.map(id => mods.find(m => m.id === id)).filter(Boolean); if(!sel.length) return null;
  const actifs = {}; activeEmployees().forEach(([id, e]) => { actifs[id] = e; }); const poly = new Set(fcParams().polyv), vu = {};
  const modeles = sel.map(mod => ({mod, ops:mod.ops.map((op, i) => { const cle = mod.id + ':' + i, emps = (jour.aff[cle] || op.emps || []).filter(id => actifs[id] && !poly.has(id) && !vu[id]);
    emps.forEach(id => { vu[id] = 1; }); return {nom:op.nom, cadence:op.cadence, cle, i, emps, vols:[], valide:!!jour.valid[cle], cad:parseFloat(op.cadence) > 0 ? parseFloat(op.cadence) : getObjHoraireOp(), defs:op.emps || []}; })}));
  const opParCle = {}; modeles.forEach(g => g.ops.forEach(o => { opParCle[o.cle] = {g, o}; }));
  // Volantes : chronologie du jour (sinon : poste par défaut du modèle, dès le début de journée)
  const voles = []; poly.forEach(id => { if(!actifs[id]) return; let tl = jour.vol[id];
    if(!tl || !tl.length){ const d = Object.keys(opParCle).find(c => opParCle[c].o.defs.indexOf(id) >= 0); tl = d ? [{t:0, cle:d}] : []; }
    tl = tl.filter(x => opParCle[x.cle]); if(tl.length) voles.push({id, tl}); });
  const entries = [];
  modeles.forEach(g => g.ops.forEach(o => o.emps.forEach(id => { entries.push({key:id, id, e:actifs[id], mid:g.mod.id, mnom:g.mod.nom, i:o.i, cle:o.cle, poste:o.nom, cad:o.cad, poly:false, segs:null}); })));
  voles.forEach(v => { const par = {}; v.tl.forEach((x, k) => { (par[x.cle] = par[x.cle] || []).push([x.t, k + 1 < v.tl.length ? v.tl[k + 1].t : 1440]); });
    Object.keys(par).forEach(cle => { const {g, o} = opParCle[cle]; o.vols.push({id:v.id, segs:par[cle]}); entries.push({key:v.id + '@' + cle, id:v.id, e:actifs[v.id], mid:g.mod.id, mnom:g.mod.nom, i:o.i, cle, poste:o.nom, cad:o.cad, poly:true, segs:par[cle]}); }); });
  entries.sort((a, b) => (a.mid === b.mid ? 0 : (modeles.findIndex(g => g.mod.id === a.mid) - modeles.findIndex(g => g.mod.id === b.mid))) || a.i - b.i || (a.poly ? 1 : 0) - (b.poly ? 1 : 0));
  return {modeles, entries, poly, jour, opParCle};
}
// Sans modèle (ancien mode) : une ligne par ouvrière, poste saisi à la main
function fcOuvrieres(){
  const p = fcParams(), actifs = activeEmployees();
  if(p.chain && p.chain.length){ const m = {}; actifs.forEach(([id, e]) => { m[id] = e; }); return p.chain.filter(id => m[id]).map(id => [id, m[id]]); }
  return actifs;
}
function fcPoste(id, e){ const p = fcParams(); const v = (p.poste[id] !== undefined) ? p.poste[id] : (e && e.poste); return String(v || '').trim() || 'Sans poste'; }
function fcObjH(id){ const p = fcParams(); const v = parseFloat(p.obj[id]); return v > 0 ? v : getObjHoraireOp(); }
function fcPostesOrdre(){
  const p = fcParams(), used = [];
  fcOuvrieres().forEach(([id, e]) => { const n = fcPoste(id, e); if(used.indexOf(n) < 0) used.push(n); });
  const ord = p.postes.filter(n => used.indexOf(n) >= 0); used.forEach(n => { if(ord.indexOf(n) < 0) ord.push(n); }); return ord;
}
function fcEntries(date){
  const A = fcAff(date); if(A) return A.entries;
  return fcOuvrieres().map(([id, e]) => ({key:id, id, e, mid:null, mnom:'', i:0, cle:null, poste:fcPoste(id, e), cad:fcObjH(id), poly:false, segs:null}));
}
// Totaux : par modèle, pièces de la chaîne = DERNIER poste, objectif = poste GOULOT (jamais la somme des postes).
// Plusieurs modèles en cours = plusieurs chaînes parallèles : on additionne les chaînes.
function fcTotaux(date, jour){
  const A = fcAff(date), calc = fcEntries(date).map(en => ({key:en.key, id:en.id, e:en.e, mid:en.mid, mnom:en.mnom, i:en.i, poste:en.poste, poly:en.poly, c:fcCalcul(en, date, jour)}));
  const defs = A ? A.modeles.map(g => ({id:g.mod.id, nom:g.mod.nom, ops:g.ops.map(o => o.nom)})) : [{id:null, nom:'', ops:fcPostesOrdre()}];
  const groupes = defs.map(d => {
    const par = d.ops.map((n, i) => { const l = calc.filter(x => A ? (x.mid === d.id && x.i === i) : x.poste === n), q = l.reduce((t, x) => t + x.c.qty, 0), o = l.reduce((t, x) => t + x.c.obj, 0); return {nom:n, n:l.length, q, o, rend:o > 0 ? q / o * 100 : null}; });
    const garni = par.filter(x => x.n > 0), dernier = garni.length ? garni[garni.length - 1] : {nom:'', n:0, q:0, o:0, rend:null};
    const act = garni.filter(x => x.o > 0), goulot = act.length ? act.reduce((m, x) => x.o < m.o ? x : m, act[0]) : null, o = goulot ? goulot.o : 0;
    return {id:d.id, nom:d.nom, par, dernier, goulot, q:dernier.q, o, rend:o > 0 ? dernier.q / o * 100 : null};
  });
  const q = groupes.reduce((t, g) => t + g.q, 0), o = groupes.reduce((t, g) => t + g.o, 0), un = groupes.length === 1 ? groupes[0] : null, ids = {}, idp = {};
  calc.forEach(x => { ids[x.id] = 1; if(x.c.etat.cls === 'good' || x.c.etat.cls === 'warn') idp[x.id] = 1; });
  return {calc, groupes, par:un ? un.par : [], dernier:un ? un.dernier : {nom:'', n:0}, goulot:un ? un.goulot : null, q, o, rend:o > 0 ? q / o * 100 : null,
    p:calc.reduce((t, x) => t + x.c.pertes, 0), pres:Object.keys(idp).length, n:Object.keys(ids).length};
}
const FC_ICO = {box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>', target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.7a3.5 3.5 0 010 6.6M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>', trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'};
const fcIco = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${FC_ICO[k]}</svg>`;
// KPI : cartes modernes (pastille d'icône, grand chiffre, anneau pour les pourcentages)
function fcKpi(label, valeur, sous, ton, ico, pct){
  const lead = (pct === undefined || pct === null) ? `<span class="kp-ico">${fcIco(ico)}</span>` : `<span class="kp-ring" style="background:conic-gradient(var(--c) 0 ${Math.max(0, Math.min(100, pct))}%,var(--surface-3) 0);"><i>${Math.round(pct)}</i></span>`;
  return `<div class="kp kp-${ton}">${lead}<div class="kp-tx"><div class="kp-l">${label}</div><div class="kp-v">${valeur}</div>${sous ? `<div class="kp-s">${sous}</div>` : ''}</div></div>`;
}
function fcKpisHTML(T){
  const r = T.rend === null ? null : Math.round(T.rend), tr = r === null ? 'nul' : (r >= 90 ? 'ok' : r >= 70 ? 'warn' : 'bad');
  return `<div class="kp-grid">${fcKpi('Pièces chaîne', T.q, T.groupes.length > 1 ? T.groupes.length + ' modèles en cours' : (T.dernier.nom ? 'sortie · ' + esc(T.dernier.nom) : ''), 'info', 'box')}${fcKpi('Objectif chaîne', T.o, T.groupes.length > 1 ? 'goulot de chaque modèle' : (T.goulot ? 'goulot · ' + esc(T.goulot.nom) : 'ajusté selon la présence'), 'nul', 'target')}${fcKpi('Rendement', r === null ? '—' : r + ' %', 'pièces / objectif', tr, 'trend', r === null ? 0 : r)}${fcKpi('Pertes', T.p + ' min', T.p ? 'arrêts du jour' : 'aucun arrêt', T.p ? 'warn' : 'nul', 'clock')}${fcKpi('Présentes', T.pres + '/' + T.n, 'ouvrières', 'ok', 'users')}</div>
    ${T.groupes.length > 1 ? `<div class="kp-postes">${T.groupes.map(g => `<span class="kp-chip"><b>${esc(g.nom)}</b> ${g.q}/${g.o} <i class="hour-rend ${fcCls(g.rend)}">${fcPct(g.rend)}</i></span>`).join('')}</div>` : (T.par.length > 1 ? `<div class="kp-postes">${T.par.map((x, i) => `<span class="kp-chip${i === T.par.length - 1 ? ' last' : ''}"><b>${esc(x.nom)}</b> ${x.q}/${x.o} <i class="hour-rend ${fcCls(x.rend)}">${fcPct(x.rend)}</i></span>`).join('<span class="kp-arrow">›</span>')}</div>` : '')}`
}
function fcEtat(id, date){
  const r = resolveDayStatus(id, date);
  if(r.source === 'periode'){ const t = ABSENCE_TYPES[r.type]; return {label:t.label, cls:t.cls}; }
  if(r.source === 'pointage'){
    if(r.status === 'absent') return {label:'Absente', cls:'bad'};
    const rh = computeRetardHours(r), au = computeAutorisationsHours(r);
    if(rh > 0 && au > 0) return {label:'Retard + sortie', cls:'warn'};
    if(rh > 0) return {label:'Retard ' + fmtH(rh), cls:'warn'};
    if((r.autorisations || []).length) return {label:'Sortie' + (au > 0 ? ' ' + fmtH(au) : ''), cls:'warn'};
    return {label:'Présente', cls:'good'};
  }
  return {label:'Non pointée', cls:''};
}
function fcCalcul(en, date, jour){
  const e = en.e, slots = getSlotsForDate(date), row = (jour.rows[en.key] || {}), h = row.h || {}, objh = en.cad;
  let qty = 0, obj = 0;
  const det = slots.map(s => {
    const frac = (typeof rhSlotFraction === 'function') ? rhSlotFraction(e.nom, date, s.start, s.end) : 1;
    const ov = en.segs ? en.segs.reduce((t, g) => t + Math.max(0, Math.min(s.end, g[1]) - Math.max(s.start, g[0])), 0) : s.minutes;
    const o = Math.round(objh * frac * ov / 60), q = parseInt(h[s.label]) || 0;
    qty += q; obj += o; return {label:s.label, q, o, frac:(ov < s.minutes && frac > 0) ? Math.min(frac, ov / s.minutes) : frac, ov, saisi:(h[s.label] !== undefined && String(h[s.label]) !== '')};
  });
  const pertes = (row.pertes || []).reduce((t, p) => t + (parseInt(p.min) || 0), 0);
  return {qty, obj, rend: obj > 0 ? qty / obj * 100 : null, pertes, det, etat:fcEtat(en.id, date), objh, listePertes:row.pertes || []};
}
const fcPct = (r) => r === null ? '—' : Math.round(r) + ' %';
const fcCls = (r) => r === null ? '' : rendClass(Math.round(r));

function renderFicheChaine(container){
  if(!fcDate) fcDate = getTodayISO();
  const date = fcDate, slots = getSlotsForDate(date), jour = fcJour(date), edit = canSaisie(currentUser.role), AF = fcAff(date), mods = fcModeles();
  const jf = date.split('-').reverse().join('/'), dn = (d) => { const x = new Date(date + 'T00:00:00'); x.setDate(x.getDate() + d); return toISODateLocal(x); };
  if(!slots.length){
    container.innerHTML = `<div class="card"><div class="flex-header"><h2 style="margin:0;">Fiche chaîne</h2><input type="date" value="${date}" max="${getTodayISO()}" onchange="fcDate=this.value;nav('fiche-chaine')"></div>${buildEmptyState('Jour non travaillé', 'Aucun créneau programmé le ' + jf + ' (voir Paramètres → Horaires).')}</div>`; return;
  }
  const TT = fcTotaux(date, jour), calc = TT.calc, NC = slots.length + 6;
  const ligne = (x) => `<tr id="fc-r-${x.key}">
      <td class="fc-nom"><b>${esc(x.e.nom)}${x.poly ? ' <span class="fc-vol" title="Volante (équilibrage)">⚖</span>' : ''}</b><span class="hour-rend ${x.c.etat.cls}">${esc(x.c.etat.label)}</span>${AF ? `<span class="fc-poste-l">${esc(x.poste)}</span>` : `<input class="fc-poste" list="fc-postes-dl" value="${esc(x.poste === 'Sans poste' ? '' : x.poste)}" placeholder="Poste" ${edit ? '' : 'disabled'} onchange="fcPosteSet('${x.id}',this.value)" title="Poste (modifiable)">`}</td>
      <td><input class="fc-objh" type="number" min="0" step="0.5" value="${x.c.objh}" ${edit && !AF ? '' : 'disabled'} onchange="fcObjHSet('${x.id}',this.value)" title="${AF ? 'Cadence du poste (réglée dans le modèle)' : 'Objectif par heure'}"></td>
      ${x.c.det.map(d => `<td><input class="fc-q${d.frac < 1 ? ' fc-red' : ''}" data-slot="${esc(d.label)}" enterkeyhint="next" type="number" min="0" inputmode="numeric" value="${d.saisi ? (jour.rows[x.key].h[d.label]) : ''}" placeholder="${d.o}" ${edit && d.frac > 0 && d.ov > 0 ? '' : 'disabled'} onchange="fcSaisir('${x.key}','${d.label}',this.value)" title="Objectif ${d.o}"></td>`).join('')}
      <td class="fc-tot" id="fc-q-${x.key}">${x.c.qty}</td><td class="fc-tot" id="fc-o-${x.key}">${x.c.obj}</td>
      <td class="fc-tot" id="fc-p-${x.key}"><span class="hour-rend ${fcCls(x.c.rend)}">${fcPct(x.c.rend)}</span></td>
      <td id="fc-l-${x.key}"><button class="btn btn-ghost fc-btn" onclick="fcPertes('${x.key}')">${x.c.pertes ? x.c.pertes + ' min' : '+ Perte'}</button></td></tr>`;
  const entete = (g) => `<tr class="fc-grp"><td colspan="${NC}" id="fc-g-${g.id}">${fcGrpHTML(g)}</td></tr>`;
  const lignes = AF ? TT.groupes.map(g => entete(g) + calc.filter(x => x.mid === g.id).map(ligne).join('')).join('') : calc.map(ligne).join('');
  container.innerHTML = `
    <div class="card" style="padding:12px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-ghost" style="padding:9px 11px;" onclick="fcDate='${dn(-1)}';nav('fiche-chaine')">‹</button>
        <input type="date" value="${date}" max="${getTodayISO()}" onchange="fcDate=this.value;nav('fiche-chaine')" style="padding:9px 11px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);">
        <button class="btn btn-ghost" style="padding:9px 11px;" onclick="fcDate='${dn(1)}';nav('fiche-chaine')" ${date >= getTodayISO() ? 'disabled' : ''}>›</button>
        <span style="flex:1;"></span>
        <button class="btn btn-ghost fc-modsel" ${edit ? '' : 'disabled'} onclick="fcModelesPick()" title="Modèles en cours dans la chaîne">${AF ? esc(AF.modeles.map(g => g.mod.nom).join(' + ')) : 'Choisir le(s) modèle(s)'}</button>
        ${edit && AF ? `<button class="btn btn-ghost" onclick="fcAffecter(0)">Affectations</button>` : ''}${edit && !AF ? `<button class="btn btn-ghost" onclick="fcPostes()">Postes</button><button class="btn btn-ghost" onclick="fcChoisir()">Choisir les ouvrières</button>` : ''}
        <button class="btn btn-primary" onclick="rrExcel('chaine','${date}','${date}')">Excel</button><button class="btn btn-primary" onclick="rrPdf('chaine','${date}','${date}')">PDF</button>
      </div>
      <div id="fc-kpis" style="margin-top:12px;">${fcKpisHTML(TT)}</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:8px;">Saisissez les pièces de chaque heure. Entrée = ouvrière suivante (même heure). Le chiffre gris est l'objectif de l'heure : il baisse tout seul si l'ouvrière est absente, en retard ou en sortie (état repris du pointage RH).</div>
    </div>
    <div id="fc-zone"></div>
    <datalist id="fc-postes-dl">${[...new Set(activeEmployees().map(([i, e]) => (e.poste || '').trim()).concat(fcParams().postes).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="card" style="padding:6px;"><div class="fc-scroll"><table class="fc-t"><thead><tr><th style="text-align:left;">Ouvrière</th><th>Obj/h</th>${slots.map(s => `<th>${s.label.replace(' - ', '<br>')}</th>`).join('')}<th>Total</th><th>Objectif</th><th>Rend.</th><th>Pertes</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="${slots.length + 6}" style="padding:20px;text-align:center;color:var(--ink-soft);">${mods.length ? 'Choisissez le ou les modèles en cours (bouton en haut) : ses postes et ouvrières apparaissent ici.' : 'Aucun modèle : créez-les dans Params (opérations, cadences, ouvrières).'}</td></tr>`}</tbody></table></div></div>`;
}
function fcGrpHTML(g){ return `<b>${esc(g.nom)}</b> · chaîne : ${g.q} / ${g.o} <span class="hour-rend ${fcCls(g.rend)}">${fcPct(g.rend)}</span>${g.goulot ? ' · goulot : ' + esc(g.goulot.nom) : ''}`; }
function fcMajLigne(key){
  const date = fcDate, jour = fcJour(date), en = fcEntries(date).find(x => x.key === key); if(!en) return;
  const c = fcCalcul(en, date, jour);
  const set = (k, v) => { const el = document.getElementById(k + key); if(el) el.innerHTML = v; };
  set('fc-q-', c.qty); set('fc-o-', c.obj); set('fc-p-', `<span class="hour-rend ${fcCls(c.rend)}">${fcPct(c.rend)}</span>`);
  const T = fcTotaux(date, jour), k = document.getElementById('fc-kpis'); if(k) k.innerHTML = fcKpisHTML(T);
  T.groupes.forEach(g => { const el = document.getElementById('fc-g-' + g.id); if(el) el.innerHTML = fcGrpHTML(g); });
}
window.fcSaisir = function(id, slot, val){
  const v = String(val).trim();
  if(v !== '' && (!/^\d+$/.test(v))){ showToast('Entrez un nombre entier positif'); renderFicheChaine(document.getElementById('main')); return; }
  const jour = fcJour(fcDate), row = jour.rows[id] || (jour.rows[id] = {}); row.h = row.h || {};
  if(v === '') delete row.h[slot]; else row.h[slot] = parseInt(v);
  fcSaveJour(fcDate, jour); fcMajLigne(id);
};
window.fcObjHSet = function(id, val){ const p = fcParams(); const n = parseFloat(val); if(n > 0) p.obj[id] = n; else delete p.obj[id]; fcSaveParams(p); nav('fiche-chaine'); };
window.fcPertes = function(id){
  const en = fcEntries(fcDate).find(x => x.key === id), e = en ? en.e : (getEmployees()[id] || {nom:id}), jour = fcJour(fcDate), row = jour.rows[id] || {}, l = row.pertes || [], edit = canSaisie(currentUser.role);
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><h3 style="margin:0;">Pertes / arrêts — ${esc(e.nom)}</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">${fcDate.split('-').reverse().join('/')}</div>
    ${l.length ? l.map((p, i) => `<div class="session-row" style="padding:7px 0;"><div><b>${parseInt(p.min) || 0} min</b> · ${esc(p.motif || '')}${p.note ? '<div style="font-size:11px;color:var(--ink-soft);">' + esc(p.note) + '</div>' : ''}</div>${edit ? `<button class="icon-btn" onclick="fcPerteSuppr('${id}',${i})">✕</button>` : ''}</div>`).join('') : '<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;">Aucune perte enregistrée.</div>'}
    ${edit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><div class="field" style="margin:0;"><label style="font-size:10px;">Minutes perdues</label><input id="fc-pm" type="number" min="1" style="width:100px;"></div>
      <div class="field" style="margin:0;flex:1;min-width:150px;"><label style="font-size:10px;">Motif</label><select id="fc-pt">${FC_MOTIFS.map(m => `<option>${m}</option>`).join('')}</select></div></div>
      <div class="field" style="margin-top:8px;"><label style="font-size:10px;">Précision (facultatif)</label><input id="fc-pn"></div>
      <button class="btn btn-primary" style="width:100%;" onclick="fcPerteAjout('${id}')">Ajouter</button>` : ''}
    </div></div>`;
};
const fcRetour = () => (typeof activeTab !== 'undefined' && activeTab === 'chaine-params') ? 'chaine-params' : 'fiche-chaine';
window.fcFermer = () => { const z = document.getElementById('fc-zone'); if(z) z.innerHTML = ''; nav(fcRetour()); };
window.fcPerteAjout = function(id){
  const m = parseInt(document.getElementById('fc-pm').value);
  if(!(m > 0)){ showToast('Indiquez les minutes perdues'); return; }
  const jour = fcJour(fcDate), row = jour.rows[id] || (jour.rows[id] = {}); row.pertes = row.pertes || [];
  row.pertes.push({min:m, motif:document.getElementById('fc-pt').value, note:document.getElementById('fc-pn').value.trim()});
  fcSaveJour(fcDate, jour); fcPertes(id);
};
window.fcPerteSuppr = function(id, i){ const jour = fcJour(fcDate), row = jour.rows[id]; if(!row || !row.pertes) return; row.pertes.splice(i, 1); fcSaveJour(fcDate, jour); fcPertes(id); };
window.fcChoisir = function(){
  const actifs = activeEmployees(), p = fcParams(), sel = p.chain ? new Set(p.chain) : new Set(actifs.map(([id]) => id));
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><h3 style="margin:0;">Ouvrières de la chaîne</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="max-height:50vh;overflow:auto;">${actifs.map(([id, e]) => `<label style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-soft);"><input type="checkbox" class="fc-ck" value="${id}" ${sel.has(id) ? 'checked' : ''}> ${esc(e.nom)}<span style="color:var(--ink-soft);font-size:11px;">${esc(e.poste || '')}</span></label>`).join('')}</div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="fcChoisirOk()">Enregistrer</button></div></div>`;
};
window.fcModelesPick = function(){
  const mods = fcModeles(), jour = fcJour(fcDate), sel = new Set(jour.modeles);
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><h3 style="margin:0;">Modèles en cours</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">Plusieurs modèles peuvent tourner en même temps dans la chaîne : cochez-les tous. Les ouvrières sont communes à tous les modèles du jour.</div>
    <div style="max-height:56vh;overflow:auto;">${mods.map(m => `<button type="button" class="pick-row${sel.has(m.id) ? ' on' : ''}" onclick="fcModeleToggle('${m.id}')"><span class="pick-ck">${sel.has(m.id) ? '✓' : ''}</span><span style="flex:1;text-align:left;">${esc(m.nom)}</span><span style="font-size:11px;color:var(--ink-soft);">${m.ops.length} postes</span></button>`).join('') || '<div style="color:var(--ink-soft);padding:10px 0;">Aucun modèle : créez-les dans Params.</div>'}</div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="fcFermer()">Terminer</button></div></div>`;
};
window.fcModeleToggle = function(mid){ const jour = fcJour(fcDate); jour.modeles = jour.modeles.indexOf(mid) >= 0 ? jour.modeles.filter(x => x !== mid) : jour.modeles.concat(mid); fcSaveJour(fcDate, jour); fcModelesPick(); };

// ----- Affectations : poste par poste (plusieurs ouvrières par poste, « Valider » le poste pour les retirer de la liste des suivants) -----
let fcVolMin = null;
const fcHM = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function fcDispo(id, date){ const r = resolveDayStatus(id, date); return !(r.source === 'periode' || (r.source === 'pointage' && r.status === 'absent')); }
function fcSauveAff(A, jour){ // écrit les affectations explicites de tous les postes (les défauts du modèle deviennent fixes pour ce jour)
  jour.aff = {}; A.modeles.forEach(g => g.ops.forEach(o => { jour.aff[o.cle] = o.emps.slice(); })); }
function fcVolHeureDefaut(){ const slots = getSlotsForDate(fcDate); if(!slots.length) return 0; if(fcDate === getTodayISO()){ const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); const s = slots.filter(x => x.start <= m).pop(); return s ? s.start : slots[0].start; } return slots[0].start; }
window.fcAffecter = function(k){
  const A = fcAff(fcDate); if(!A) return; const steps = []; A.modeles.forEach(g => g.ops.forEach(o => steps.push({g, o})));
  k = Math.max(0, Math.min(steps.length - 1, k || 0)); const st = steps[k], o = st.o, em = getEmployees(), poly = A.poly, slots = getSlotsForDate(fcDate);
  if(fcVolMin === null || !slots.some(x => x.start === fcVolMin)) fcVolMin = fcVolHeureDefaut();
  const ou = {}; A.modeles.forEach(g => g.ops.forEach(p => p.emps.forEach(id => { ou[id] = p; })));
  const pool = activeEmployees().filter(([id]) => fcDispo(id, fcDate));
  const nbValides = steps.filter(x => x.o.valide).length;
  let corps;
  if(o.valide){
    corps = `<div style="margin:6px 0 10px;font-size:14px;">${[...o.emps.map(id => esc((em[id] || {}).nom || id)), ...o.vols.map(v => '⚖ ' + esc((em[v.id] || {}).nom || v.id))].join(', ') || '<span style="color:var(--ink-soft);">Aucune ouvrière</span>'}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="hour-rend good">Poste validé</span><button class="btn btn-ghost fc-btn" onclick="fcWizModifier(${k})">Modifier ce poste</button></div>`;
  } else {
    const libres = pool.filter(([id]) => poly.has(id) || !ou[id] || ou[id].cle === o.cle || !ou[id].valide);
    const vols = libres.filter(([id]) => poly.has(id)), fixes = libres.filter(([id]) => !poly.has(id));
    const ligne = ([id, e]) => { const ici = o.emps.indexOf(id) >= 0, autre = ou[id] && ou[id].cle !== o.cle ? ou[id] : null;
      return `<button type="button" class="pick-row${ici ? ' on' : ''}" onclick="fcWizToggle(${k},'${id}')"><span class="pick-ck">${ici ? '✓' : ''}</span><span style="flex:1;text-align:left;">${esc(e.nom)}</span><span style="font-size:11px;color:var(--ink-soft);">${autre ? esc(autre.nom) : ''}</span></button>`; };
    const ligneV = ([id, e]) => { const v = o.vols.find(x => x.id === id), ici = !!v, ailleurs = A.modeles.some(g => g.ops.some(p => p.cle !== o.cle && p.vols.some(x => x.id === id)));
      return `<button type="button" class="pick-row${ici ? ' on' : ''}" onclick="fcWizVol(${k},'${id}')"><span class="pick-ck">${ici ? '✓' : ''}</span><span style="flex:1;text-align:left;">⚖ ${esc(e.nom)}</span><span style="font-size:11px;color:var(--ink-soft);">${ici ? 'dès ' + fcHM(v.segs[0][0]) : (ailleurs ? 'ailleurs' : 'libre')}</span></button>`; };
    corps = `<div style="font-size:12px;color:var(--ink-soft);margin:4px 0 6px;">Cochez une ou plusieurs ouvrières. Une fois le poste validé, elles n'apparaissent plus aux postes suivants.</div>
      <div style="max-height:40vh;overflow:auto;">${fixes.map(ligne).join('') || '<div style="padding:10px;color:var(--ink-soft);">Plus d’ouvrière libre.</div>'}
      ${vols.length ? `<div style="font-size:11px;font-weight:700;color:var(--ink-soft);padding:10px 10px 2px;">VOLANTES (équilibrage) — à partir de <select onchange="fcVolMin=parseInt(this.value)">${slots.map(x => `<option value="${x.start}" ${x.start === fcVolMin ? 'selected' : ''}>${fcHM(x.start)}</option>`).join('')}</select></div>${vols.map(ligneV).join('')}` : ''}</div>`;
  }
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-size:11px;color:var(--ink-soft);font-weight:700;">${esc(st.g.mod.nom)} · poste ${k + 1}/${steps.length} · validés ${nbValides}</div><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <h3 style="margin:2px 0 0;">${esc(o.nom)} <span style="font-size:12px;font-weight:600;color:var(--ink-soft);">${o.cad} pcs/h par ouvrière</span></h3>
    ${corps}
    <div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-ghost" ${k ? '' : 'disabled'} onclick="fcAffecter(${k - 1})">‹ Précédent</button>
      ${o.valide ? `<button class="btn btn-primary" style="flex:1;" onclick="${k + 1 < steps.length ? `fcAffecter(${k + 1})` : 'fcFermer()'}">${k + 1 < steps.length ? 'Poste suivant ›' : 'Terminer'}</button>` : `<button class="btn btn-primary" style="flex:1;" onclick="fcWizValider(${k})">${k + 1 < steps.length ? 'Valider le poste ›' : 'Valider et terminer'}</button>`}</div>
    <div style="display:flex;justify-content:space-between;margin-top:8px;"><button class="btn btn-ghost fc-btn" onclick="fcPolyPick(${k})">⚖ Volantes…</button><button class="btn btn-ghost fc-btn" onclick="fcFermer()">Fermer</button></div></div></div>`;
};
function fcAffMaj(f, k){ const A = fcAff(fcDate), jour = fcJour(fcDate); f(A, jour); fcSaveJour(fcDate, jour); fcAffecter(k); }
window.fcWizToggle = (k, id) => fcAffMaj((A, jour) => {
  let cur = null, tous = [];
  A.modeles.forEach(g => g.ops.forEach(p => { tous.push(p); })); cur = tous[k];
  const deja = cur.emps.indexOf(id) >= 0; tous.forEach(p => { p.emps = p.emps.filter(x => x !== id); }); if(!deja) cur.emps.push(id); fcSauveAff(A, jour);
}, k);
window.fcWizValider = function(k){ const A = fcAff(fcDate), jour = fcJour(fcDate), tous = []; A.modeles.forEach(g => g.ops.forEach(p => tous.push(p))); fcSauveAff(A, jour); jour.valid[tous[k].cle] = true; fcSaveJour(fcDate, jour); if(k + 1 < tous.length) fcAffecter(k + 1); else fcFermer(); };
window.fcWizModifier = (k) => fcAffMaj((A, jour) => { const tous = []; A.modeles.forEach(g => g.ops.forEach(p => tous.push(p))); fcSauveAff(A, jour); delete jour.valid[tous[k].cle]; }, k);
window.fcWizVol = (k, id) => fcAffMaj((A, jour) => {
  const tous = []; A.modeles.forEach(g => g.ops.forEach(p => tous.push(p))); const cle = tous[k].cle, tl = [];
  A.modeles.forEach(g => g.ops.forEach(p => p.vols.forEach(v => { if(v.id === id) v.segs.forEach(sg => tl.push({t:sg[0], cle:p.cle})); })));
  tl.sort((a, b) => a.t - b.t); const ici = tl.some(x => x.cle === cle); fcSauveAff(A, jour);
  jour.vol[id] = ici ? tl.filter(x => x.cle !== cle) : tl.filter(x => x.t < fcVolMin).concat({t:fcVolMin, cle});
}, k);
window.fcPolyPick = function(k){
  const em = activeEmployees(), p = fcParams(), sel = new Set(p.polyv);
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><h3 style="margin:0;">⚖ Volantes</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">Une volante équilibre la chaîne : elle reste disponible pour tous les postes, change de poste en cours de journée, et sa cadence s'ajoute au poste où elle se trouve.</div>
    <div style="max-height:52vh;overflow:auto;">${em.map(([id, e]) => `<button type="button" class="pick-row${sel.has(id) ? ' on' : ''}" onclick="fcPolyToggle('${id}',${k})"><span class="pick-ck">${sel.has(id) ? '✓' : ''}</span><span style="flex:1;text-align:left;">${esc(e.nom)}</span></button>`).join('')}</div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="${k >= 0 ? `fcAffecter(${k})` : 'fcFermer()'}">Terminer</button></div></div>`;
};
window.fcPolyToggle = function(id, k){ const p = fcParams(); p.polyv = p.polyv.indexOf(id) >= 0 ? p.polyv.filter(x => x !== id) : p.polyv.concat(id); fcSaveParams(p); fcPolyPick(k); };
window.fcPosteSet = function(id, v){ const p = fcParams(); p.poste[id] = String(v || '').trim(); const n = p.poste[id]; if(n && p.postes.indexOf(n) < 0) p.postes = fcPostesOrdre().concat(n); fcSaveParams(p); nav(fcRetour()); };
window.fcPostes = function(){
  const ord = fcPostesOrdre();
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><h3 style="margin:0;">Ordre des postes</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;">Du premier au dernier poste de la chaîne. Les pièces de la chaîne = celles du <b>dernier poste</b> (sortie).</div>
    ${ord.map((n, i) => `<div class="session-row" style="padding:8px 0;"><div><b>${i + 1}.</b> ${esc(n)}${i === ord.length - 1 ? ' <span class="hour-rend good">sortie</span>' : ''}</div><div><button class="icon-btn" ${i ? '' : 'disabled'} onclick="fcPosteMove(${i},-1)">↑</button><button class="icon-btn" ${i < ord.length - 1 ? '' : 'disabled'} onclick="fcPosteMove(${i},1)">↓</button></div></div>`).join('') || '<div style="font-size:12.5px;color:var(--ink-soft);">Aucun poste : saisissez le poste de chaque ouvrière dans la fiche.</div>'}
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="fcFermer()">Terminer</button></div></div>`;
};
window.fcPosteMove = function(i, d){ const ord = fcPostesOrdre(), j = i + d; if(j < 0 || j >= ord.length) return; const t = ord[i]; ord[i] = ord[j]; ord[j] = t; const p = fcParams(); p.postes = ord; fcSaveParams(p); fcPostes(); };
window.fcChoisirOk = function(){ const p = fcParams(); p.chain = [...document.querySelectorAll('.fc-ck:checked')].map(c => c.value); fcSaveParams(p); fcFermer(); };

// Données exportables (Excel / PDF) : même moteur que les rapports RH
function fcDonnees(date){
  const slots = getSlotsForDate(date), jour = fcJour(date), T = fcTotaux(date, jour);
  const lignes = T.calc.map(x => { const c = x.c; return [x.mnom, x.e.nom || '', x.poste + (x.poly ? ' (volante)' : ''), c.etat.label].concat(c.det.map(d => d.saisi ? d.q : '')).concat([c.qty, c.obj, c.rend === null ? '' : Math.round(c.rend), c.pertes, c.listePertes.map(p => p.min + ' min ' + (p.motif || '')).join(' ; ')]); });
  const res = [['Pièces chaîne', T.q], ['Objectif chaîne', T.o], ['Rendement', T.o ? Math.round(T.q / T.o * 100) + ' %' : '—'], ['Pertes', T.p + ' min']];
  T.groupes.forEach(g => { res.push([(g.nom || 'Chaîne') + ' — chaîne', g.q + '/' + g.o + (g.goulot ? ' (goulot ' + g.goulot.nom + ')' : '')]); g.par.forEach(x => res.push(['   Poste ' + x.nom, x.q + '/' + x.o])); });
  return {titre:'Fiche chaîne — ' + date.split('-').reverse().join('/'), fichier:'fiche_chaine_' + date, ids:T.calc.map(x => x.id),
    entetes:['Modèle', 'Ouvrière', 'Poste', 'État du jour'].concat(slots.map(s => s.label)).concat(['Total pièces', 'Objectif ajusté', 'Rendement %', 'Pertes (min)', 'Détail des pertes']), lignes, resume:res};
}
const fcRrOrigine = window.rrDonnees;
window.rrDonnees = function(type, debut, fin, empId){ return type === 'chaine' ? fcDonnees(debut) : fcRrOrigine(type, debut, fin, empId); };

const fcNavOrigine = window.nav;
window.nav = function(tab){
  const r = fcNavOrigine.apply(this, arguments);
  if(tab === 'fiche-chaine'){ try { const m = document.getElementById('main'); if(m) renderFicheChaine(m); } catch(e) { console.error('Fiche chaîne', e); } }
  return r;
};
// Entrée / Tab : on passe à l'ouvrière suivante, même heure (puis à l'heure suivante en bas de colonne)
document.addEventListener('keydown', function(ev){
  const t = ev.target; if(!t || !t.classList || !t.classList.contains('fc-q')) return;
  if(!(ev.key === 'Enter' || ev.keyCode === 13 || ev.key === 'Tab')) return;
  ev.preventDefault();
  const back = ev.shiftKey && ev.key === 'Tab', slot = t.getAttribute('data-slot'), tous = [...document.querySelectorAll('.fc-q:not(:disabled)')];
  const col = tous.filter(i => i.getAttribute('data-slot') === slot); let next = col[col.indexOf(t) + (back ? -1 : 1)];
  if(!next){ const slots = [...new Set(tous.map(i => i.getAttribute('data-slot')))], si = slots.indexOf(slot) + (back ? -1 : 1);
    if(slots[si]){ const l = tous.filter(i => i.getAttribute('data-slot') === slots[si]); next = back ? l[l.length - 1] : l[0]; } }
  if(next){ next.focus(); try { next.select(); } catch(e) {} } else t.blur();
}, true);
const fcCss = document.createElement('style');
fcCss.textContent = `
.fc-scroll{overflow:auto;max-height:72vh;} .fc-t{border-collapse:collapse;font-size:12px;width:100%;} .fc-t th{position:sticky;top:0;background:#0F3D66;color:#fff;padding:6px 5px;font-size:10.5px;z-index:2;white-space:nowrap;}
.fc-t td{border:1px solid var(--border);padding:3px;text-align:center;} .fc-nom{text-align:left!important;position:sticky;left:0;background:var(--surface);z-index:1;min-width:150px;} .fc-nom b{display:block;font-size:12.5px;} .fc-nom .hour-rend{font-size:10px;}
.fc-q,.fc-objh{width:58px;padding:6px 4px;text-align:center;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--ink);font-size:14px;font-weight:700;} .fc-objh{width:52px;font-weight:600;} .fc-q::placeholder{color:#9aa4b2;font-weight:400;}
.fc-q.fc-red{background:rgba(245,158,11,.12);} .fc-q:disabled{background:var(--surface-3);opacity:.6;} .fc-tot{font-weight:800;font-size:13px;} .fc-btn{padding:5px 9px;font-size:11px;white-space:nowrap;}
`;
document.head.appendChild(fcCss);
const pkCss = document.createElement('style');
pkCss.textContent = `.pick-row{display:flex;align-items:center;gap:10px;width:100%;padding:13px 10px;border:0;border-bottom:1px solid var(--border-soft);background:transparent;color:var(--ink);font-size:15px;cursor:pointer;} .pick-row.on{background:rgba(14,159,131,.12);font-weight:700;} .pick-ck{width:24px;height:24px;border-radius:7px;border:2px solid var(--border);display:grid;place-items:center;color:#0E9F83;font-weight:800;flex:none;} .pick-row.on .pick-ck{border-color:#0E9F83;}
.pc-card{border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:10px;background:var(--surface);} .pc-top{display:flex;gap:6px;align-items:center;} .pc-num{width:26px;height:26px;border-radius:50%;background:var(--surface-3);display:grid;place-items:center;font-size:12px;font-weight:700;flex:none;} .pc-in{flex:1;min-width:0;padding:9px 10px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--ink);font-size:14px;font-weight:600;} .pc-cad{width:70px;flex:none;text-align:center;} .pc-emps{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:9px;}`;
document.head.appendChild(pkCss);
const kpCss = document.createElement('style');
kpCss.textContent = `
.kp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;}
.kp{--c:#64748B;--cb:rgba(100,116,139,.13);background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 2px rgba(15,23,42,.05),0 8px 18px -10px rgba(15,23,42,.18);}
.kp-info{--c:#2563EB;--cb:rgba(37,99,235,.12);} .kp-ok{--c:#0E9F83;--cb:rgba(14,159,131,.13);} .kp-warn{--c:#E69A0C;--cb:rgba(230,154,12,.15);} .kp-bad{--c:#DC3F45;--cb:rgba(220,63,69,.13);}
.kp-ico{width:42px;height:42px;border-radius:12px;background:var(--cb);color:var(--c);display:grid;place-items:center;flex:none;}
.kp-ring{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;flex:none;position:relative;} .kp-ring i{font-style:normal;width:36px;height:36px;border-radius:50%;background:var(--surface);display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--c);}
.kp-tx{min-width:0;} .kp-l{font-size:10.5px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em;} .kp-v{font-size:26px;font-weight:700;line-height:1.15;color:var(--ink);} .kp-s{font-size:11px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.kp-postes{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;} .kp-chip{font-size:11.5px;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:4px 10px;} .kp-chip.last{border-color:#2563EB;} .kp-arrow{color:var(--ink-soft);}
.fc-vol{color:#2563EB;font-size:12px;} .fc-t tr.fc-grp td{background:var(--surface-3);text-align:left;padding:7px 10px;font-size:12px;position:sticky;left:0;}
.fc-poste-l{display:block;font-size:11px;color:var(--ink-soft);margin-top:2px;font-weight:600;} .fc-modsel{padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);max-width:190px;}
.fc-poste{display:block;width:100%;margin-top:3px;padding:3px 6px;font-size:11px;border:1px dashed var(--border);border-radius:6px;background:transparent;color:var(--ink-soft);}
@media(max-width:480px){.kp{padding:11px;gap:9px;} .kp-ico{width:34px;height:34px;} .kp-ico svg{width:18px;height:18px;} .kp-ring{width:40px;height:40px;} .kp-ring i{width:30px;height:30px;font-size:10.5px;} .kp-v{font-size:21px;}}`;
document.head.appendChild(kpCss);
