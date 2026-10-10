// RH : boutons d'état rapides au pointage + onglet « Rapports » (journalier, hebdomadaire, mensuel par ouvrière, paie).
// Les rapports donnent l'état de chaque ouvrière (présente, retard, sortie, absente, congé, maladie…) et les heures :
// aucun chiffre de rendement, l'état sert seulement à ajuster le rendement.

// ---------- Pointage manuel : boutons d'état ----------
const RR_ETATS = [['present', 'Présent'], ['retard', 'Retard'], ['sortie', 'Sortie'], ['absent', 'Absent'], ['conge', 'Congé'], ['maladie', 'Maladie']];
function rrHeureMaintenant(){ const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function rrLireHeure(question){
  const t = prompt(question, rrHeureMaintenant()); if(t === null) return null;
  const m = String(t).trim().replace('h', ':').replace('H', ':').match(/^(\d{1,2}):?(\d{2})$/);
  if(!m || +m[1] > 23 || +m[2] > 59){ showToast('Heure non valide (exemple : 08:15)'); return null; }
  return String(m[1]).padStart(2, '0') + ':' + m[2];
}
window.rrEtat = function(empId, etat){
  const date = rhAttDate, a = getAttendance(date), cur = a[empId] || {};
  if(etat === 'conge' || etat === 'maladie'){
    showAbsenceForm(empId); setTimeout(() => { const s = document.getElementById('ab-type'); if(s) s.value = etat; }, 0); return;
  }
  if(etat === 'present') a[empId] = {status:'present', src:'manuel'};
  else if(etat === 'absent') a[empId] = {status:'absent', src:'manuel'};
  else if(etat === 'retard'){ const t = rrLireHeure("Heure d'arrivée (exemple 08:15)"); if(!t) return; a[empId] = {...cur, status:'present', in:t, src:'manuel'}; }
  else if(etat === 'sortie'){ const t = rrLireHeure('Heure de sortie (exemple 10:30)'); if(!t) return; a[empId] = {...cur, status:'present', src:'manuel', autorisations:[...(cur.autorisations || []), {sortie:t, retour:'', prevue:''}]}; }
  saveAttendance(date, a); nav('rh-pointage');
};
const rrCarteOrigine = window.rhPointageCard;
window.rhPointageCard = function(x, canEdit){
  const html = rrCarteOrigine(x, canEdit);
  if(!canEdit || x.r.source === 'periode') return html;
  const r = x.r, st = r.source === 'pointage' ? r.status : '';
  const actif = {present: st === 'present' && !computeRetardHours(r) && !(r.autorisations || []).length, retard: st === 'present' && computeRetardHours(r) > 0, sortie: st === 'present' && (r.autorisations || []).length > 0, absent: st === 'absent'};
  const chips = `<div class="rr-chips">${RR_ETATS.map(([k, l]) => `<button class="rr-chip rr-${k}${actif[k] ? ' on' : ''}" onclick="rrEtat('${x.id}','${k}')">${l}</button>`).join('')}</div>`;
  return html.replace(/<\/div>\s*$/, chips + '</div>');
};

// ---------- Données des rapports ----------
const RR_CODES = {P:'Présent', R:'Retard', S:'Sortie (autorisation)', A:'Absent', C:'Congé', M:'Maladie', AA:'Absence autorisée', ANJ:'Absence non justifiée', X:'Autre absence', '?':'Non renseigné', '—':'Jour non travaillé'};
const RR_COULEURS = {P:'FFD1F5E0', R:'FFFFE3B3', S:'FFFFF2B3', A:'FFFAD0CF', C:'FFD6E4FF', M:'FFE9D5FF', AA:'FFFFE3B3', ANJ:'FFFAD0CF', X:'FFEDEDED', '?':'FFFFFFFF', '—':'FFEEEEEE'};
function rrFr(iso){ return iso.split('-').reverse().join('/'); }
function rrJoursDe(debut, fin){ const l = []; const c = new Date(debut + 'T00:00:00'), f = new Date(fin + 'T00:00:00'); while(c <= f && l.length < 400){ l.push(toISODateLocal(c)); c.setDate(c.getDate() + 1); } return l; }
function rrNum(n){ return Math.round((n || 0) * 100) / 100; }
function rrJour(empId, d){
  const prevues = getPlannedHoursForDate(d);
  if(!getSlotsForDate(d).length) return {code:'—', prevues:0, travaillees:0, retardH:0, autH:0, nbSorties:0, arrivee:'', depart:'', motif:''};
  const r = resolveDayStatus(empId, d), base = {prevues, travaillees:0, retardH:0, autH:0, nbSorties:0, arrivee:'', depart:'', motif:''};
  if(r.source === 'periode'){ return {...base, code:{conge:'C', maladie:'M', autorisee:'AA', injustifiee:'ANJ', autre:'X'}[r.type] || 'X', motif:r.motif || ''}; }
  if(r.source === 'pointage'){
    if(r.status === 'absent') return {...base, code:'A'};
    const retardH = computeRetardHours(r), autH = computeAutorisationsHours(r), nb = (r.autorisations || []).length;
    return {...base, code: retardH > 0 ? 'R' : nb ? 'S' : 'P', retardH, autH, nbSorties:nb, arrivee:r.in || '', depart:r.out || '', travaillees:Math.max(0, prevues - retardH - autH)};
  }
  return {...base, code:'?'};
}
function rrLundi(iso){ const d = new Date(iso + 'T00:00:00'), j = (d.getDay() + 6) % 7; d.setDate(d.getDate() - j); return toISODateLocal(d); }
function rrDonnees(type, ref){
  const emps = activeEmployees();
  const nom = (e) => e.nom || '';
  if(type === 'jour'){
    const lignes = emps.map(([id, e]) => { const j = rrJour(id, ref); return [e.matricule || '', nom(e), e.poste || '', j.code, RR_CODES[j.code], j.arrivee, j.depart, rrNum(j.retardH), rrNum(j.autH), rrNum(j.travaillees), j.motif]; });
    const cnt = (c) => lignes.filter(l => l[3] === c).length;
    return {titre:'Rapport journalier — ' + rrFr(ref), fichier:'RH_journalier_' + ref, entetes:['Matricule', 'Nom', 'Poste', 'Code', 'État', 'Arrivée', 'Départ', 'Retard (h)', 'Sorties (h)', 'Heures travaillées', 'Observation'], lignes, colCode:3,
      resume:[['Effectif', emps.length], ['Présents', cnt('P') + cnt('R') + cnt('S')], ['dont retards', cnt('R')], ['dont sorties', cnt('S')], ['Absents', cnt('A') + cnt('ANJ') + cnt('AA') + cnt('X')], ['Congés', cnt('C')], ['Maladies', cnt('M')], ['Non renseignés', cnt('?')]]};
  }
  if(type === 'semaine' || type === 'mois'){
    let jours, titre, fichier;
    if(type === 'semaine'){ const l = rrLundi(ref); jours = rrJoursDe(l, (() => { const d = new Date(l + 'T00:00:00'); d.setDate(d.getDate() + 6); return toISODateLocal(d); })()); titre = 'Rapport hebdomadaire — du ' + rrFr(jours[0]) + ' au ' + rrFr(jours[6]); fichier = 'RH_hebdo_' + jours[0]; }
    else { jours = rrJoursDe(ref + '-01', ref + '-' + String(daysInMonth(ref)).padStart(2, '0')); titre = 'Rapport mensuel par ouvrière — ' + monthLabel(ref); fichier = 'RH_mensuel_' + ref; }
    const jl = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
    const entetes = ['Nom', 'Poste'].concat(jours.map(d => (type === 'semaine' ? jl[new Date(d + 'T00:00:00').getDay()] + ' ' : '') + d.slice(8))).concat(['Présences', 'Retards (j)', 'Retard (h)', 'Sorties (h)', 'Absences', 'Congés', 'Maladies', 'Heures prévues', 'Heures travaillées']);
    const lignes = emps.map(([id, e]) => {
      const js = jours.map(d => rrJour(id, d)), n = (...cs) => js.filter(j => cs.indexOf(j.code) >= 0).length, s = (k) => js.reduce((t, j) => t + j[k], 0);
      return [nom(e), e.poste || ''].concat(js.map(j => j.code === '—' ? '' : j.code === '?' ? '' : j.code)).concat([n('P', 'R', 'S'), n('R'), rrNum(s('retardH')), rrNum(s('autH')), n('A', 'ANJ', 'AA', 'X'), n('C'), n('M'), rrNum(s('prevues')), rrNum(s('travaillees'))]);
    });
    return {titre, fichier, entetes, lignes, matrice:{debut:2, fin:2 + jours.length - 1}, jours, resume:[['Effectif', emps.length]]};
  }
  if(type === 'paie'){
    const jours = rrJoursDe(ref + '-01', ref + '-' + String(daysInMonth(ref)).padStart(2, '0')), base = getMonthlyBase(ref);
    const prevues = jours.reduce((t, d) => t + getPlannedHoursForDate(d), 0);
    const lignes = emps.map(([id, e]) => {
      const s = computeMonthlyStats(id, ref), c = s.counts;
      return [e.matricule || '', nom(e), e.poste || '', c.present || 0, c.conge || 0, c.maladie || 0, c.autorisee || 0, (c.absent || 0) + (c.injustifiee || 0), rrNum(s.retardH), rrNum(s.autorisationH), rrNum(prevues), rrNum(s.heuresTravaillees), base != null ? rrNum(base) : '', s.heuresSupp != null ? rrNum(s.heuresSupp) : ''];
    });
    return {titre:'Rapport pour la paie — ' + monthLabel(ref), fichier:'RH_paie_' + ref, entetes:['Matricule', 'Nom', 'Poste', 'Jours présents', 'Congés', 'Maladies', 'Abs. autorisées', 'Abs. non justifiées', 'Retards (h)', 'Sorties (h)', 'Heures prévues', 'Heures travaillées', 'Base mensuelle', 'Heures supp.'], lignes,
      resume:[['Effectif', emps.length], ['Base mensuelle', base != null ? base + ' h' : 'non définie']]};
  }
  return null;
}

// ---------- Excel ----------
window.rrExcel = async function(type, ref){
  try { await chargerBib('exceljs'); } catch(e) {}
  if(typeof ExcelJS === 'undefined'){ showToast('Bibliothèque Excel indisponible — vérifiez la connexion internet.'); return; }
  const D = rrDonnees(type, ref); if(!D) return;
  const wb = new ExcelJS.Workbook(); wb.creator = 'TEK-TREND'; wb.created = new Date();
  const ws = wb.addWorksheet('Rapport RH'), nb = D.entetes.length;
  ws.mergeCells(1, 1, 1, nb); ws.getCell(1, 1).value = 'TEK-TREND — ' + D.titre; ws.getCell(1, 1).font = {bold:true, size:14, color:{argb:'FF0F3D66'}};
  ws.getCell(2, 1).value = D.resume.map(r => r[0] + ' : ' + r[1]).join('   ·   '); ws.getCell(2, 1).font = {italic:true, size:10, color:{argb:'FF667085'}};
  const hr = ws.getRow(4);
  D.entetes.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF0F3D66'}}; c.font = {bold:true, color:{argb:'FFFFFFFF'}, size:10}; c.alignment = {horizontal:'center', vertical:'middle', wrapText:true}; });
  hr.height = 34;
  D.lignes.forEach((l, k) => {
    const row = ws.getRow(5 + k);
    l.forEach((v, i) => {
      const c = row.getCell(i + 1); c.value = v === '' ? null : v; c.border = {top:{style:'thin', color:{argb:'FFDDDDDD'}}, bottom:{style:'thin', color:{argb:'FFDDDDDD'}}, left:{style:'thin', color:{argb:'FFDDDDDD'}}, right:{style:'thin', color:{argb:'FFDDDDDD'}}};
      const dansMatrice = D.matrice && i >= D.matrice.debut && i <= D.matrice.fin;
      if(dansMatrice || i === D.colCode){ c.alignment = {horizontal:'center'}; const col = RR_COULEURS[v]; if(col && v) c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:col}}; if(v) c.font = {bold:true, size:10}; }
      else if(typeof v === 'number') c.alignment = {horizontal:'center'};
    });
  });
  if(D.matrice){
    D.jours.forEach((d, i) => { if(!getSlotsForDate(d).length){ for(let k = 0; k < D.lignes.length; k++) ws.getRow(5 + k).getCell(D.matrice.debut + i + 1).fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFEEEEEE'}}; } });
  }
  const finTab = 5 + D.lignes.length + 1;
  if(D.matrice || D.colCode != null){ ws.getCell(finTab, 1).value = 'Légende : ' + Object.entries(RR_CODES).filter(([k]) => k !== '?' || D.colCode != null).map(([k, v]) => k + ' = ' + v).join(' · '); ws.getCell(finTab, 1).font = {size:9, italic:true, color:{argb:'FF667085'}}; }
  ws.columns = D.entetes.map((h, i) => ({width: D.matrice ? (i === 0 ? 24 : i === 1 ? 16 : i <= D.matrice.fin ? 4.6 : 11) : (i === 1 ? 24 : i === 2 ? 18 : i === 10 && type === 'jour' ? 28 : 13)}));
  ws.views = [{state:'frozen', xSplit: D.matrice ? 2 : 2, ySplit:4}];
  ws.pageSetup = {orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0};
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})); a.download = 'TEK-TREND_' + D.fichier + '.xlsx'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  showToast('Rapport prêt');
};

// ---------- Écran « Rapports » ----------
let rrType = 'jour', rrRef = null;
const RR_TYPES = [['jour', 'Journalier'], ['semaine', 'Hebdomadaire'], ['mois', 'Mensuel par ouvrière'], ['paie', 'Pour la paie']];
function rrRefDefaut(type){ return (type === 'mois' || type === 'paie') ? getTodayISO().slice(0, 7) : getTodayISO(); }
window.rrChoisir = (t) => { rrType = t; rrRef = rrRefDefaut(t); nav('rh-rapports'); };
window.rrRefChange = (v) => { rrRef = v; nav('rh-rapports'); };
function renderRHRapports(container){
  if(!rrRef || ((rrType === 'mois' || rrType === 'paie') !== (rrRef.length === 7))) rrRef = rrRefDefaut(rrType);
  const D = rrDonnees(rrType, rrRef);
  const mensuel = rrType === 'mois' || rrType === 'paie';
  const cellule = (v, i) => {
    const code = (D.colCode === i || (D.matrice && i >= D.matrice.debut && i <= D.matrice.fin)) && v ? v : null;
    return `<td${code ? ` class="rr-c rr-k-${String(code).replace('?', 'q')}"` : ''}>${v === null || v === undefined ? '' : esc(String(v))}</td>`;
  };
  container.innerHTML = `
    <div class="card" style="padding:12px;">
      <div class="rr-types">${RR_TYPES.map(([k, l]) => `<button class="btn ${rrType === k ? 'btn-primary' : 'btn-ghost'}" onclick="rrChoisir('${k}')">${l}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;">
        <input type="${mensuel ? 'month' : 'date'}" value="${rrRef}" ${mensuel ? '' : `max="${getTodayISO()}"`} onchange="rrRefChange(this.value)" style="padding:9px 11px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);">
        <span style="font-size:12px;color:var(--ink-soft);flex:1;min-width:140px;">${esc(D.titre)}</span>
        <button class="btn btn-primary" onclick="rrExcel('${rrType}','${rrRef}')">Télécharger en Excel</button>
      </div>
      <div style="font-size:11.5px;color:var(--ink-soft);margin-top:8px;">${D.resume.map(r => esc(r[0]) + ' : <b>' + esc(String(r[1])) + '</b>').join(' · ')}</div>
    </div>
    <div class="card" style="padding:8px;"><div class="rr-scroll"><table class="rr-t"><thead><tr>${D.entetes.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${D.lignes.length ? D.lignes.map(l => `<tr>${l.map(cellule).join('')}</tr>`).join('') : `<tr><td colspan="${D.entetes.length}" style="padding:20px;text-align:center;color:var(--ink-soft);">Aucun employé actif</td></tr>`}</tbody></table></div>
      ${(D.matrice || D.colCode != null) ? `<div style="font-size:10.5px;color:var(--ink-soft);padding:8px 4px 2px;">${Object.entries(RR_CODES).map(([k, v]) => `<b>${k}</b> ${v}`).join(' · ')}</div>` : ''}</div>`;
}
const rrNavOrigine = window.nav;
window.nav = function(tab){
  const r = rrNavOrigine.apply(this, arguments);
  if(tab === 'rh-rapports'){ try { const m = document.getElementById('main'); if(m) renderRHRapports(rhSectionContainer(m, 'Rapports')); } catch(e) { console.error('Rapports RH', e); } }
  return r;
};

const rrCss = document.createElement('style');
rrCss.textContent = `
.rr-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:2px;}
.rr-chip{border:1.5px solid var(--border);background:var(--surface);color:var(--ink);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
.rr-chip.on.rr-present{background:#10b981;border-color:#10b981;color:#fff;} .rr-chip.on.rr-retard{background:#f59e0b;border-color:#f59e0b;color:#fff;} .rr-chip.on.rr-sortie{background:#eab308;border-color:#eab308;color:#fff;}
.rr-chip.on.rr-absent{background:#ef4444;border-color:#ef4444;color:#fff;}
.rr-types{display:flex;gap:6px;flex-wrap:wrap;} .rr-types .btn{padding:8px 12px;font-size:12.5px;}
.rr-scroll{overflow:auto;max-height:68vh;} .rr-t{border-collapse:collapse;font-size:12px;width:100%;} .rr-t th{position:sticky;top:0;background:#0F3D66;color:#fff;padding:6px 7px;font-size:11px;white-space:nowrap;z-index:1;}
.rr-t td{border:1px solid var(--border);padding:5px 7px;white-space:nowrap;} .rr-c{text-align:center;font-weight:800;}
.rr-k-P{background:#d1f5e0;color:#0a5c36;} .rr-k-R{background:#ffe3b3;color:#8a5200;} .rr-k-S{background:#fff2b3;color:#7a6200;} .rr-k-A,.rr-k-ANJ{background:#fad0cf;color:#9b1c1c;}
.rr-k-C{background:#d6e4ff;color:#1e429f;} .rr-k-M{background:#e9d5ff;color:#6b21a8;} .rr-k-AA{background:#ffe3b3;color:#8a5200;} .rr-k-X{background:#eee;color:#444;}
:root[data-theme="dark"] .rr-k-P,:root[data-theme="dark"] .rr-k-R,:root[data-theme="dark"] .rr-k-S,:root[data-theme="dark"] .rr-k-A,:root[data-theme="dark"] .rr-k-ANJ,:root[data-theme="dark"] .rr-k-C,:root[data-theme="dark"] .rr-k-M,:root[data-theme="dark"] .rr-k-AA,:root[data-theme="dark"] .rr-k-X{filter:brightness(.85);}
`;
document.head.appendChild(rrCss);
