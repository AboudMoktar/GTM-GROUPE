// Rendement : « Fiche chaîne » — saisie, par ouvrière, des pièces produites à chaque heure, avec l'objectif par heure
// (réduit automatiquement selon l'état RH : absence, retard, sortie), les pertes / arrêts et l'état du jour.
const FC_MOTIFS = ['Panne machine', 'Attente matière', 'Changement de série', 'Retouche / qualité', 'Réglage', 'Autre'];
let fcDate = null;
function fcParams(){ const p = getJSON('fc_params', null) || {}; return {chain:p.chain || null, obj:p.obj || {}, poste:p.poste || {}, postes:p.postes || []}; }
function fcSaveParams(p){ setJSON('fc_params', p); }
function fcJour(date){ const d = getJSON('fc_' + date, null) || {}; const aff = {}; Object.keys(d.aff || {}).forEach(k => { aff[k] = fcListe(d.aff[k]); }); return {rows:d.rows || {}, modele:d.modele || null, aff}; }
// Modèles : chaque modèle = liste ordonnée d'opérations (postes) {nom, cadence (pièces/h par ouvrière), emps (ouvrières par défaut)}.
// Firebase supprime les listes vides et peut renvoyer des objets à la place des listes : on normalise toujours.
const fcListe = (v) => Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
function fcModeles(){ return fcListe(getJSON('fc_modeles', null)).map(m => ({id:m.id, nom:m.nom || 'Modèle', ops:fcListe(m.ops).map(o => ({nom:o.nom || 'Poste', cadence:o.cadence, emps:fcListe(o.emps)}))})); }
function fcSaveModeles(l){ setJSON('fc_modeles', l); }
// Affectation du jour : modèle choisi + ouvrières par poste (par défaut celles du modèle, modifiables jour par jour)
function fcAff(date){
  const jour = fcJour(date), mod = fcModeles().find(m => m.id === jour.modele); if(!mod) return null;
  const actifs = {}; activeEmployees().forEach(([id, e]) => { actifs[id] = e; }); const vu = {}, map = {};
  const ops = mod.ops.map((op, i) => { const emps = (jour.aff[i] || op.emps || []).filter(id => actifs[id] && !vu[id]); emps.forEach(id => { vu[id] = 1; map[id] = {poste:op.nom, cad:parseFloat(op.cadence) > 0 ? parseFloat(op.cadence) : getObjHoraireOp(), i}; }); return {nom:op.nom, cadence:op.cadence, emps}; });
  return {modele:mod, ops, map, ordre:ops.reduce((l, o, i) => { o.emps.forEach(id => l.push([id, actifs[id]])); return l; }, [])};
}
function fcSaveJour(date, d){ setJSON('fc_' + date, d); }
function fcOuvrieres(date){
  const A = date ? fcAff(date) : null; if(A) return A.ordre;
  const p = fcParams(), actifs = activeEmployees();
  if(p.chain && p.chain.length){ const m = {}; actifs.forEach(([id, e]) => { m[id] = e; }); return p.chain.filter(id => m[id]).map(id => [id, m[id]]); }
  return actifs;
}
// Postes : chaque ouvrière a un poste (modifiable) ; l'ordre des postes est réglable, le DERNIER poste = sortie de la chaîne.
function fcPoste(id, e, date){ const A = date ? fcAff(date) : null; if(A) return A.map[id] ? A.map[id].poste : 'Sans poste'; const p = fcParams(); const v = (p.poste[id] !== undefined) ? p.poste[id] : (e && e.poste); return String(v || '').trim() || 'Sans poste'; }
function fcPostesOrdre(date){
  const A = date ? fcAff(date) : null; if(A) return A.ops.map(o => o.nom);
  const p = fcParams(), used = [];
  fcOuvrieres(date).forEach(([id, e]) => { const n = fcPoste(id, e, date); if(used.indexOf(n) < 0) used.push(n); });
  const ord = p.postes.filter(n => used.indexOf(n) >= 0); used.forEach(n => { if(ord.indexOf(n) < 0) ord.push(n); }); return ord;
}
function fcTotaux(date, jour){
  const calc = fcOuvrieres(date).map(([id, e]) => ({id, e, c:fcCalcul(id, e, date, jour), poste:fcPoste(id, e, date)}));
  const par = fcPostesOrdre(date).map(n => { const l = calc.filter(x => x.poste === n), q = l.reduce((t, x) => t + x.c.qty, 0), o = l.reduce((t, x) => t + x.c.obj, 0); return {nom:n, n:l.length, q, o, rend:o > 0 ? q / o * 100 : null}; });
  const garni = par.filter(x => x.n > 0), dernier = garni.length ? garni[garni.length - 1] : {nom:'', n:0, q:0, o:0, rend:null};
  // Objectif de la chaîne = capacité du poste GOULOT (le plus lent des postes présents), jamais la somme des postes.
  const actifs = par.filter(x => x.o > 0), goulot = actifs.length ? actifs.reduce((m, x) => x.o < m.o ? x : m, actifs[0]) : null, objC = goulot ? goulot.o : 0;
  return {calc, par, dernier, goulot, q:dernier.q, o:objC, rend:objC > 0 ? dernier.q / objC * 100 : null,
    p:calc.reduce((t, x) => t + x.c.pertes, 0), pres:calc.filter(x => x.c.etat.cls === 'good' || x.c.etat.cls === 'warn').length, n:calc.length};
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
  return `<div class="kp-grid">${fcKpi('Pièces chaîne', T.q, T.dernier.nom ? 'sortie · ' + esc(T.dernier.nom) : '', 'info', 'box')}${fcKpi('Objectif chaîne', T.o, T.goulot ? 'goulot · ' + esc(T.goulot.nom) : 'ajusté selon la présence', 'nul', 'target')}${fcKpi('Rendement', r === null ? '—' : r + ' %', 'pièces / objectif', tr, 'trend', r === null ? 0 : r)}${fcKpi('Pertes', T.p + ' min', T.p ? 'arrêts du jour' : 'aucun arrêt', T.p ? 'warn' : 'nul', 'clock')}${fcKpi('Présentes', T.pres + '/' + T.n, 'ouvrières', 'ok', 'users')}</div>
    ${T.par.length > 1 ? `<div class="kp-postes">${T.par.map((x, i) => `<span class="kp-chip${i === T.par.length - 1 ? ' last' : ''}"><b>${esc(x.nom)}</b> ${x.q}/${x.o} <i class="hour-rend ${fcCls(x.rend)}">${fcPct(x.rend)}</i></span>`).join('<span class="kp-arrow">›</span>')}</div>` : ''}`;
}
function fcObjH(id, date){ const A = date ? fcAff(date) : null; if(A) return A.map[id] ? A.map[id].cad : getObjHoraireOp(); const p = fcParams(); const v = parseFloat(p.obj[id]); return v > 0 ? v : getObjHoraireOp(); }
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
function fcCalcul(id, e, date, jour){
  const slots = getSlotsForDate(date), row = (jour.rows[id] || {}), h = row.h || {}, objh = fcObjH(id, date);
  let qty = 0, obj = 0;
  const det = slots.map(s => {
    const frac = (typeof rhSlotFraction === 'function') ? rhSlotFraction(e.nom, date, s.start, s.end) : 1;
    const o = Math.round(objh * frac * s.minutes / 60), q = parseInt(h[s.label]) || 0;
    qty += q; obj += o; return {label:s.label, q, o, frac, saisi:(h[s.label] !== undefined && String(h[s.label]) !== '')};
  });
  const pertes = (row.pertes || []).reduce((t, p) => t + (parseInt(p.min) || 0), 0);
  return {qty, obj, rend: obj > 0 ? qty / obj * 100 : null, pertes, det, etat:fcEtat(id, date), objh, listePertes:row.pertes || []};
}
const fcPct = (r) => r === null ? '—' : Math.round(r) + ' %';
const fcCls = (r) => r === null ? '' : rendClass(Math.round(r));

function renderFicheChaine(container){
  if(!fcDate) fcDate = getTodayISO();
  const date = fcDate, slots = getSlotsForDate(date), jour = fcJour(date), ouv = fcOuvrieres(date), edit = canSaisie(currentUser.role), AF = fcAff(date), mods = fcModeles();
  const jf = date.split('-').reverse().join('/'), dn = (d) => { const x = new Date(date + 'T00:00:00'); x.setDate(x.getDate() + d); return toISODateLocal(x); };
  if(!slots.length){
    container.innerHTML = `<div class="card"><div class="flex-header"><h2 style="margin:0;">Fiche chaîne</h2><input type="date" value="${date}" max="${getTodayISO()}" onchange="fcDate=this.value;nav('fiche-chaine')"></div>${buildEmptyState('Jour non travaillé', 'Aucun créneau programmé le ' + jf + ' (voir Paramètres → Horaires).')}</div>`; return;
  }
  const calc = ouv.map(([id, e]) => ({id, e, c:fcCalcul(id, e, date, jour)}));
  const TT = fcTotaux(date, jour);
  const lignes = calc.map(x => `<tr id="fc-r-${x.id}">
      <td class="fc-nom"><b>${esc(x.e.nom)}</b><span class="hour-rend ${x.c.etat.cls}" id="fc-e-${x.id}">${esc(x.c.etat.label)}</span>${AF ? `<span class="fc-poste-l">${esc(fcPoste(x.id, x.e, date))}</span>` : `<input class="fc-poste" list="fc-postes-dl" value="${esc(fcPoste(x.id, x.e, date) === 'Sans poste' ? '' : fcPoste(x.id, x.e, date))}" placeholder="Poste" ${edit ? '' : 'disabled'} onchange="fcPosteSet('${x.id}',this.value)" title="Poste (modifiable)">`}</td>
      <td><input class="fc-objh" type="number" min="0" step="0.5" value="${x.c.objh}" ${edit && !AF ? '' : 'disabled'} onchange="fcObjHSet('${x.id}',this.value)" title="${AF ? 'Cadence du poste (réglée dans le modèle)' : 'Objectif par heure'}"></td>
      ${x.c.det.map(d => `<td><input class="fc-q${d.frac < 1 ? ' fc-red' : ''}" data-slot="${esc(d.label)}" enterkeyhint="next" type="number" min="0" inputmode="numeric" value="${d.saisi ? (jour.rows[x.id].h[d.label]) : ''}" placeholder="${d.o}" ${edit && d.frac > 0 ? '' : 'disabled'} onchange="fcSaisir('${x.id}','${d.label}',this.value)" title="Objectif ${d.o}"></td>`).join('')}
      <td class="fc-tot" id="fc-q-${x.id}">${x.c.qty}</td><td class="fc-tot" id="fc-o-${x.id}">${x.c.obj}</td>
      <td class="fc-tot" id="fc-p-${x.id}"><span class="hour-rend ${fcCls(x.c.rend)}">${fcPct(x.c.rend)}</span></td>
      <td id="fc-l-${x.id}"><button class="btn btn-ghost fc-btn" onclick="fcPertes('${x.id}')">${x.c.pertes ? x.c.pertes + ' min' : '+ Perte'}</button></td></tr>`).join('');
  container.innerHTML = `
    <div class="card" style="padding:12px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-ghost" style="padding:9px 11px;" onclick="fcDate='${dn(-1)}';nav('fiche-chaine')">‹</button>
        <input type="date" value="${date}" max="${getTodayISO()}" onchange="fcDate=this.value;nav('fiche-chaine')" style="padding:9px 11px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);">
        <button class="btn btn-ghost" style="padding:9px 11px;" onclick="fcDate='${dn(1)}';nav('fiche-chaine')" ${date >= getTodayISO() ? 'disabled' : ''}>›</button>
        <span style="flex:1;"></span>
        <select class="fc-modsel" ${edit ? '' : 'disabled'} onchange="fcModeleSet(this.value)" title="Modèle en production"><option value="">— Modèle —</option>${mods.map(m => `<option value="${esc(m.id)}" ${jour.modele === m.id ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select>
        ${edit && AF ? `<button class="btn btn-ghost" onclick="fcAffecter()">Affectations</button>` : ''}${edit && !AF ? `<button class="btn btn-ghost" onclick="fcPostes()">Postes</button><button class="btn btn-ghost" onclick="fcChoisir()">Choisir les ouvrières</button>` : ''}
        <button class="btn btn-primary" onclick="rrExcel('chaine','${date}','${date}')">Excel</button><button class="btn btn-primary" onclick="rrPdf('chaine','${date}','${date}')">PDF</button>
      </div>
      <div id="fc-kpis" style="margin-top:12px;">${fcKpisHTML(TT)}</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:8px;">Saisissez les pièces de chaque heure. Entrée = ouvrière suivante (même heure). Le chiffre gris est l'objectif de l'heure : il baisse tout seul si l'ouvrière est absente, en retard ou en sortie (état repris du pointage RH).</div>
    </div>
    <div id="fc-zone"></div>
    <datalist id="fc-postes-dl">${[...new Set(activeEmployees().map(([i, e]) => (e.poste || '').trim()).concat(fcParams().postes).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="card" style="padding:6px;"><div class="fc-scroll"><table class="fc-t"><thead><tr><th style="text-align:left;">Ouvrière</th><th>Obj/h</th>${slots.map(s => `<th>${s.label.replace(' - ', '<br>')}</th>`).join('')}<th>Total</th><th>Objectif</th><th>Rend.</th><th>Pertes</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="${slots.length + 6}" style="padding:20px;text-align:center;color:var(--ink-soft);">${mods.length ? 'Choisissez le modèle en production (liste en haut) : ses postes et ouvrières apparaissent ici.' : 'Aucun modèle : créez-les dans Params (opérations, cadences, ouvrières).'}</td></tr>`}</tbody></table></div></div>`;
}
function fcMajLigne(id){
  const date = fcDate, jour = fcJour(date), e = getEmployees()[id]; if(!e) return;
  const c = fcCalcul(id, e, date, jour);
  const set = (k, v) => { const el = document.getElementById(k + id); if(el) el.innerHTML = v; };
  set('fc-q-', c.qty); set('fc-o-', c.obj); set('fc-p-', `<span class="hour-rend ${fcCls(c.rend)}">${fcPct(c.rend)}</span>`);
  const k = document.getElementById('fc-kpis'); if(k) k.innerHTML = fcKpisHTML(fcTotaux(date, jour));
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
  const e = getEmployees()[id], jour = fcJour(fcDate), row = jour.rows[id] || {}, l = row.pertes || [], edit = canSaisie(currentUser.role);
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
window.fcModeleSet = function(mid){ const j = getJSON('fc_' + fcDate, null) || {}; j.modele = mid || null; delete j.aff; setJSON('fc_' + fcDate, j); nav('fiche-chaine'); };
window.fcAffecter = function(){
  const A = fcAff(fcDate); if(!A) return; const em = getEmployees();
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><h3 style="margin:0;">Affectations — ${esc(A.modele.nom)}</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">${fcDate.split('-').reverse().join('/')} · ouvrières par défaut du modèle, modifiables pour ce jour. Touchez « Choisir » pour changer.</div>
    <div style="max-height:58vh;overflow:auto;">${A.ops.map((o, i) => `<div style="padding:9px 0;border-bottom:1px solid var(--border-soft);display:flex;gap:8px;align-items:center;"><div style="flex:1;min-width:0;"><b>${i + 1}. ${esc(o.nom)}</b> <span style="font-size:11px;color:var(--ink-soft);">${o.cadence || ''} pcs/h</span>
      <div style="margin-top:4px;font-size:12.5px;">${o.emps.map(id => esc((em[id] || {}).nom || id)).join(', ') || '<span style="color:var(--ink-soft);">Aucune ouvrière</span>'}</div></div>
      <button class="btn btn-ghost fc-btn" onclick="fcAffPick(${i})">Choisir</button></div>`).join('')}</div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="fcFermer()">Terminer</button></div></div>`;
};
window.fcAffPick = function(i){
  const A = fcAff(fcDate); if(!A) return; const em = activeEmployees();
  const ou = {}; A.ops.forEach((o, k) => o.emps.forEach(id => { ou[id] = k; }));
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcAffecter()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><h3 style="margin:0;">${esc(A.ops[i].nom)}</h3><button class="icon-btn" onclick="fcAffecter()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">Touchez une ouvrière pour l'ajouter ou la retirer de ce poste.</div>
    <div style="max-height:58vh;overflow:auto;">${em.map(([id, e]) => { const k = ou[id], ici = k === i; return `<button type="button" class="pick-row${ici ? ' on' : ''}" onclick="fcAffToggle(${i},'${id}')"><span class="pick-ck">${ici ? '✓' : ''}</span><span style="flex:1;text-align:left;">${esc(e.nom)}</span><span style="font-size:11px;color:var(--ink-soft);">${k !== undefined && !ici ? esc(A.ops[k].nom) : ''}</span></button>`; }).join('')}</div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="fcAffecter()">Terminer</button></div></div>`;
};
window.fcAffToggle = function(i, id){
  const A = fcAff(fcDate), j = getJSON('fc_' + fcDate, null) || {}; j.aff = {};
  const deja = A.ops[i].emps.indexOf(id) >= 0;
  A.ops.forEach((o, k) => { let l = o.emps.filter(x => x !== id); if(k === i && !deja) l = l.concat(id); j.aff[k] = l; });
  setJSON('fc_' + fcDate, j); fcAffPick(i);
};
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
  const lignes = T.calc.map(x => { const c = x.c; return [x.e.nom || '', x.poste, c.etat.label].concat(c.det.map(d => d.saisi ? d.q : '')).concat([c.qty, c.obj, c.rend === null ? '' : Math.round(c.rend), c.pertes, c.listePertes.map(p => p.min + ' min ' + (p.motif || '')).join(' ; ')]); });
  return {titre:'Fiche chaîne — ' + date.split('-').reverse().join('/'), fichier:'fiche_chaine_' + date, ids:T.calc.map(x => x.id),
    entetes:['Ouvrière', 'Poste', 'État du jour'].concat(slots.map(s => s.label)).concat(['Total pièces', 'Objectif ajusté', 'Rendement %', 'Pertes (min)', 'Détail des pertes']), lignes,
    resume:[['Pièces chaîne (' + T.dernier.nom + ')', T.q], ['Objectif chaîne (goulot ' + (T.goulot ? T.goulot.nom : '—') + ')', T.o], ['Rendement', T.o ? Math.round(T.q / T.o * 100) + ' %' : '—'], ['Pertes', T.p + ' min']].concat(T.par.map(x => ['Poste ' + x.nom, x.q + '/' + x.o]))};
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
.fc-poste-l{display:block;font-size:11px;color:var(--ink-soft);margin-top:2px;font-weight:600;} .fc-modsel{padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);max-width:190px;}
.fc-poste{display:block;width:100%;margin-top:3px;padding:3px 6px;font-size:11px;border:1px dashed var(--border);border-radius:6px;background:transparent;color:var(--ink-soft);}
@media(max-width:480px){.kp{padding:11px;gap:9px;} .kp-ico{width:34px;height:34px;} .kp-ico svg{width:18px;height:18px;} .kp-ring{width:40px;height:40px;} .kp-ring i{width:30px;height:30px;font-size:10.5px;} .kp-v{font-size:21px;}}`;
document.head.appendChild(kpCss);
