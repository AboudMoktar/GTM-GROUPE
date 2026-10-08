// ============================================================
// MACHINES ET ARRÊTS — presses Lotus / Macpi, découpe laser (TEK-TREND et GADH)
// ============================================================
// Module « machines » proposé aux deux ateliers. Chaque société a ses propres
// données (l'atelier ne voit pas les arrêts de l'autre) :
//  - {soc}_machines        : {nom, type, marque, serie, cadence (pièces/h, facultatif), statut:'service'|'retiree', notes}
//  - {soc}_arrets          : {machineId, debut:'AAAA-MM-JJTHH:MM', fin:'' (vide = en cours), cause, note, par}
//  - {soc}_machines_params : {debut:'08:00', heures:8, jours:[1..6]} — plage de travail utilisée pour compter
//                            les heures perdues (un arrêt de nuit ou de dimanche ne compte pas).
// Les clés commencent par « tek_ » ou « gadh_ » : elles suivent donc le dossier
// Firebase de leur société (voir firebaseDossierDe).
//
// Disponibilité = 1 − heures de travail perdues / heures de travail de la période.
// Pièces perdues (estimation) = cadence de la machine × heures de travail perdues.
// Droits : Responsable et Chef de chaîne déclarent et modifient, Direction consulte ;
// seuls les Responsables changent les horaires.

const ARR_TYPES = {presse:'Presse', laser:'Découpe laser', couture:'Machine à coudre', coupe:'Table de coupe', autre:'Autre'};
const ARR_MARQUES = ['Lotus', 'Macpi', 'Morgan Tecnica', 'Autre'];
const ARR_CAUSES = {
  mecanique:  {label:'Panne mécanique',    cls:'bad'},
  electrique: {label:'Panne électrique',   cls:'bad'},
  pieces:     {label:'Attente de pièces',  cls:'warn'},
  reglage:    {label:'Réglage / changement de série', cls:'excellent'},
  maintenance:{label:'Maintenance planifiée', cls:'good'},
  courant:    {label:'Coupure de courant', cls:'warn'},
  matiere:    {label:'Manque de matière',  cls:'warn'},
  autre:      {label:'Autre',              cls:''}
};
const ARR_JOURS_NOMS = [['1', 'L'], ['2', 'M'], ['3', 'M'], ['4', 'J'], ['5', 'V'], ['6', 'S'], ['0', 'D']];
const ARR_MODELES = [
  {nom:'Presse Lotus',     type:'presse', marque:'Lotus'},
  {nom:'Presse Macpi',     type:'presse', marque:'Macpi'},
  {nom:'Découpe laser',    type:'laser',  marque:'Autre'}
];

// --- Données ---
function arrSoc(){ return activeSociete === 'gadh' ? 'gadh' : 'tek'; }
function arrCle(soc, nom){ return soc + '_' + nom; }
function arrMachines(soc){ return getJSON(arrCle(soc, 'machines'), {}) || {}; }
function arrArrets(soc){ return getJSON(arrCle(soc, 'arrets'), {}) || {}; }
function arrParams(soc){
  const p = Object.assign({debut:'08:00', heures:8, jours:[1, 2, 3, 4, 5, 6]}, getJSON(arrCle(soc, 'machines_params'), {}) || {});
  p.jours = Array.isArray(p.jours) ? p.jours.map(Number) : Object.values(p.jours || {}).map(Number);
  return p;
}
function canEditArr(){ return !!currentUser && currentUser.role !== 'viewer'; }
function arrMachineNom(soc, id){ const m = arrMachines(soc)[id]; return m ? m.nom : '(machine supprimée)'; }

// --- Temps ---
function arrMaintenant(){
  const d = new Date();
  return toISODateLocal(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function arrTs(s){ return new Date(s).getTime(); }
function arrDuree(min){
  min = Math.max(0, Math.round(min));
  if(min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60;
  return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
}
function arrFmtDateHeure(s){
  if(!s) return '—';
  const [d, h] = s.split('T');
  return d.split('-').reverse().slice(0, 2).join('/') + ' ' + (h || '');
}
// Minutes de travail (plage définie dans les paramètres) comprises entre deux instants.
function arrMinutesOuvrees(soc, debut, fin){
  const P = arrParams(soc), [hh, mm] = P.debut.split(':').map(Number);
  const a = arrTs(debut), b = arrTs(fin);
  if(!(b > a)) return 0;
  let total = 0;
  const jour = new Date(a); jour.setHours(0, 0, 0, 0);
  for(let i = 0; i < 400 && jour.getTime() < b; i++){
    if(P.jours.indexOf(jour.getDay()) >= 0){
      const ouv = new Date(jour); ouv.setHours(hh || 0, mm || 0, 0, 0);
      const s = Math.max(a, ouv.getTime()), e = Math.min(b, ouv.getTime() + P.heures * 3600000);
      if(e > s) total += (e - s) / 60000;
    }
    jour.setDate(jour.getDate() + 1);
  }
  return total;
}
function arrPeriode(code){
  const auj = getTodayISO(), maintenant = arrMaintenant();
  let de;
  if(code === 'mois') de = auj.slice(0, 8) + '01';
  else if(code === '30j'){ const d = new Date(); d.setDate(d.getDate() - 29); de = toISODateLocal(d); }
  else de = '2000-01-01';
  return {de:de + 'T00:00', a:maintenant};
}
// Arrêts de la société qui touchent la période, avec leurs minutes calendaires et ouvrées dans la période.
function arrArretsPeriode(soc, periode, machineId){
  const res = [];
  Object.entries(arrArrets(soc)).forEach(([id, a]) => {
    if(machineId && a.machineId !== machineId) return;
    const fin = a.fin || arrMaintenant();
    if(fin < periode.de || a.debut > periode.a) return;
    const d = a.debut > periode.de ? a.debut : periode.de, f = fin < periode.a ? fin : periode.a;
    res.push({id, a, calendaire:Math.max(0, (arrTs(f) - arrTs(d)) / 60000), ouvrees:arrMinutesOuvrees(soc, d, f)});
  });
  return res.sort((x, y) => y.a.debut.localeCompare(x.a.debut));
}
function arrOuverts(soc){
  const ms = arrMachines(soc), now = arrMaintenant();
  return Object.entries(arrArrets(soc)).filter(([, a]) => !a.fin).map(([id, a]) => ({
    id, a, machine:ms[a.machineId] || null, minutes:Math.max(0, (arrTs(now) - arrTs(a.debut)) / 60000)
  })).sort((x, y) => y.minutes - x.minutes);
}
function arrStats(soc, periode, machineId){
  const liste = arrArretsPeriode(soc, periode, machineId);
  const ouvrees = liste.reduce((s, x) => s + x.ouvrees, 0);
  const travail = arrMinutesOuvrees(soc, periode.de, periode.a);
  const ms = arrMachines(soc);
  let perdues = 0;
  liste.forEach(x => { const m = ms[x.a.machineId]; if(m && Number(m.cadence) > 0) perdues += Number(m.cadence) * x.ouvrees / 60; });
  return {nb:liste.length, ouvrees, travail, perdues:Math.round(perdues), liste};
}
// Disponibilité moyenne du parc ou d'une machine : null tant qu'aucune heure de travail n'est écoulée.
function arrDispo(soc, periode, machineId){
  const n = machineId ? 1 : Object.values(arrMachines(soc)).filter(m => m.statut !== 'retiree').length;
  const s = arrStats(soc, periode, machineId);
  if(!n || s.travail <= 0) return null;
  return Math.max(0, Math.min(100, 100 - s.ouvrees / (s.travail * n) * 100));
}
// Résumé pour l'écran direction.
function arrResume(soc){
  const o = arrOuverts(soc);
  return {ouverts:o.length, plusLong:o.length ? o[0].minutes : 0};
}
function arrClasseDispo(p){ return p === null ? '' : (p >= 95 ? 'good' : (p >= 90 ? 'warn' : 'bad')); }

// --- Routage ---
function arrNavItems(){
  return [
    {tab:'arr-dashboard', label:'Aujourd\'hui', icon:ICONS.dashboard, show:true},
    {tab:'arr-liste', label:'Arrêts', icon:ICONS.wrench, show:true},
    {tab:'arr-parc', label:'Machines', icon:ICONS.factory, show:true}
  ];
}
function renderArr(tab, main){
  ({'arr-dashboard':renderArrDashboard, 'arr-liste':renderArrListe, 'arr-parc':renderArrParc})[tab](main);
}
function arrSection(container, titre, actions){
  container.innerHTML = `<div class="flex-header"><h2>${titre}</h2>${actions ? `<div class="actions">${actions}</div>` : ''}</div><div id="arr-body"></div>`;
  return document.getElementById('arr-body');
}
function arrBadgeCause(c){ const d = ARR_CAUSES[c] || ARR_CAUSES.autre; return `<span class="hour-rend ${d.cls}" style="font-size:11px;">${esc(d.label)}</span>`; }
function arrOptionsMachines(soc, vide, inclureRetirees){
  const l = Object.entries(arrMachines(soc)).filter(([, m]) => inclureRetirees || m.statut !== 'retiree')
    .sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '')).map(([id, m]) => [id, m.nom]);
  return (vide ? [['', vide]] : []).concat(l);
}

// ============================================================
// AUJOURD'HUI
// ============================================================
function renderArrDashboard(main){
  const soc = arrSoc();
  const b = arrSection(main, ICONS.wrench + ' Machines · ' + SOCIETES[soc].nom, canEditArr() ? `<button class="btn btn-primary" onclick="arrFormArret('')">+ Arrêt</button>` : '');
  const ms = Object.entries(arrMachines(soc)).filter(([, m]) => m.statut !== 'retiree').sort((x, y) => (x[1].nom || '').localeCompare(y[1].nom || ''));
  if(!ms.length){
    b.innerHTML = `<div class="card">${buildEmptyState('Aucune machine enregistrée')}
      <button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="nav('arr-parc')">Ajouter les machines de l'atelier</button></div>`;
    return;
  }
  const ouverts = arrOuverts(soc), enArret = new Set(ouverts.map(o => o.a.machineId));
  const mois = arrPeriode('mois'), st = arrStats(soc, mois), dispo = arrDispo(soc, mois);
  const tuile = (v, l, cls, tab) => `<div class="kpi-mini" style="cursor:pointer;" onclick="nav('${tab}')"><div style="font-family:var(--mono);font-size:20px;font-weight:800;" class="${cls || ''}">${v}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">${l}</div></div>`;
  const causes = {};
  st.liste.forEach(x => { causes[x.a.cause] = (causes[x.a.cause] || 0) + x.ouvrees; });
  const maxCause = Math.max(1, ...Object.values(causes));
  b.innerHTML = `
    <div class="kpi-mini-grid">
      ${tuile((ms.length - enArret.size) + '/' + ms.length, 'En service', '', 'arr-parc')}
      ${tuile(ouverts.length, 'À l\'arrêt', ouverts.length ? 'hour-rend bad' : '', 'arr-liste')}
      ${tuile(st.nb, 'Arrêts du mois', '', 'arr-liste')}
      ${tuile(arrDuree(st.ouvrees), 'Heures perdues', st.ouvrees ? 'hour-rend warn' : '', 'arr-liste')}
    </div>
    <div class="kpi-mini-grid" style="grid-template-columns:repeat(2,1fr);">
      ${tuile(dispo === null ? '—' : Math.round(dispo * 10) / 10 + ' %', 'Disponibilité du mois', 'hour-rend ' + arrClasseDispo(dispo), 'arr-parc')}
      ${tuile(st.perdues ? '≈ ' + st.perdues : '—', 'Pièces perdues (estimation)', st.perdues ? 'hour-rend warn' : '', 'arr-liste')}
    </div>
    <div class="card">
      <h3 style="margin:0 0 8px;font-size:14px;${ouverts.length ? 'color:var(--bad);' : ''}">À l'arrêt maintenant (${ouverts.length})</h3>
      ${ouverts.length ? ouverts.map(o => `
        <div class="session-row">
          <div style="min-width:0;">
            <div style="font-weight:800;">${esc(o.machine ? o.machine.nom : '(machine supprimée)')}</div>
            <div style="font-size:12px;color:var(--ink-soft);">${arrBadgeCause(o.a.cause)} · depuis ${esc(arrFmtDateHeure(o.a.debut))} · <b>${arrDuree(o.minutes)}</b></div>
            ${o.a.note ? `<div style="font-size:12px;color:var(--ink-soft);white-space:normal;">${esc(o.a.note)}</div>` : ''}
          </div>
          ${canEditArr() ? `<button class="btn btn-success" style="padding:8px 11px;font-size:12.5px;flex-shrink:0;" onclick="arrFormFin('${o.id}')">Remise en service</button>` : ''}
        </div>`).join('') : '<div style="font-size:13px;color:var(--good);font-weight:700;">Toutes les machines tournent.</div>'}
    </div>
    <div class="card">
      <h3 style="margin:0 0 8px;font-size:14px;">Parc</h3>
      ${ms.map(([id, m]) => `
        <div class="session-row">
          <div><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;background:${enArret.has(id) ? 'var(--bad)' : 'var(--good)'};"></span><b>${esc(m.nom)}</b>
            <span style="font-size:12px;color:var(--ink-soft);"> · ${esc(ARR_TYPES[m.type] || '')}</span></div>
          ${canEditArr() && !enArret.has(id) ? `<button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="arrFormArret('', '${id}')">Déclarer un arrêt</button>` : ''}
        </div>`).join('')}
    </div>
    ${Object.keys(causes).length ? `<div class="card">
      <h3 style="margin:0 0 10px;font-size:14px;">Causes du mois (heures de travail perdues)</h3>
      ${Object.entries(causes).sort((x, y) => y[1] - x[1]).map(([c, min]) => `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;"><span>${esc((ARR_CAUSES[c] || ARR_CAUSES.autre).label)}</span><b>${arrDuree(min)}</b></div>
          <div style="height:7px;border-radius:20px;background:var(--surface-3);overflow:hidden;"><div style="height:100%;width:${Math.round(min / maxCause * 100)}%;background:var(--warn);border-radius:20px;"></div></div>
        </div>`).join('')}
    </div>` : ''}`;
}

// ============================================================
// LISTE DES ARRÊTS
// ============================================================
let arrFiltre = {m:'', p:'mois', c:''};
window.arrChanger = (k, v) => { arrFiltre[k] = v; nav('arr-liste'); };
function renderArrListe(main){
  const soc = arrSoc();
  const b = arrSection(main, ICONS.wrench + ' Arrêts', canEditArr() ? `<button class="btn btn-primary" onclick="arrFormArret('')">+ Arrêt</button>` : '');
  const periode = arrPeriode(arrFiltre.p);
  let liste = arrArretsPeriode(soc, periode, arrFiltre.m || null);
  if(arrFiltre.c) liste = liste.filter(x => x.a.cause === arrFiltre.c);
  const tot = liste.reduce((s, x) => s + x.ouvrees, 0);
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
  b.innerHTML = `
    <div class="card" style="padding:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <select class="mgt-in" onchange="arrChanger('m', this.value)">${arrOptionsMachines(soc, 'Toutes les machines', true).map(([k, l]) => opt(k, l, arrFiltre.m)).join('')}</select>
        <select class="mgt-in" onchange="arrChanger('p', this.value)">${[['mois', 'Ce mois'], ['30j', '30 derniers jours'], ['tout', 'Tout']].map(([k, l]) => opt(k, l, arrFiltre.p)).join('')}</select>
        <select class="mgt-in" style="grid-column:1 / -1;" onchange="arrChanger('c', this.value)">${opt('', 'Toutes les causes', arrFiltre.c)}${Object.entries(ARR_CAUSES).map(([k, d]) => opt(k, d.label, arrFiltre.c)).join('')}</select>
      </div>
      <div style="font-size:12px;color:var(--ink-soft);margin-top:8px;">${liste.length} arrêt${liste.length > 1 ? 's' : ''} · ${arrDuree(tot)} de travail perdues</div>
    </div>
    ${liste.length ? liste.map(x => `
      <div class="card" style="padding:10px 12px;${canEditArr() ? 'cursor:pointer;' : ''}${x.a.fin ? '' : 'border-left:4px solid var(--bad);'}" ${canEditArr() ? `onclick="arrFormArret('${x.id}')"` : ''}>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
          <b>${esc(arrMachineNom(soc, x.a.machineId))}</b>
          ${arrBadgeCause(x.a.cause)}
        </div>
        <div style="font-size:12.5px;color:var(--ink-soft);margin-top:3px;">${esc(arrFmtDateHeure(x.a.debut))} → ${x.a.fin ? esc(arrFmtDateHeure(x.a.fin)) : '<b style="color:var(--bad);">en cours</b>'}
          · ${arrDuree(x.calendaire)} <span style="color:var(--ink-faint);">(dont ${arrDuree(x.ouvrees)} de travail)</span></div>
        ${x.a.note ? `<div style="font-size:12.5px;margin-top:3px;white-space:normal;">${esc(x.a.note)}</div>` : ''}
        ${x.a.par ? `<div style="font-size:11px;color:var(--ink-faint);margin-top:3px;">Déclaré par ${esc(x.a.par)}</div>` : ''}
      </div>`).join('') : `<div class="card">${buildEmptyState('Aucun arrêt sur cette période')}</div>`}`;
}

// --- Formulaires d'arrêt ---
window.arrFormArret = (id, machineId) => {
  if(!canEditArr()) return;
  const soc = arrSoc();
  if(!arrOptionsMachines(soc, '', false).length){ showToast('Ajoutez d\'abord une machine'); nav('arr-parc'); return; }
  const a = id ? arrArrets(soc)[id] : {machineId:machineId || '', debut:arrMaintenant(), fin:'', cause:'mecanique', note:''};
  if(!a){ return; }
  mgtModal(id ? 'Modifier l\'arrêt' : 'Déclarer un arrêt', `
    ${mgtSelect('Machine *', 'ar-machine', arrOptionsMachines(soc, '— Choisir —', !!id), a.machineId)}
    ${mgtChamp('Début *', 'ar-debut', a.debut, 'datetime-local')}
    ${mgtChamp('Fin (laisser vide si la machine est toujours à l\'arrêt)', 'ar-fin', a.fin, 'datetime-local')}
    ${mgtSelect('Cause', 'ar-cause', Object.entries(ARR_CAUSES).map(([k, d]) => [k, d.label]), a.cause)}
    ${mgtZone('Note', 'ar-note', a.note)}
    <button class="btn btn-primary" style="width:100%;" onclick="arrSauverArret('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="arrSupprimerArret('${id}')">Supprimer cet arrêt</button>` : ''}`);
};
window.arrSauverArret = (id) => {
  const soc = arrSoc(), machineId = mgtVal('ar-machine'), debut = mgtVal('ar-debut'), fin = mgtVal('ar-fin');
  if(!machineId || !debut){ showToast('Machine et début obligatoires'); return; }
  if(fin && fin <= debut){ showToast('La fin doit être après le début'); return; }
  if(!fin && debut > arrMaintenant()){ showToast('Le début ne peut pas être dans le futur'); return; }
  const l = arrArrets(soc);
  if(!fin && Object.entries(l).some(([k, x]) => k !== id && x.machineId === machineId && !x.fin)){
    showToast('Cette machine a déjà un arrêt en cours'); return;
  }
  const nid = id || mgtId('a');
  l[nid] = {...(l[nid] || {}), machineId, debut, fin, cause:mgtVal('ar-cause'), note:mgtVal('ar-note'), par:(l[nid] && l[nid].par) || currentUser.nom};
  setJSON(arrCle(soc, 'arrets'), l);
  mgtFermer(); showToast(fin ? 'Arrêt enregistré' : 'Machine déclarée à l\'arrêt');
  nav(activeTab);
};
// Confirmation dans la fenêtre (confirm() est bloqué dans certains cadres intégrés).
function arrConfirmer(titre, texte, action){
  mgtModal(titre, `<p style="margin:0 0 14px;font-size:13.5px;">${texte}</p>
    <button class="btn" style="width:100%;background:var(--bad);color:#fff;" onclick="${action}">Oui, supprimer</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer()">Annuler</button>`);
}
window.arrSupprimerArret = (id) => arrConfirmer('Supprimer cet arrêt ?', 'L\'arrêt sera retiré de l\'historique et des statistiques.', "arrSupprimerArretOk('" + id + "')");
window.arrSupprimerArretOk = (id) => {
  const soc = arrSoc(), l = arrArrets(soc);
  delete l[id]; setJSON(arrCle(soc, 'arrets'), l);
  mgtFermer(); nav(activeTab);
};
window.arrFormFin = (id) => {
  if(!canEditArr()) return;
  const soc = arrSoc(), a = arrArrets(soc)[id]; if(!a) return;
  mgtModal('Remise en service', `
    <p style="margin:0 0 10px;font-size:13px;"><b>${esc(arrMachineNom(soc, a.machineId))}</b> · à l'arrêt depuis ${esc(arrFmtDateHeure(a.debut))}</p>
    ${mgtChamp('Remise en service à', 'ar-fin', arrMaintenant(), 'datetime-local')}
    ${mgtZone('Travaux effectués (facultatif)', 'ar-note', a.note)}
    <button class="btn btn-success" style="width:100%;" onclick="arrConfirmerFin('${id}')">Confirmer</button>`);
};
window.arrConfirmerFin = (id) => {
  const soc = arrSoc(), l = arrArrets(soc), a = l[id]; if(!a) return;
  const fin = mgtVal('ar-fin');
  if(!fin || fin <= a.debut){ showToast('La remise en service doit être après le début'); return; }
  l[id] = {...a, fin, note:mgtVal('ar-note')};
  setJSON(arrCle(soc, 'arrets'), l);
  mgtFermer(); showToast('Machine remise en service');
  nav(activeTab);
};

// ============================================================
// PARC DE MACHINES
// ============================================================
function renderArrParc(main){
  const soc = arrSoc();
  const b = arrSection(main, ICONS.factory.replace('width="13" height="13"', 'width="20" height="20"') + ' Machines', canEditArr() ? `<button class="btn btn-primary" onclick="arrFormMachine('')">+ Machine</button>` : '');
  const ms = Object.entries(arrMachines(soc)).sort((x, y) => (x[1].nom || '').localeCompare(y[1].nom || ''));
  const mois = arrPeriode('mois'), enArret = new Set(arrOuverts(soc).map(o => o.a.machineId));
  if(!ms.length){
    b.innerHTML = `<div class="card">${buildEmptyState('Aucune machine enregistrée')}
      ${canEditArr() ? `<div style="font-size:12.5px;color:var(--ink-soft);margin:8px 0;text-align:center;">Ajout rapide :</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">${ARR_MODELES.map((m, i) => `<button class="btn btn-ghost" onclick="arrAjoutRapide(${i})">+ ${esc(m.nom)}</button>`).join('')}</div>` : ''}</div>`;
  } else {
    b.innerHTML = ms.map(([id, m]) => {
      const s = arrStats(soc, mois, id), d = m.statut === 'retiree' ? null : arrDispo(soc, mois, id);
      return `<div class="card" style="padding:11px 12px;${m.statut === 'retiree' ? 'opacity:.55;' : ''}${canEditArr() ? 'cursor:pointer;' : ''}" ${canEditArr() ? `onclick="arrFormMachine('${id}')"` : ''}>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
          <b><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;background:${m.statut === 'retiree' ? 'var(--ink-faint)' : (enArret.has(id) ? 'var(--bad)' : 'var(--good)')};"></span>${esc(m.nom)}</b>
          <span style="font-size:12px;color:var(--ink-soft);">${esc(ARR_TYPES[m.type] || '')}${m.marque && m.marque !== 'Autre' ? ' · ' + esc(m.marque) : ''}${m.statut === 'retiree' ? ' · retirée' : ''}</span>
        </div>
        <div style="font-size:12.5px;color:var(--ink-soft);margin-top:4px;">${s.nb} arrêt${s.nb > 1 ? 's' : ''} ce mois · ${arrDuree(s.ouvrees)} perdues
          ${d === null ? '' : ` · disponibilité <b class="hour-rend ${arrClasseDispo(d)}" style="font-size:12.5px;">${Math.round(d * 10) / 10} %</b>`}
          ${s.perdues ? ` · ≈ ${s.perdues} pièces` : ''}</div>
        ${m.serie || m.cadence ? `<div style="font-size:11.5px;color:var(--ink-faint);margin-top:2px;">${m.serie ? 'N° ' + esc(m.serie) : ''}${m.serie && m.cadence ? ' · ' : ''}${m.cadence ? esc(String(m.cadence)) + ' pièces/h' : ''}</div>` : ''}
      </div>`;
    }).join('');
  }
  if(currentUser.role === 'admin'){
    const P = arrParams(soc);
    b.insertAdjacentHTML('beforeend', `<div class="card">
      <h3 style="margin:0 0 4px;font-size:14px;">Horaires de travail</h3>
      <p style="font-size:12px;color:var(--ink-soft);margin:0 0 10px;">Sert à compter les heures perdues : un arrêt la nuit ou le dimanche n'est pas décompté.</p>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;">${mgtChamp('Début de journée', 'ap-debut', P.debut, 'time')}</div>
        <div style="flex:1;">${mgtChamp('Heures par jour', 'ap-heures', P.heures, 'number', 'min="1" max="24" step="0.5"')}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">${ARR_JOURS_NOMS.map(([n, l]) => `<label style="display:flex;align-items:center;gap:4px;font-weight:700;font-size:13px;"><input type="checkbox" id="ap-j${n}" ${P.jours.indexOf(Number(n)) >= 0 ? 'checked' : ''} style="width:auto;"> ${l}</label>`).join('')}</div>
      <button class="btn btn-primary" style="width:100%;" onclick="arrSauverParams()">Enregistrer les horaires</button>
    </div>`);
  }
}
window.arrSauverParams = () => {
  const soc = arrSoc(), debut = mgtVal('ap-debut') || '08:00', heures = Number(mgtVal('ap-heures'));
  const jours = ARR_JOURS_NOMS.map(([n]) => n).filter(n => document.getElementById('ap-j' + n).checked).map(Number);
  if(!(heures > 0) || !jours.length){ showToast('Indiquez les heures par jour et au moins un jour travaillé'); return; }
  setJSON(arrCle(soc, 'machines_params'), {debut, heures, jours});
  showToast('Horaires enregistrés'); nav('arr-parc');
};
window.arrAjoutRapide = (i) => {
  const soc = arrSoc(), l = arrMachines(soc), m = ARR_MODELES[i];
  const memes = Object.values(l).filter(x => x.nom === m.nom || (x.nom || '').indexOf(m.nom + ' ') === 0).length;
  l[mgtId('m')] = {nom:m.nom + (memes ? ' ' + (memes + 1) : ''), type:m.type, marque:m.marque, serie:'', cadence:'', statut:'service', notes:''};
  setJSON(arrCle(soc, 'machines'), l);
  nav('arr-parc');
};
window.arrFormMachine = (id) => {
  if(!canEditArr()) return;
  const soc = arrSoc();
  const m = id ? arrMachines(soc)[id] : {nom:'', type:'presse', marque:'Lotus', serie:'', cadence:'', statut:'service', notes:''};
  if(!m) return;
  mgtModal(id ? 'Modifier la machine' : 'Nouvelle machine', `
    ${mgtChamp('Nom *', 'am-nom', m.nom, 'text', 'placeholder="Ex : Presse Lotus 1"')}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtSelect('Type', 'am-type', Object.entries(ARR_TYPES), m.type)}</div><div style="flex:1;">${mgtSelect('Marque', 'am-marque', ARR_MARQUES.map(x => [x, x]), m.marque)}</div></div>
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('N° de série', 'am-serie', m.serie)}</div><div style="flex:1;">${mgtChamp('Cadence (pièces/h)', 'am-cadence', m.cadence, 'number', 'min="0" step="1" placeholder="facultatif"')}</div></div>
    ${mgtSelect('État', 'am-statut', [['service', 'En service'], ['retiree', 'Retirée du parc']], m.statut)}
    ${mgtZone('Notes', 'am-notes', m.notes)}
    <button class="btn btn-primary" style="width:100%;" onclick="arrSauverMachine('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="arrSupprimerMachine('${id}')">Supprimer la machine</button>` : ''}`);
};
window.arrSauverMachine = (id) => {
  const soc = arrSoc(), nom = mgtVal('am-nom');
  if(!nom){ showToast('Le nom est obligatoire'); return; }
  const l = arrMachines(soc), nid = id || mgtId('m');
  l[nid] = {...(l[nid] || {}), nom, type:mgtVal('am-type'), marque:mgtVal('am-marque'), serie:mgtVal('am-serie'), cadence:mgtVal('am-cadence'), statut:mgtVal('am-statut'), notes:mgtVal('am-notes')};
  setJSON(arrCle(soc, 'machines'), l);
  mgtFermer(); showToast('Machine enregistrée'); nav('arr-parc');
};
window.arrSupprimerMachine = (id) => {
  const soc = arrSoc();
  if(Object.values(arrArrets(soc)).some(a => a.machineId === id)){ showToast('Cette machine a un historique d\'arrêts : retirez-la du parc plutôt que de la supprimer'); return; }
  arrConfirmer('Supprimer cette machine ?', 'Elle sera retirée du parc.', "arrSupprimerMachineOk('" + id + "')");
};
window.arrSupprimerMachineOk = (id) => {
  const soc = arrSoc(), l = arrMachines(soc);
  delete l[id]; setJSON(arrCle(soc, 'machines'), l);
  mgtFermer(); nav('arr-parc');
};
