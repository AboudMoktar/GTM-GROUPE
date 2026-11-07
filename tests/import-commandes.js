#!/usr/bin/env node
// Suivi PERCKO, onglet Commandes : modèle Excel des commandes (tous les modèles, exosquelette, brassières) et import (en cours / expédiée).
// Lancement (dans tests/) : npm run import-commandes
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const fs = require('fs'), path = require('path'), XLSX = require('xlsx');
const XLSX_LOCAL = path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), r = [], err = [];
  const p = await b.newPage(); p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.route('**/xlsx.full.min.js', rt => rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(XLSX_LOCAL, 'utf8')}));
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && window.pkImportCommandes && window.XLSX);
  await p.evaluate(() => {
    ['S', 'M', 'L', 'XL', 'XXL'].forEach(z => S.nomen.push({model:'BRASSIÈRE', lib:'BRASSIÈRE A-B', size:z, t1:'', t2:'', cc:0, ca:0, ca2:0, colle:0}));
    S.nomen.push({model:'EXOSQUELETTE', lib:'EXOSQUELETTE', size:'TU', t1:'', t2:'', cc:0, ca:0, ca2:0, colle:0});
    ui.tab = 'cmd'; render();
    window.__f = []; window.saveFile = (n, d) => { window.__f.push({n, d: Array.from(d)}); };
  });
  await p.waitForTimeout(200);
  r.push(['carte « modèle Excel » dans Commandes', await p.locator('summary', {hasText: 'Saisir plusieurs commandes avec un fichier Excel'}).count() === 1]);
  await p.click('summary:has-text("Saisir plusieurs commandes")'); await p.fill('.ic-an', '2026');
  await p.click('text=📥 Télécharger le modèle Excel'); await p.waitForTimeout(400);
  const f = await p.evaluate(() => window.__f[0]); const wb = XLSX.read(Buffer.from(f.d), {cellFormula: true});
  r.push(['modèle : une feuille par mois', f.n === 'Modele_commandes_2026.xlsx' && wb.SheetNames.length === 12 && wb.SheetNames[0] === 'PK202601' && wb.SheetNames[11] === 'PK202612']);
  const sh = wb.Sheets.PK202601, rows = XLSX.utils.sheet_to_json(sh, {header: 1, defval: ''});
  r.push(['en-tête : LOT, ANNEE, date, statut, expédition', rows[2].slice(0, 5).join('|') === 'LOT|ANNEE|DATE COMMANDE|STATUT|DATE EXPÉDITION' && rows[3][0] === 'PK202601' && rows[3][3] === 'En cours']);
  r.push(['format de la fiche de commande', rows[5].join('|') === 'Model|LIBELLE|Taille|NEOLYS|ALLOGA|Total']);
  r.push(['tous les modèles, exosquelette et brassières', rows.some(x => x[1] === 'BRASSIÈRE A-B' && x[2] === 'XXL') && rows.some(x => x[1] === 'EXOSQUELETTE' && x[2] === 'TU') && rows.some(x => x[1] === 'LYNE FLEX femme gris')]);
  const iEx = rows.findIndex(x => x[1] === 'EXOSQUELETTE') + 1;
  r.push(['total en formule', sh['F' + iEx].f === 'SUM(D' + iEx + ':E' + iEx + ')']);
  // remplir : janvier expédiée, février en cours, mars vide, avril erreur
  const ligne = (ws, lib, z) => XLSX.utils.sheet_to_json(ws, {header: 1, defval: ''}).findIndex(x => x[1] === lib && x[2] === z) + 1;
  const pose = (ws, ref, v) => { ws[ref] = typeof v === 'number' ? {t: 'n', v} : {t: 's', v}; };
  const j = wb.Sheets.PK202601; pose(j, 'C4', '05/01/2026'); pose(j, 'D4', 'Expédiée'); pose(j, 'E4', '20/02/2026');
  pose(j, 'D' + ligne(j, 'PHARMA_HOMME COL V NOIR', 'M'), 100); pose(j, 'E' + ligne(j, 'PHARMA_HOMME COL V NOIR', 'M'), 40); pose(j, 'D' + ligne(j, 'EXOSQUELETTE', 'TU'), 12); pose(j, 'D' + ligne(j, 'BRASSIÈRE A-B', 'L'), 30);
  const fe = wb.Sheets.PK202602; pose(fe, 'C4', 46050); pose(fe, 'D' + ligne(fe, 'Gilet homme noir', 'XL'), 55);
  const av = wb.Sheets.PK202604; pose(av, 'D' + ligne(av, 'Gilet femme noir', 'S'), 'abc');
  const imp = async (w) => { await p.setInputFiles('.ic-file', {name: 'commandes.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(w, {type: 'buffer', bookType: 'xlsx'})}); await p.waitForTimeout(500); };
  await imp(wb);
  const ap = await p.locator('.ic-l').textContent();
  r.push(['aperçu : commandes remplies, feuilles vides ignorées', await p.locator('.ic-c').count() === 3 && /PK202601.*Expédiée \(historique\)/.test(ap) && /NEOLYS 142 · ALLOGA 40 · total 182/.test(ap) && /PK202602.*En cours/.test(ap)]);
  r.push(['aperçu : erreur signalée, commande non importée', await p.locator('.ic-c.ko').count() === 1 && /PK202604/.test(await p.locator('.ic-c.ko').textContent()) && /« abc »/.test(await p.locator('.ic-c.ko').textContent())]);
  await p.click('text=✔ Importer 2 commande(s)'); await p.waitForTimeout(400);
  const st = await p.evaluate(() => {
    const T = stageTotals(), L1 = S.lines.filter(l => l.lot === 'PK202601'), L2 = S.lines.filter(l => l.lot === 'PK202602'), d = dashData();
    const exp1 = L1.reduce((a, l) => a + ((T[l.id] || {}).exp || 0), 0), dates = S.moves.filter(m => L1.some(l => l.id === m.lineId)).map(m => m.date);
    return {n1: L1.length, q1: L1.reduce((a, l) => a + l.qty, 0), exp1, dates: [...new Set(dates)].join(','), fini1: (d.find(x => x.lot === 'PK202601') || {st: {}}).st.done, hist: S.lots.PK202601.historique, dc: S.lots.PK202601.dc,
      n2: L2.length, q2: L2.reduce((a, l) => a + l.qty, 0), mv2: S.moves.filter(m => L2.some(l => l.id === m.lineId)).length, ready2: lotReady('PK202602'), dc2: (S.lots.PK202602 || {}).dc, allo: L1.filter(l => l.client === 'ALLOGA').length};
  });
  r.push(['commande expédiée : quantités et clients', st.n1 === 4 && st.q1 === 182 && st.allo === 1]);
  r.push(['commande expédiée : toutes les étapes à la date d\'expédition', st.exp1 === 182 && st.dates === '2026-02-20' && st.hist === '2026-02-20' && st.dc === '2026-01-05']);
  r.push(['commande expédiée : terminée (Archive)', st.fini1 === true]);
  r.push(['commande en cours : quantités, à valider, sans suivi', st.n2 === 1 && st.q2 === 55 && st.mv2 === 0 && st.ready2 === false && st.dc2 === '2026-01-28']);
  // réimport de janvier « expédiée » : refusé (suivi existant)
  await imp(wb);
  r.push(['commande déjà suivie : réimport « expédiée » refusé', /existe déjà avec un suivi/.test(await p.locator('.ic-c.ko', {hasText: 'PK202601'}).textContent())]);
  await p.click('.sx-annul');
  r.push(['sauvegarde', await p.evaluate(() => { const d = desiredDocs(); return !!d['lines-PK202601'] && !!d['moves-PK202601-0'] && d.cfg.lots.PK202601.historique === '2026-02-20'; })]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
