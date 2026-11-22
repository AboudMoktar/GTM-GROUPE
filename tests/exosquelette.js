#!/usr/bin/env node
// Exosquelette (22/11/2026) : tout se fait chez TEK-TREND (coupe, assemblage, confection, contrôle, emballage, expédition),
// jamais à la GADH ; fiche de consommation de l'exosquelette ; carton de 6 pièces, 8 kg brut. Données inventées.
// Lancement (dans tests/) : node exosquelette.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const CAPTURES = process.env.CAPTURES || '';
(async () => {
  const r = [];
  const s = serveur.demarrer(8793), b = await chromium.launch();
  const p = await (await b.newContext({viewport: {width: 1280, height: 900}})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8793/suivi-commandes.html'); await p.waitForFunction(() => typeof vFlux === 'function' && typeof S === 'object');
  const lot = 'PK202612-1', mixte = 'PK202612-2';
  await p.evaluate(([lot, mixte]) => {
    const L = (id, lo, lib, model, sz, q) => ({id, lot:lo, year:2026, client:'PERCKO', model, lib, size:sz, qty:q, cc:0});
    S.lines.push(L('E1', lot, 'EXOSQUELETTE', 'EXOSQUELETTE', 'TU', 100));
    S.lines.push(L('E2', mixte, 'EXOSQUELETTE', 'EXOSQUELETTE', 'TU', 30), L('P1', mixte, 'PHARMA_HOMME COL V NOIR', 'PHARMA-HOMME', 'M', 50));
    if (!(S.bom || {}).EXOSQUELETTE){ S.bom = S.bom || {}; S.bom.EXOSQUELETTE = NOMEN_MAJ.bom.EXOSQUELETTE; Object.assign(S.mat, NOMEN_MAJ.mat); }   /* nomenclature validée le 21/10/2026 */
    S.lots[lot] = {ready:'2026-11-20'}; S.lots[mixte] = {ready:'2026-11-20'};
    const mv = (id, st, q, d) => S.moves.push({id:'M' + S.moves.length, date:d || '2026-11-21', lineId:id, stage:st, qty:q, nc:0, note:''});
    mv('E1', 'cp', 105); mv('E2', 'cp', 30); mv('P1', 'cp', 50); mv('P1', 'gadh', 50, '2026-11-21');
    ui.lot = lot; ui.client = '*'; ui.tab = 'suivi'; ui.smode = 'p'; render();
  }, [lot, mixte]);

  // 1. libellés : lot tout exosquelette
  let h = (await p.locator('.ph-t thead').textContent()) || '';
  r.push(['pilotage : colonnes « Passée à l\'assemblage (TEK-TREND) » et « En confection »', /assemblage \(TEK-TREND\)/.test(h) && /En confection/.test(h) && !/GADH/.test(h)]);
  if (CAPTURES) await p.screenshot({path: CAPTURES + '/exo-pilotage.png', fullPage: false});

  // 2. passage à l'assemblage puis confection, saisis chez TEK-TREND (l'étape « en assemblage » se remplit seule)
  await p.evaluate(() => commit(function(){ modifierEtape('gadh', {E1:100}, 'test', '2026-11-22'); modifierEtape('ret', {E1:90}, 'test', '2026-11-22'); }));
  const t1 = await p.evaluate(() => stageTotals().E1);
  r.push(['assemblage 100 puis confection 90 enregistrés, « en assemblage » rempli automatiquement', t1.gadh === 100 && t1.ret === 90 && t1.asm === 90]);

  // 3. saisie par étape : la confection n'est plus « automatique » pour l'exosquelette
  await p.evaluate(() => { ui.tab = 'flux'; ui.fmode = 'simple'; ui.sxOpen = false; render(); });
  const tuile = await p.locator('.sx-tile', {hasText: 'Confection'}).first().getAttribute('class');
  r.push(['saisie par étape : tuile « Confection » saisissable (pas automatique)', !/auto/.test(tuile || '')]);
  const noms = await p.locator('.sx-tile .nm').allTextContents();
  r.push(['saisie par étape : « Assemblage » à la place de « Envoi GADH »', noms.indexOf('Assemblage') >= 0 && !noms.some(n => /GADH/.test(n))]);
  await p.evaluate(() => { ui.fmode = 'deplacer'; render(); });
  r.push(['déplacer des pièces : statut « Assemblage »', /Assemblage/.test(await p.locator('button[data-de="gadh"]').textContent())]);

  // 4. lot mixte : la confection côté TEK-TREND ne montre que l'exosquelette ; bons GADH sans exosquelette
  await p.evaluate((mixte) => { ui.lot = mixte; ui.fmode = 'simple'; ui.stage = 'ret'; ui.sxOpen = true; render(); }, mixte);
  const txt = await p.locator('#view').textContent();
  r.push(['lot mixte : la confection saisie chez TEK-TREND ne liste que l\'exosquelette', /EXOSQUELETTE/i.test(txt) && !/PHARMA/i.test(txt.replace(/Retour GADH/g, ''))]);
  await p.evaluate(() => commit(function(){ modifierEtape('gadh', {E2:30}, 'test', '2026-11-21'); }));
  const bons = await p.evaluate((mixte) => bonsDates(mixte, 'gadh'), mixte);
  r.push(['bon d\'envoi GADH : seulement les 50 PHARMA (pas les 30 exosquelettes)', bons.length === 1 && bons[0].q === 50]);

  // 5. fiche de consommation de l'exosquelette
  const g = await p.evaluate((lot) => { const g = ficheExoGrid(lot); return g.rows.map(x => (x.cells || []).map(c => c ? c.v : '')); }, lot);
  const ligne = (des) => g.filter(x => x[1] === des)[0] || [];
  const cut = await p.evaluate(() => cutQty(100, 'EXOSQUELETTE'));
  r.push(['fiche exo : titre et 15 matières (boucles, sangles, matières principales, emballage)', /Consommation unitaire matière exosquelette/i.test(String(g[0][0])) && ['Boucle fixe retour tenseur baudrier', 'Sangle principale', 'Bordage', 'Mousse', 'Maille PVC', 'Sac de lavage'].every(d => ligne(d).length)]);
  r.push(['fiche exo : sangle 3,90 ML par pièce, besoin = pièces à produire × 3,90', ligne('Sangle principale')[4] === 3.9 && Math.abs(ligne('Sangle principale')[5] - cut * 3.9) < 0.01]);
  r.push(['fiche exo : boucle 4813 = 4 par pièce, réf. fournisseur', ligne('Boucle fixe retour tenseur baudrier')[4] === 4 && /4813 - Wide Mouth/.test(ligne('Boucle fixe retour tenseur baudrier')[2])]);
  r.push(['fiche exo : cartons de 6 pièces', ligne('Carton d\'expédition (6 pièces, 8 kg brut)')[5] === Math.ceil(cut / 6)]);
  await p.evaluate((lot) => { ui.lot = lot; ui.tab = 'fiche'; ui.fiche = 'x'; render(); }, lot);
  r.push(['onglet Fiches : choix « Exosquelette » affiché', /Exosquelette \(Excel\)/.test(await p.locator('#view').textContent())]);
  if (CAPTURES) await p.screenshot({path: CAPTURES + '/exo-fiche.png', fullPage: true});

  // 6. poids des cartons
  const kg = await p.evaluate(() => { const f = window.pkExports.poidsAuto; return [f(6, [['E1', 6]]), f(3, [['E1', 3]]), f(90, [['P1', 90]])]; });
  r.push(['carton : 6 exosquelettes = 8 kg ; 3 = 4 kg ; autres modèles inchangés (90 pcs = 18 kg)', kg[0] === 8 && kg[1] === 4 && kg[2] === 18]);

  // 7. vue GADH : l'exosquelette n'apparaît pas
  await p.evaluate((mixte) => { VUE = 'gadh'; ui.lot = mixte; libellesExo.m = null; render(); }, mixte);
  const lg = await p.evaluate((mixte) => filtered(mixte, '*').map(l => l.lib), mixte);
  r.push(['vue GADH : le lot mixte ne montre que le PHARMA', lg.length === 1 && /PHARMA/.test(lg[0])]);
  const lotsG = await p.evaluate(() => dashData().map(d => d.lot));
  r.push(['vue GADH : le lot tout exosquelette n\'apparaît pas', lotsG.indexOf(lot) < 0]);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  if (err.length) console.log(err.join('\n'));
  await b.close(); s.close();

  // 8. modules de l'application : rendement GADH, lots chez la GADH, facture d'assemblage sans l'exosquelette
  const store = {}, ctx = {console, getJSON: (k, d) => k in store ? store[k] : d, window: {}, document: {}};
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'suivi-module.js'), 'utf8'), ctx);
  const idx = 'suivi_index', pre = 'suivi_d_';   // constantes de suivi-module.js
  store[idx] = ['cfg', 'lines-A', 'moves-A-0'];
  store[pre + 'cfg'] = {lots: {A: {}}};
  store[pre + 'lines-A'] = {lot: 'A', lines: [['E', 2026, 'PERCKO', 'EXOSQUELETTE', 'EXOSQUELETTE', 'TU', 30, 0], ['P', 2026, 'PERCKO', 'PHARMA-HOMME', 'PHARMA_HOMME COL V NOIR', 'M', 50, 0]]};
  store[pre + 'moves-A-0'] = {lot: 'A', k: 0, moves: [['1', '2026-11-22', 'E', 'gadh', 30, '', 0], ['2', '2026-11-22', 'E', 'ret', 30, '', 0], ['3', '2026-11-22', 'P', 'gadh', 50, '', 0], ['4', '2026-11-22', 'P', 'ret', 20, '', 0]]};
  const ret = ctx.suiviRetoursParRefDuJour('2026-11-22'), fac = ctx.suiviMouvementsParRef('ret', '2026-11-01', '2026-11-30'), pg = ctx.suiviLotsPourGadh();
  r.push(['rendement GADH du jour : 20 PHARMA, pas les 30 exosquelettes', Object.keys(ret).length === 1 && Object.values(ret)[0] === 20]);
  r.push(['facture d\'assemblage GADH → TEK-TREND : sans l\'exosquelette', Object.keys(fac).length === 1 && Object.values(fac)[0].qte === 20]);
  r.push(['lots vus par la GADH : 50 pièces, 20 retournées', pg.length === 1 && pg[0].total === 50 && pg[0].retourFait === 20]);
  r.push(['lots chez la GADH : compte le PHARMA en attente', ctx.suiviLotsChezGadh() === 1]);

  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  process.exit(ko ? 1 : 0);
})();
