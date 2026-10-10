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
function rrPeriodeTxt(d, f){ return d === f ? rrFr(d) : 'du ' + rrFr(d) + ' au ' + rrFr(f); }
// type : 'jour' (détail jour par jour), 'calendrier' (une ligne par ouvrière, une colonne par jour), 'paie' (totaux), 'emp' (un employé, jour par jour)
function rrDonnees(type, debut, fin, empId){
  if(fin < debut){ const t = debut; debut = fin; fin = t; }
  const tous = activeEmployees(), emps = (type === 'emp' && empId) ? tous.filter(([id]) => id === empId) : tous;
  const jours = rrJoursDe(debut, fin), per = rrPeriodeTxt(debut, fin), nom = (e) => e.nom || '';
  const suffixe = debut === fin ? debut : debut + '_au_' + fin;
  if(type === 'jour' || type === 'emp'){
    const lignes = [], ids = [], dates = [];
    jours.forEach(d => emps.forEach(([id, e]) => {
      const j = rrJour(id, d); if(j.code === '—' && jours.length > 1) return;
      lignes.push([rrFr(d), nom(e), e.poste || '', j.code, RR_CODES[j.code], j.arrivee, j.depart, rrNum(j.retardH), rrNum(j.autH), rrNum(j.travaillees), j.motif]); ids.push(id); dates.push(d);
    }));
    const cnt = (c) => lignes.filter(l => l[3] === c).length;
    return {ids, dates, titre:(type === 'emp' && emps[0] ? 'Synthèse de ' + nom(emps[0][1]) : 'Rapport journalier') + ' — ' + per, fichier:(type === 'emp' ? 'RH_synthese_employe_' : 'RH_journalier_') + suffixe,
      entetes:['Date', 'Nom', 'Poste', 'Code', 'État', 'Arrivée', 'Départ', 'Retard (h)', 'Sorties (h)', 'Heures travaillées', 'Observation'], lignes, colCode:3,
      resume:[['Lignes', lignes.length], ['Présences', cnt('P') + cnt('R') + cnt('S')], ['Retards', cnt('R')], ['Sorties', cnt('S')], ['Absences', cnt('A') + cnt('ANJ') + cnt('AA') + cnt('X')], ['Congés', cnt('C')], ['Maladies', cnt('M')], ['Non renseignés', cnt('?')]]};
  }
  if(type === 'calendrier'){
    const matrice = jours.length <= 93, jl = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
    const entetes = ['Nom', 'Poste'].concat(matrice ? jours.map(d => (jours.length <= 8 ? jl[new Date(d + 'T00:00:00').getDay()] + ' ' : '') + (jours.length <= 31 ? d.slice(8) : d.slice(8) + '/' + d.slice(5, 7))) : []).concat(['Présences', 'Retards (j)', 'Retard (h)', 'Sorties (h)', 'Absences', 'Congés', 'Maladies', 'Heures prévues', 'Heures travaillées']);
    const lignes = emps.map(([id, e]) => {
      const js = jours.map(d => rrJour(id, d)), n = (...cs) => js.filter(j => cs.indexOf(j.code) >= 0).length, t = (k) => js.reduce((x, j) => x + j[k], 0);
      return [nom(e), e.poste || ''].concat(matrice ? js.map(j => (j.code === '—' || j.code === '?') ? '' : j.code) : []).concat([n('P', 'R', 'S'), n('R'), rrNum(t('retardH')), rrNum(t('autH')), n('A', 'ANJ', 'AA', 'X'), n('C'), n('M'), rrNum(t('prevues')), rrNum(t('travaillees'))]);
    });
    return {ids:emps.map(([id]) => id), titre:'Rapport par ouvrière — ' + per, fichier:'RH_par_ouvriere_' + suffixe, entetes, lignes, jours, matrice: matrice ? {debut:2, fin:2 + jours.length - 1} : null, resume:[['Effectif', emps.length], ['Jours', jours.length]]};
  }
  if(type === 'paie'){
    const prevues = jours.reduce((x, d) => x + getPlannedHoursForDate(d), 0), mois = debut.slice(0, 7), moisComplet = debut === mois + '-01' && fin === mois + '-' + String(daysInMonth(mois)).padStart(2, '0'), base = moisComplet ? getMonthlyBase(mois) : null;
    const lignes = emps.map(([id, e]) => {
      const st = computeStatsForRange(id, debut, fin), c = st.counts, ecart = base != null ? st.heuresTravaillees - base : null;
      return [e.matricule || '', nom(e), e.poste || '', c.present || 0, c.conge || 0, c.maladie || 0, c.autorisee || 0, (c.absent || 0) + (c.injustifiee || 0), rrNum(st.retardH), rrNum(st.autorisationH), rrNum(prevues), rrNum(st.heuresTravaillees), base != null ? rrNum(base) : '', ecart != null ? rrNum(Math.max(0, ecart)) : ''];
    });
    return {ids:emps.map(([id]) => id), titre:'Rapport pour la paie — ' + per, fichier:'RH_paie_' + suffixe, entetes:['Matricule', 'Nom', 'Poste', 'Jours présents', 'Congés', 'Maladies', 'Abs. autorisées', 'Abs. non justifiées', 'Retards (h)', 'Sorties (h)', 'Heures prévues', 'Heures travaillées', 'Base mensuelle', 'Heures supp.'], lignes,
      resume:[['Effectif', emps.length], ['Période', per], ['Base mensuelle', base != null ? base + ' h' : (moisComplet ? 'non définie' : 'sans objet (période libre)')]]};
  }
  return null;
}

// ---------- Excel ----------
window.rrExcel = async function(type, debut, fin, empId){
  try { await chargerBib('exceljs'); } catch(e) {}
  if(typeof ExcelJS === 'undefined'){ showToast('Bibliothèque Excel indisponible — vérifiez la connexion internet.'); return; }
  const D = rrDonnees(type, debut, fin, empId); if(!D) return;
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

// ---------- Correction d'un jour (passé ou présent) ----------
window.rrCorriger = function(empId, date){
  if(date > getTodayISO()){ showToast('Impossible de corriger un jour à venir'); return; }
  const e = getEmployees()[empId]; if(!e) return;
  const r = resolveDayStatus(empId, date), st = r.source === 'pointage' ? r.status : '';
  let corps = `<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:10px;">${esc(e.nom)} — <b>${rrFr(date)}</b></div>`;
  if(r.source === 'periode'){
    corps += `<div class="msg" style="margin-bottom:10px;font-size:12.5px;">${ABSENCE_TYPES[r.type].label} du ${rrFr(r.dateStart)} au ${rrFr(r.dateEnd)}${r.motif ? ' · ' + esc(r.motif) : ''}</div>
      <button class="btn btn-primary" style="width:100%;" onclick="rhCloseModal();showEditAbsenceForm('${r.periodId}')">Modifier ou supprimer cette absence</button>`;
  } else {
    const actif = {present: st === 'present' && !computeRetardHours(r) && !(r.autorisations || []).length, retard: st === 'present' && computeRetardHours(r) > 0, sortie: st === 'present' && (r.autorisations || []).length > 0, absent: st === 'absent'};
    corps += `<div class="rr-chips">${RR_ETATS.map(([k, l]) => `<button class="rr-chip rr-${k}${actif[k] ? ' on' : ''}" onclick="rrCorrigerEtat('${empId}','${date}','${k}')">${l}</button>`).join('')}</div>`;
    if(st === 'present') corps += `<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
      <div class="field" style="margin:0;"><label style="font-size:10px;">Heure d'arrivée</label><input type="time" value="${r.in || ''}" onchange="rrCorrigerChamp('${empId}','${date}','in',this.value)"></div>
      <div class="field" style="margin:0;"><label style="font-size:10px;">Heure de départ</label><input type="time" value="${r.out || ''}" onchange="rrCorrigerChamp('${empId}','${date}','out',this.value)"></div></div>
      ${(r.autorisations || []).map((au, i) => `<div style="display:flex;gap:8px;margin-top:8px;align-items:flex-end;flex-wrap:wrap;"><div class="field" style="margin:0;"><label style="font-size:10px;">Sortie</label><input type="time" value="${au.sortie || ''}" onchange="rrCorrigerAut('${empId}','${date}',${i},'sortie',this.value)"></div><div class="field" style="margin:0;"><label style="font-size:10px;">Retour</label><input type="time" value="${au.retour || ''}" onchange="rrCorrigerAut('${empId}','${date}',${i},'retour',this.value)"></div><button class="icon-btn" onclick="rrCorrigerAut('${empId}','${date}',${i},null)" title="Retirer">✕</button></div>`).join('')}`;
    if(st) corps += `<button class="btn btn-ghost" style="width:100%;margin-top:14px;" onclick="rrCorrigerEtat('${empId}','${date}','vide')">Effacer la saisie de ce jour</button>`;
  }
  rhModal('Corriger la journée', corps);
};
function rrApres(){ nav(activeTabIsRH()); }
window.rrCorrigerEtat = function(empId, date, etat){
  if(etat === 'conge' || etat === 'maladie'){
    rhCloseModal(); showAbsenceForm(empId);
    setTimeout(() => { const t = document.getElementById('ab-type'); if(t) t.value = etat; const a = document.getElementById('ab-start'), b = document.getElementById('ab-end'); if(a) a.value = date; if(b) b.value = date; }, 0); return;
  }
  const a = getAttendance(date), cur = a[empId] || {};
  if(etat === 'vide') delete a[empId];
  else if(etat === 'present') a[empId] = {status:'present', src:'manuel'};
  else if(etat === 'absent') a[empId] = {status:'absent', src:'manuel'};
  else if(etat === 'retard'){ const t = rrLireHeure("Heure d'arrivée (exemple 08:15)"); if(!t) return; a[empId] = {...cur, status:'present', in:t, src:'manuel'}; }
  else if(etat === 'sortie'){ const t = rrLireHeure('Heure de sortie (exemple 10:30)'); if(!t) return; a[empId] = {...cur, status:'present', src:'manuel', autorisations:[...(cur.autorisations || []), {sortie:t, retour:'', prevue:''}]}; }
  saveAttendance(date, a); rhCloseModal(); showToast('Journée corrigée'); rrApres();
};
window.rrCorrigerChamp = function(empId, date, champ, v){ const a = getAttendance(date); a[empId] = {...(a[empId] || {status:'present'}), [champ]:v, src:'manuel'}; saveAttendance(date, a); rrApres(); setTimeout(() => rrCorriger(empId, date), 50); };
window.rrCorrigerAut = function(empId, date, i, champ, v){
  const a = getAttendance(date), cur = a[empId] || {status:'present'}, l = [...(cur.autorisations || [])];
  if(champ === null) l.splice(i, 1); else l[i] = {...l[i], [champ]:v};
  a[empId] = {...cur, autorisations:l, src:'manuel'}; saveAttendance(date, a); rrApres(); setTimeout(() => rrCorriger(empId, date), 50);
};

// ---------- PDF (impression : « Enregistrer au format PDF ») ----------
window.rrPdf = function(type, debut, fin, empId){
  const D = rrDonnees(type, debut, fin, empId); if(!D) return;
  const mat = D.matrice, tr = D.lignes.map(l => '<tr>' + l.map((v, i) => {
    const code = (D.colCode === i || (mat && i >= mat.debut && i <= mat.fin)) && v ? String(v) : '';
    return '<td' + (code ? ' class="c k-' + code.replace('?', 'q') + '"' : (typeof v === 'number' ? ' class="n"' : '')) + '>' + (v === null || v === undefined ? '' : esc(String(v))) + '</td>';
  }).join('') + '</tr>').join('');
  const dense = D.entetes.length > 18;
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc('TEK-TREND_' + D.fichier) + '</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:' + (dense ? 8 : 10) + 'px Arial,sans-serif;color:#111;margin:0}h1{font-size:15px;color:#0F3D66;margin:0 0 4px}.s{color:#555;margin:0 0 8px;font-size:10px}table{border-collapse:collapse;width:100%}th{background:#0F3D66;color:#fff;padding:3px 4px;font-size:' + (dense ? 7 : 9) + 'px;-webkit-print-color-adjust:exact;print-color-adjust:exact}td{border:1px solid #bbb;padding:2px 4px;white-space:nowrap}td.c{text-align:center;font-weight:700}td.n{text-align:center}thead{display:table-header-group}tr{page-break-inside:avoid}'
    + '.k-P{background:#d1f5e0}.k-R{background:#ffe3b3}.k-S{background:#fff2b3}.k-A,.k-ANJ{background:#fad0cf}.k-C{background:#d6e4ff}.k-M{background:#e9d5ff}.k-AA{background:#ffe3b3}.k-X{background:#eee}td.c{-webkit-print-color-adjust:exact;print-color-adjust:exact}.l{margin-top:8px;font-size:8px;color:#555}</style></head><body>'
    + '<h1>TEK-TREND — ' + esc(D.titre) + '</h1><p class="s">' + D.resume.map(r => esc(r[0]) + ' : <b>' + esc(String(r[1])) + '</b>').join(' · ') + ' · Édité le ' + new Date().toLocaleDateString('fr-FR') + '</p>'
    + '<table><thead><tr>' + D.entetes.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + tr + '</tbody></table>'
    + ((mat || D.colCode != null) ? '<div class="l">' + Object.entries(RR_CODES).map(([k, v]) => '<b>' + k + '</b> ' + v).join(' · ') + '</div>' : '')
    + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour exporter en PDF.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  showToast('Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF ».');
};

// ---------- Écran « Rapports » ----------
let rrType = 'jour', rrDeb = null, rrFin = null;
const RR_TYPES = [['jour', 'Jour par jour'], ['calendrier', 'Par ouvrière'], ['paie', 'Pour la paie']];
function rrPeriodePreset(k){
  const t = getTodayISO(), d = new Date(t + 'T00:00:00');
  if(k === 'auj') return [t, t];
  if(k === 'sem'){ const l = rrLundi(t), f = new Date(l + 'T00:00:00'); f.setDate(f.getDate() + 6); return [l, toISODateLocal(f)]; }
  if(k === 'mois') return [t.slice(0, 7) + '-01', t.slice(0, 7) + '-' + String(daysInMonth(t.slice(0, 7))).padStart(2, '0')];
  if(k === 'mois-1'){ d.setDate(1); d.setMonth(d.getMonth() - 1); const m = toISODateLocal(d).slice(0, 7); return [m + '-01', m + '-' + String(daysInMonth(m)).padStart(2, '0')]; }
  return [t, t];
}
window.rrChoisir = (t) => { rrType = t; nav('rh-rapports'); };
window.rrPreset = (k) => { [rrDeb, rrFin] = rrPeriodePreset(k); nav('rh-rapports'); };
window.rrDates = (d, f) => { if(d) rrDeb = d; if(f) rrFin = f; nav('rh-rapports'); };
function renderRHRapports(container){
  if(!rrDeb || !rrFin) [rrDeb, rrFin] = rrPeriodePreset('mois');
  if(rrFin < rrDeb) rrFin = rrDeb;
  const D = rrDonnees(rrType, rrDeb, rrFin);
  const cellule = (v, i, k) => {
    const dansM = D.matrice && i >= D.matrice.debut && i <= D.matrice.fin, ligneJ = !!D.dates;
    const code = (D.colCode === i || dansM) && v ? v : null;
    const clic = dansM ? ` onclick="rrCorriger('${D.ids[k]}','${D.jours[i - D.matrice.debut]}')" style="cursor:pointer;"` : '';
    return `<td class="${code ? 'rr-c rr-k-' + String(code).replace('?', 'q') : ''}${dansM ? ' rr-cl' : ''}"${clic}>${v === null || v === undefined ? '' : esc(String(v))}</td>`;
  };
  const aide = (D.dates || D.matrice) ? `<div style="font-size:11.5px;color:var(--ink-soft);margin-top:8px;">👆 Touchez ${D.dates ? 'une ligne' : 'une case'} pour corriger l'état d'un jour, même passé.</div>` : '';
  const args = `'${rrType}','${rrDeb}','${rrFin}'`;
  container.innerHTML = `
    <div class="card" style="padding:12px;">
      <div class="rr-types">${RR_TYPES.map(([k, l]) => `<button class="btn ${rrType === k ? 'btn-primary' : 'btn-ghost'}" onclick="rrChoisir('${k}')">${l}</button>`).join('')}</div>
      <div class="rr-types" style="margin-top:8px;">${[['auj', "Aujourd'hui"], ['sem', 'Cette semaine'], ['mois', 'Ce mois'], ['mois-1', 'Mois dernier']].map(([k, l]) => `<button class="btn btn-ghost" onclick="rrPreset('${k}')">${l}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:10px;">
        <div class="field" style="margin:0;"><label style="font-size:10px;">Du</label><input type="date" value="${rrDeb}" max="${getTodayISO()}" onchange="rrDates(this.value,null)"></div>
        <div class="field" style="margin:0;"><label style="font-size:10px;">Au</label><input type="date" value="${rrFin}" max="${getTodayISO()}" onchange="rrDates(null,this.value)"></div>
        <button class="btn btn-primary" onclick="rrExcel(${args})">Excel</button>
        <button class="btn btn-primary" onclick="rrPdf(${args})">PDF</button>
      </div>
      <div style="font-size:12px;color:var(--ink-soft);margin-top:8px;">${esc(D.titre)}</div>
      <div style="font-size:11.5px;color:var(--ink-soft);margin-top:4px;">${D.resume.map(r => esc(r[0]) + ' : <b>' + esc(String(r[1])) + '</b>').join(' · ')}</div>${aide}
    </div>
    <div id="rh-modal-zone"></div>
    <div class="card" style="padding:8px;"><div class="rr-scroll"><table class="rr-t"><thead><tr>${D.entetes.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${D.lignes.length ? D.lignes.map((l, k) => `<tr${D.dates ? ` class="rr-lg" onclick="rrCorriger('${D.ids[k]}','${D.dates[k]}')"` : ''}>${l.map((v, i) => cellule(v, i, k)).join('')}</tr>`).join('') : `<tr><td colspan="${D.entetes.length}" style="padding:20px;text-align:center;color:var(--ink-soft);">Aucune donnée</td></tr>`}</tbody></table></div>
      ${(D.matrice || D.colCode != null) ? `<div style="font-size:10.5px;color:var(--ink-soft);padding:8px 4px 2px;">${Object.entries(RR_CODES).map(([k, v]) => `<b>${k}</b> ${v}`).join(' · ')}</div>` : ''}</div>`;
}

// ---------- Synthèse : exports sur la période choisie ----------
const rrSyntheseOrigine = window.renderRHSynthese;
window.renderRHSynthese = function(container){
  rrSyntheseOrigine(container);
  try {
    const {start, end} = rhStatsRange(), t = rhStatsEmpId ? 'emp' : 'paie', a = `'${t}','${start}','${end}'${rhStatsEmpId ? `,'${rhStatsEmpId}'` : ''}`;
    const barre = document.createElement('div'); barre.className = 'card'; barre.style.padding = '10px 12px';
    barre.innerHTML = `<div style="font-size:11.5px;color:var(--ink-soft);margin-bottom:8px;">Exporter cette synthèse (${esc(rrPeriodeTxt(start, end))}${rhStatsEmpId ? ', employé choisi' : ', tous les employés'})</div><div style="display:flex;gap:8px;"><button class="btn btn-primary" style="flex:1;" onclick="rrExcel(${a})">Excel</button><button class="btn btn-primary" style="flex:1;" onclick="rrPdf(${a})">PDF</button></div>`;
    const premier = container.querySelector('.card'); if(premier && premier.nextSibling) container.insertBefore(barre, premier.nextSibling); else container.appendChild(barre);
  } catch(e) { console.error('Synthèse RH', e); }
};

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
.rr-t td{border:1px solid var(--border);padding:5px 7px;white-space:nowrap;} .rr-c{text-align:center;font-weight:800;} .rr-cl:hover{outline:2px solid #0F3D66;outline-offset:-2px;} .rr-lg{cursor:pointer;} .rr-lg:hover td{background:rgba(15,61,102,.07);}
.rr-k-P{background:#d1f5e0;color:#0a5c36;} .rr-k-R{background:#ffe3b3;color:#8a5200;} .rr-k-S{background:#fff2b3;color:#7a6200;} .rr-k-A,.rr-k-ANJ{background:#fad0cf;color:#9b1c1c;}
.rr-k-C{background:#d6e4ff;color:#1e429f;} .rr-k-M{background:#e9d5ff;color:#6b21a8;} .rr-k-AA{background:#ffe3b3;color:#8a5200;} .rr-k-X{background:#eee;color:#444;}
:root[data-theme="dark"] .rr-k-P,:root[data-theme="dark"] .rr-k-R,:root[data-theme="dark"] .rr-k-S,:root[data-theme="dark"] .rr-k-A,:root[data-theme="dark"] .rr-k-ANJ,:root[data-theme="dark"] .rr-k-C,:root[data-theme="dark"] .rr-k-M,:root[data-theme="dark"] .rr-k-AA,:root[data-theme="dark"] .rr-k-X{filter:brightness(.85);}
`;
document.head.appendChild(rrCss);
