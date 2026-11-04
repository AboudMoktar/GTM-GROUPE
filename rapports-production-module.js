// ============================================================
// FICHES EXCEL ET PDF — STATISTIQUES ET HISTORIQUE (TEK-TREND et GADH)
// ============================================================
// Une même fiche, en Excel (.xlsx) ou en PDF (2 pages maximum) :
//  - TEK-TREND : statistiques / historique sur une période (production, rendement, opératrices)
//                et fiche d'un jour (production heure par heure, par opératrice) ;
//  - GADH      : statistiques / historique sur une période (pièces retournées par jour et par
//                référence) et fiche d'un jour (pièces par référence + personnel du jour).
// Lecture seule : aucune donnée n'est modifiée ici.

function rpFr(iso){ return iso ? iso.split('-').reverse().join('/') : ''; }
function rpN(n){ return (Number(n) || 0).toLocaleString('fr-FR'); }
function rpPct(n){ return n === null || n === undefined || isNaN(n) ? '—' : Math.round(n) + ' %'; }
function rpJours(debut, fin, max){
  const out = [], d = new Date(debut + 'T00:00:00'), f = new Date(fin + 'T00:00:00');
  if(isNaN(d) || isNaN(f)) return out;
  while(d <= f && out.length < (max || 370)){ out.push(toISODateLocal(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function rpPeriodeTxt(d, f){ return d === f ? 'le ' + rpFr(d) : 'du ' + rpFr(d) + ' au ' + rpFr(f); }
function rpNomFichier(soc, quoi, d, f){ return (soc === 'gadh' ? 'GADH' : 'TEK-TREND') + '_' + quoi + '_' + (d === f ? d : d + '_au_' + f); }
// Regroupe des lignes jour par jour en semaines (au-delà de 31 jours, pour tenir sur 2 pages).
function rpParSemaine(jours, champs){
  const sem = {}, ordre = [];
  jours.forEach(j => {
    const d = new Date(j.iso + 'T00:00:00'), lun = new Date(d); lun.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = toISODateLocal(lun);
    if(!sem[k]){ sem[k] = {iso:k, fin:j.iso, nb:0}; champs.forEach(c => { sem[k][c] = 0; }); ordre.push(k); }
    const s = sem[k]; s.fin = j.iso; s.nb++; champs.forEach(c => { s[c] += Number(j[c]) || 0; });
  });
  return ordre.map(k => sem[k]);
}

// ---------- Données TEK-TREND ----------
function rpTekPeriode(debut, fin){
  const jours = rpJours(debut, fin, 370).map(iso => {
    const d = getDay(iso), t = computeTotals(d), obj = getObjForDay(d), ops = getOpsForDate(iso);
    return {iso, total:t.totalGeneral || 0, obj:obj || 0, arrets:t.arrets || 0, rend:obj > 0 ? t.totalGeneral / obj * 100 : null, perOp:OP_KEYS.map(k => t[k] || 0), ops};
  });
  const travailles = jours.filter(j => j.obj > 0), actifs = travailles.filter(j => j.total > 0);
  const parNom = {};
  actifs.forEach(j => j.ops.forEach((nom, i) => { if(nom === '(poste vacant)') return; const o = parNom[nom] || (parNom[nom] = {nom, total:0, jours:0}); o.total += j.perOp[i]; if(j.perOp[i] > 0) o.jours++; }));
  const total = actifs.reduce((s, j) => s + j.total, 0), obj = actifs.reduce((s, j) => s + j.obj, 0);
  const meilleur = actifs.length ? actifs.reduce((a, b) => b.rend > a.rend ? b : a) : null, faible = actifs.length ? actifs.reduce((a, b) => b.rend < a.rend ? b : a) : null;
  return {debut, fin, jours:actifs, total, obj, arrets:actifs.reduce((s, j) => s + j.arrets, 0),
    rend:actifs.length ? actifs.reduce((s, j) => s + j.rend, 0) / actifs.length : null, nbTravailles:travailles.length, meilleur, faible,
    classement:Object.values(parNom).sort((a, b) => b.total - a.total)};
}
function rpTekJour(iso){
  const d = getDay(iso), t = computeTotals(d), obj = getObjForDay(d), ops = getOpsForDate(iso), heures = getHoursForDate(iso);
  let cumul = 0;
  const lignes = heures.map(h => { const x = d.hours[h] || {}, v = OP_KEYS.map(k => parseInt(x[k]) || 0), s = v.reduce((a, b) => a + b, 0); cumul += s; return {h, v, s, cumul, obs:x.obs || ''}; });
  return {iso, ops, lignes, total:t.totalGeneral || 0, perOp:OP_KEYS.map(k => t[k] || 0), obj:obj || 0, arrets:t.arrets || 0, rend:obj > 0 ? (t.totalGeneral || 0) / obj * 100 : null};
}

// ---------- Données GADH ----------
function rpGadhPeriode(debut, fin){
  const parRef = {}, jours = [];
  rpJours(debut, fin, 370).forEach(iso => {
    const r = cmdRetourGadhParRefDuJour(iso), t = Object.values(r).reduce((a, q) => a + (q || 0), 0);
    if(t > 0) jours.push({iso, total:t, refs:r});
    Object.entries(r).forEach(([rk, q]) => { parRef[rk] = (parRef[rk] || 0) + (q || 0); });
  });
  const total = jours.reduce((s, j) => s + j.total, 0), meilleur = jours.length ? jours.reduce((a, b) => b.total > a.total ? b : a) : null;
  return {debut, fin, jours, total, parRef:gadhRefsTriees(parRef), meilleur, moyenne:jours.length ? total / jours.length : null};
}
function rpGadhPersonnel(iso){
  const out = {total:0, present:0, absents:[], retards:[]};
  try {
    activeGadhEmployees().forEach(([id, e]) => {
      out.total++;
      const r = resolveGadhDayStatus(id, iso), nom = ((e.nom || '') + ' ' + (e.prenom || '')).trim();
      if(r.source === 'periode'){ const t = GADH_ABSENCE_TYPES[r.type]; out.absents.push(nom + ' (' + (t ? t.label : r.type) + ')'); }
      else if(r.source === 'pointage'){
        if(r.statut === 'absent') out.absents.push(nom + ' (absent)');
        else { out.present++; if(r.statut === 'retard') out.retards.push(nom); }
      }
    });
  } catch(e) {}
  return out;
}

// ---------- PDF (fenêtre d'impression, 2 pages maximum) ----------
function rpPdf(soc, titre, sousTitre, corps, nomFichier, paysage){
  const S = SOCIETES[soc] || {nom:soc};
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(nomFichier)}</title><style>
    @page{size:A4 ${paysage ? 'landscape' : 'portrait'};margin:11mm 12mm;}
    *{box-sizing:border-box;} body{font:10.5px Arial,Helvetica,sans-serif;color:#111;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .ent{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:2px solid ${S.couleur || '#0B3C49'};padding-bottom:6px;margin-bottom:10px;}
    .ent h1{font-size:16px;margin:0;} .ent .s{font-size:10.5px;color:#444;margin-top:2px;} .ent .d{font-size:9.5px;color:#666;text-align:right;}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:6px;margin:0 0 10px;}
    .kpi{border:1px solid #cfd6de;border-radius:6px;padding:6px 8px;background:#f6f8fa;} .kpi b{display:block;font-size:15px;margin-top:2px;} .kpi span{font-size:9px;color:#555;}
    h2{font-size:12px;margin:10px 0 5px;color:${S.couleur || '#0B3C49'};} table{width:100%;border-collapse:collapse;margin-bottom:6px;}
    th{background:${S.couleur || '#0B3C49'};color:#fff;font-size:9.5px;padding:4px 5px;text-align:center;} td{border-bottom:1px solid #dde3e9;padding:3px 5px;font-size:9.8px;}
    td.n,th.n{text-align:right;white-space:nowrap;} td.c{text-align:center;} tr:nth-child(even) td{background:#f7f9fb;} tr.tot td{font-weight:bold;background:#e4eaf0 !important;border-top:1.5px solid #333;}
    .bon{color:#0a7a3a;font-weight:bold;} .mauvais{color:#b42318;font-weight:bold;} .note{font-size:9px;color:#666;margin-top:4px;}
    .deux{display:grid;grid-template-columns:1fr 1fr;gap:12px;} .saut{break-before:page;} table,tr{break-inside:avoid;}
    table.large{break-inside:auto;} table.large td{padding:3px 6px;} tr.sem td{font-weight:bold;background:#eef2f6 !important;border-bottom:1.5px solid #9aa6b2;}
    /* à l'écran (avant ou après l'impression) : la page A4 au centre, agrandie, et non étirée sur toute la largeur */
    @media screen{html{background:#d9dee5;} body{width:${paysage ? '273mm' : '186mm'};margin:18px auto;padding:10mm 12mm;background:#fff;box-shadow:0 4px 22px rgba(0,0,0,.18);}}
    @media screen and (min-width:1150px){body{zoom:1.3;}}
  </style></head><body>
    <div class="ent"><div style="display:flex;align-items:center;gap:12px;">${typeof logoDocHTML === 'function' ? logoDocHTML(soc, 13, 'margin:0;') : ''}<div><h1>${esc(titre)}</h1><div class="s">${esc(sousTitre)}</div></div></div>
      <div class="d">${esc(S.nom)}<br>Édité le ${rpFr(getTodayISO())}${currentUser ? '<br>par ' + esc(currentUser.nom || currentUser.username) : ''}</div></div>
    ${corps}
    <script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour créer le PDF'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  showToast('Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF »');
}
const rpKpi = (lib, val, cls) => `<div class="kpi"><span>${lib}</span><b class="${cls || ''}">${val}</b></div>`;
const rpClsRend = (r) => r === null ? '' : r >= 90 ? 'bon' : r < 70 ? 'mauvais' : '';

// ---------- Excel (.xlsx) ----------
async function rpExcel(nomFichier, feuilles){
  try { await chargerBib('xlsx'); } catch(e) { showToast('Excel indisponible : vérifiez la connexion internet'); return; }
  const wb = XLSX.utils.book_new();
  feuilles.forEach(f => {
    const ws = XLSX.utils.aoa_to_sheet(f.lignes);
    ws['!cols'] = (f.larg || []).map(w => ({wch:w}));
    if(f.fusions) ws['!merges'] = f.fusions.map(([r1, c1, r2, c2]) => ({s:{r:r1, c:c1}, e:{r:r2, c:c2}}));
    XLSX.utils.book_append_sheet(wb, ws, f.nom.slice(0, 31));
  });
  const data = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const url = URL.createObjectURL(new Blob([data], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a = document.createElement('a'); a.href = url; a.download = nomFichier + '.xlsx'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  showToast('Fichier Excel créé');
}
function rpEnteteExcel(soc, titre, sousTitre){ return [[(SOCIETES[soc] || {}).nom + ' — ' + titre], [sousTitre + ' · édité le ' + rpFr(getTodayISO())], []]; }

// ============================================================
// TEK-TREND — période (statistiques, historique période)
// ============================================================
// Fiche PDF des statistiques : un seul tableau sur toute la largeur. Les lignes des jours se suivent ;
// sous chaque semaine, une ligne de sous-total ; puis le total de la période et le classement.
window.rpTekPeriodePdf = function(debut, fin){
  const D = rpTekPeriode(debut, fin), JS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  // Colonnes des postes : noms des opératrices si l'équipe n'a pas changé sur la période, sinon « Poste n ».
  const cle = (j) => j.ops.join('|'), memes = D.jours.length && D.jours.every(j => cle(j) === cle(D.jours[0]));
  const postes = (D.jours[0] ? D.jours[0].ops : getOpsForDate(fin)).map((n, i) => memes ? n : 'Poste ' + (i + 1));
  const somme = (js, f) => js.reduce((a, j) => a + (Number(f(j)) || 0), 0);
  const ligneTot = (cls, lib, js) => { const t = somme(js, j => j.total), o = somme(js, j => j.obj);
    return `<tr class="${cls}"><td>${lib}</td>${postes.map((_, i) => `<td class="n">${rpN(somme(js, j => j.perOp[i]))}</td>`).join('')}<td class="n">${rpN(t)}</td><td class="n">${rpN(o)}</td><td class="n">${rpPct(o ? t / o * 100 : null)}</td><td class="n">${somme(js, j => j.arrets) || ''}</td></tr>`; };
  const semaines = rpParSemaine(D.jours, []), plusieurs = semaines.length > 1;
  let lignes = '';
  semaines.forEach(sm => {
    const js = D.jours.filter(j => j.iso >= sm.iso && j.iso <= sm.fin);
    lignes += js.map(j => `<tr><td>${JS[new Date(j.iso + 'T12:00:00').getDay()]} ${rpFr(j.iso)}</td>${j.perOp.map(v => `<td class="n">${v || ''}</td>`).join('')}<td class="n"><b>${rpN(j.total)}</b></td><td class="n">${rpN(j.obj)}</td><td class="n ${rpClsRend(j.rend)}">${rpPct(j.rend)}</td><td class="n">${j.arrets || ''}</td></tr>`).join('');
    if(plusieurs) lignes += ligneTot('sem', 'Semaine du ' + rpFr(sm.iso) + ' (' + js.length + ' j)', js);
  });
  const corps = `<div class="kpis">${rpKpi('Production', rpN(D.total) + ' pcs')}${rpKpi('Objectif cumulé', rpN(D.obj))}${rpKpi('Rendement moyen', rpPct(D.rend), rpClsRend(D.rend))}${rpKpi('Jours avec production', D.jours.length + ' / ' + D.nbTravailles)}${rpKpi('Pertes / arrêts', rpN(D.arrets))}
      ${rpKpi('Meilleur jour', D.meilleur ? rpFr(D.meilleur.iso) + ' · ' + rpPct(D.meilleur.rend) : '—', 'bon')}${rpKpi('Jour le plus faible', D.faible ? rpFr(D.faible.iso) + ' · ' + rpPct(D.faible.rend) : '—', 'mauvais')}</div>
    <h2>Production jour par jour${plusieurs ? ', avec le total de chaque semaine' : ''}</h2>
    <table class="large"><thead><tr><th style="text-align:left;">Date</th>${postes.map(n => `<th class="n">${esc(n)}</th>`).join('')}<th class="n">Total</th><th class="n">Objectif</th><th class="n">Rendement</th><th class="n">Arrêts</th></tr></thead><tbody>
      ${lignes || `<tr><td colspan="${postes.length + 5}">Aucune production sur cette période</td></tr>`}
      ${D.jours.length ? ligneTot('tot', 'Total de la période', D.jours) : ''}</tbody></table>
    <h2>Classement des opératrices</h2>
    <table class="large"><thead><tr><th>#</th><th style="text-align:left;">Opératrice</th><th class="n">Pièces</th><th class="n">Part</th><th class="n">Jours</th><th class="n">Moyenne par jour</th></tr></thead><tbody>
      ${D.classement.map((o, i) => `<tr><td class="c">${i + 1}${i === 0 ? ' 🏆' : ''}</td><td>${esc(o.nom)}</td><td class="n">${rpN(o.total)}</td><td class="n">${D.total ? Math.round(o.total / D.total * 100) + ' %' : ''}</td><td class="n">${o.jours}</td><td class="n">${o.jours ? rpN(Math.round(o.total / o.jours)) : ''}</td></tr>`).join('') || '<tr><td colspan="6">Aucune donnée</td></tr>'}
      </tbody></table>
    <p class="note">Le rendement moyen est la moyenne des rendements des jours avec production. Chaque jour, la production est attribuée à l'opératrice qui occupait réellement le poste.${memes ? '' : ' L\'équipe a changé pendant la période : les colonnes indiquent les postes.'}</p>`;
  rpPdf('tek', 'Statistiques de production', 'Période ' + rpPeriodeTxt(debut, fin), corps, rpNomFichier('tek', 'Statistiques', debut, fin));
};
window.rpTekPeriodeExcel = function(debut, fin){
  const D = rpTekPeriode(debut, fin), T = rpEnteteExcel('tek', 'Statistiques de production', 'Période ' + rpPeriodeTxt(debut, fin));
  const syn = T.concat([['Indicateur', 'Valeur'], ['Production (pièces)', D.total], ['Objectif cumulé', D.obj], ['Rendement moyen (%)', D.rend === null ? '' : Math.round(D.rend * 10) / 10],
    ['Jours avec production', D.jours.length], ['Jours travaillés', D.nbTravailles], ['Pertes / arrêts', D.arrets],
    ['Meilleur jour', D.meilleur ? rpFr(D.meilleur.iso) + ' (' + Math.round(D.meilleur.rend) + ' %)' : ''], ['Jour le plus faible', D.faible ? rpFr(D.faible.iso) + ' (' + Math.round(D.faible.rend) + ' %)' : ''],
    [], ['Classement des opératrices'], ['Rang', 'Opératrice', 'Pièces', 'Part (%)', 'Jours', 'Moyenne par jour']])
    .concat(D.classement.map((o, i) => [i === 0 ? '1 🏆' : i + 1, o.nom, o.total, D.total ? Math.round(o.total / D.total * 1000) / 10 : 0, o.jours, o.jours ? Math.round(o.total / o.jours) : 0]));
  const ops = getOpsForDate(fin);
  const jours = T.concat([['Date', 'Pièces', 'Objectif', 'Rendement (%)', 'Arrêts'].concat(ops.map((n, i) => 'Poste ' + (i + 1)))])
    .concat(D.jours.map(j => [rpFr(j.iso), j.total, j.obj, j.rend === null ? '' : Math.round(j.rend * 10) / 10, j.arrets].concat(j.perOp)))
    .concat([['TOTAL', D.total, D.obj, D.obj ? Math.round(D.total / D.obj * 1000) / 10 : '', D.arrets]]);
  rpExcel(rpNomFichier('tek', 'Statistiques', debut, fin), [
    {nom:'Synthèse', lignes:syn, larg:[26, 26, 12, 10, 8, 16], fusions:[[0, 0, 0, 5], [1, 0, 1, 5]]},
    {nom:'Par jour', lignes:jours, larg:[12, 10, 10, 13, 8, 10, 10, 10, 10], fusions:[[0, 0, 0, 8], [1, 0, 1, 8]]}]);
};

// ============================================================
// TEK-TREND — fiche d'un jour (historique)
// ============================================================
window.rpTekJourPdf = function(iso){
  const D = rpTekJour(iso);
  const corps = `<div class="kpis">${rpKpi('Production du jour', rpN(D.total) + ' pcs')}${rpKpi('Objectif', rpN(D.obj))}${rpKpi('Rendement', rpPct(D.rend), rpClsRend(D.rend))}${rpKpi('Pertes / arrêts', rpN(D.arrets))}</div>
    <h2>Production heure par heure</h2>
    <table><thead><tr><th>Heure</th>${D.ops.map(n => `<th class="n">${esc(n)}</th>`).join('')}<th class="n">Total heure</th><th class="n">Cumul</th><th>Observations</th></tr></thead><tbody>
    ${D.lignes.map(l => `<tr><td>${esc(l.h)}</td>${l.v.map(v => `<td class="n">${v || ''}</td>`).join('')}<td class="n"><b>${l.s || ''}</b></td><td class="n">${l.cumul}</td><td>${esc(l.obs)}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td>${D.perOp.map(v => `<td class="n">${rpN(v)}</td>`).join('')}<td class="n">${rpN(D.total)}</td><td class="n">—</td><td>Objectif : ${rpN(D.obj)}</td></tr></tbody></table>
    <h2>Part de chaque opératrice</h2>
    <table><thead><tr><th>Opératrice</th><th class="n">Pièces</th><th class="n">Part de l'équipe</th></tr></thead><tbody>
    ${D.ops.map((n, i) => `<tr><td>${esc(n)}</td><td class="n">${rpN(D.perOp[i])}</td><td class="n">${D.total ? Math.round(D.perOp[i] / D.total * 100) + ' %' : ''}</td></tr>`).join('')}</tbody></table>`;
  rpPdf('tek', 'Fiche de production du jour', rpFr(iso), corps, rpNomFichier('tek', 'Jour', iso, iso));
};
window.rpTekJourExcel = function(iso){
  const D = rpTekJour(iso), T = rpEnteteExcel('tek', 'Fiche de production du jour', rpFr(iso));
  const l = T.concat([['Production', D.total, 'Objectif', D.obj, 'Rendement (%)', D.rend === null ? '' : Math.round(D.rend * 10) / 10, 'Arrêts', D.arrets], [],
    ['Heure'].concat(D.ops).concat(['Total heure', 'Cumul', 'Observations'])])
    .concat(D.lignes.map(x => [x.h].concat(x.v).concat([x.s, x.cumul, x.obs])))
    .concat([['TOTAL'].concat(D.perOp).concat([D.total, '', 'Objectif : ' + D.obj])]);
  rpExcel(rpNomFichier('tek', 'Jour', iso, iso), [{nom:'Jour ' + rpFr(iso).replace(/\//g, '-'), lignes:l, larg:[14, 14, 14, 14, 14, 12, 10, 30], fusions:[[0, 0, 0, 7], [1, 0, 1, 7]]}]);
};

// ============================================================
// GADH — période (statistiques) et jour (historique)
// ============================================================
window.rpGadhPeriodePdf = function(debut, fin){
  const D = rpGadhPeriode(debut, fin), semaines = D.jours.length > 31;
  const lignes = semaines ? rpParSemaine(D.jours, ['total']).map(s => ({lib:'Semaine du ' + rpFr(s.iso), nb:s.nb, total:s.total})) : D.jours.map(j => ({lib:rpFr(j.iso), total:j.total}));
  const corps = `<div class="kpis">${rpKpi('Pièces retournées', rpN(D.total) + ' pcs')}${rpKpi('Jours avec retours', D.jours.length)}${rpKpi('Moyenne par jour', D.moyenne === null ? '—' : rpN(Math.round(D.moyenne)))}${rpKpi('Meilleur jour', D.meilleur ? rpFr(D.meilleur.iso) + ' · ' + rpN(D.meilleur.total) : '—', 'bon')}${rpKpi('Références', D.parRef.length)}</div>
    <div class="deux"><div><h2>Pièces retournées ${semaines ? 'par semaine' : 'par jour'}</h2>
      <table><thead><tr><th>${semaines ? 'Semaine' : 'Date'}</th><th class="n">Pièces</th><th class="n">Part</th></tr></thead><tbody>
      ${lignes.map(l => `<tr><td>${l.lib}${l.nb ? ' <span style="color:#777">(' + l.nb + ' j)</span>' : ''}</td><td class="n">${rpN(l.total)}</td><td class="n">${D.total ? Math.round(l.total / D.total * 100) + ' %' : ''}</td></tr>`).join('') || '<tr><td colspan="3">Aucune pièce retournée sur la période</td></tr>'}
      <tr class="tot"><td>Total</td><td class="n">${rpN(D.total)}</td><td class="n">100 %</td></tr></tbody></table></div>
    <div><h2>Pièces par référence</h2>
      <table><thead><tr><th>Référence</th><th class="n">Pièces</th><th class="n">Part</th></tr></thead><tbody>
      ${D.parRef.map(([rk, q]) => `<tr><td>${esc(gadhRefName(rk))}</td><td class="n">${rpN(q)}</td><td class="n">${D.total ? Math.round(q / D.total * 100) + ' %' : ''}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>'}
      </tbody></table>
      <p class="note">Pièces assemblées et retournées à TEK-TREND (étape « Retour TEK-TREND » du suivi des commandes).</p></div></div>`;
  rpPdf('gadh', 'Statistiques de production', 'Période ' + rpPeriodeTxt(debut, fin), corps, rpNomFichier('gadh', 'Statistiques', debut, fin));
};
window.rpGadhPeriodeExcel = function(debut, fin){
  const D = rpGadhPeriode(debut, fin), T = rpEnteteExcel('gadh', 'Statistiques de production', 'Période ' + rpPeriodeTxt(debut, fin));
  const syn = T.concat([['Indicateur', 'Valeur'], ['Pièces retournées', D.total], ['Jours avec retours', D.jours.length], ['Moyenne par jour', D.moyenne === null ? '' : Math.round(D.moyenne)],
    ['Meilleur jour', D.meilleur ? rpFr(D.meilleur.iso) + ' (' + D.meilleur.total + ' pièces)' : ''], [], ['Pièces par référence'], ['Référence', 'Pièces', 'Part (%)']])
    .concat(D.parRef.map(([rk, q]) => [gadhRefName(rk), q, D.total ? Math.round(q / D.total * 1000) / 10 : 0]));
  const refs = D.parRef.map(([rk]) => rk);
  const jours = T.concat([['Date', 'Total'].concat(refs.map(gadhRefName))]).concat(D.jours.map(j => [rpFr(j.iso), j.total].concat(refs.map(rk => j.refs[rk] || '')))).concat([['TOTAL', D.total].concat(D.parRef.map(x => x[1]))]);
  rpExcel(rpNomFichier('gadh', 'Statistiques', debut, fin), [
    {nom:'Synthèse', lignes:syn, larg:[34, 14, 10], fusions:[[0, 0, 0, 2], [1, 0, 1, 2]]},
    {nom:'Par jour', lignes:jours, larg:[12, 10].concat(refs.map(() => 18))}]);
};
window.rpGadhJourPdf = function(iso){
  const r = cmdRetourGadhParRefDuJour(iso), refs = gadhRefsTriees(r), total = refs.reduce((s, x) => s + x[1], 0), P = rpGadhPersonnel(iso);
  const corps = `<div class="kpis">${rpKpi('Pièces retournées', rpN(total) + ' pcs')}${rpKpi('Références', refs.length)}${rpKpi('Personnel présent', P.present + ' / ' + P.total)}${rpKpi('Absents', P.absents.length, P.absents.length ? 'mauvais' : '')}${rpKpi('Retards', P.retards.length, P.retards.length ? 'mauvais' : '')}</div>
    <div class="deux"><div><h2>Pièces retournées par référence</h2>
      <table><thead><tr><th>Référence</th><th class="n">Pièces</th><th class="n">Part</th></tr></thead><tbody>
      ${refs.map(([rk, q]) => `<tr><td>${esc(gadhRefName(rk))}</td><td class="n">${rpN(q)}</td><td class="n">${total ? Math.round(q / total * 100) + ' %' : ''}</td></tr>`).join('') || '<tr><td colspan="3">Aucune pièce retournée ce jour-là</td></tr>'}
      <tr class="tot"><td>Total</td><td class="n">${rpN(total)}</td><td class="n">${total ? '100 %' : ''}</td></tr></tbody></table></div>
    <div><h2>Personnel du jour</h2>
      <table><thead><tr><th>Situation</th><th>Personnes</th></tr></thead><tbody>
      <tr><td>Absents</td><td>${P.absents.map(esc).join('<br>') || '—'}</td></tr><tr><td>En retard</td><td>${P.retards.map(esc).join('<br>') || '—'}</td></tr></tbody></table></div></div>`;
  rpPdf('gadh', 'Fiche du jour', rpFr(iso), corps, rpNomFichier('gadh', 'Jour', iso, iso));
};
window.rpGadhJourExcel = function(iso){
  const r = cmdRetourGadhParRefDuJour(iso), refs = gadhRefsTriees(r), total = refs.reduce((s, x) => s + x[1], 0), P = rpGadhPersonnel(iso), T = rpEnteteExcel('gadh', 'Fiche du jour', rpFr(iso));
  const l = T.concat([['Référence', 'Pièces retournées', 'Part (%)']]).concat(refs.map(([rk, q]) => [gadhRefName(rk), q, total ? Math.round(q / total * 1000) / 10 : 0])).concat([['TOTAL', total, total ? 100 : ''], [],
    ['Personnel', 'Présents', P.present + ' / ' + P.total], ['Absents', P.absents.join(', ') || '—'], ['En retard', P.retards.join(', ') || '—']]);
  rpExcel(rpNomFichier('gadh', 'Jour', iso, iso), [{nom:'Jour ' + rpFr(iso).replace(/\//g, '-'), lignes:l, larg:[34, 18, 12], fusions:[[0, 0, 0, 2], [1, 0, 1, 2]]}]);
};

// Barre de boutons commune (à placer en tête d'écran).
function rpBoutons(excel, pdf, extra){
  return `<div class="card no-print" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <span style="font-size:12.5px;color:var(--ink-soft);flex:1 1 140px;">Fiche de cet écran :</span>
    <button class="btn btn-primary" style="padding:8px 14px;" onclick="${excel}">${ICONS.export} Excel</button>
    <button class="btn btn-primary" style="padding:8px 14px;" onclick="${pdf}">${ICONS.export} PDF</button>${extra || ''}</div>`;
}
