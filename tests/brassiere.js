#!/usr/bin/env node
// Brassières (22/11/2026) : coupe chez MMGT, puis assemblage, confection, contrôle, emballage et expédition chez TEK-TREND
// (jamais à la GADH) ; tissu 0,6 m au total par pièce ; fiche de consommation brassière ; coques Santoul T54 / T56.
// Données inventées. Lancement (dans tests/) : node brassiere.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const CAPTURES = process.env.CAPTURES || '';
(async () => {
  const r = [];
  const s = serveur.demarrer(8795), b = await chromium.launch();
  const p = await (await b.newContext({viewport: {width: 1280, height: 900}})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8795/suivi-commandes.html'); await p.waitForFunction(() => typeof vFlux === 'function' && typeof S === 'object');
  const lot = 'PK202607';
  await p.evaluate((lot) => {
    S.bom = S.bom || {}; Object.keys(NOMEN_MAJ.bom).forEach(k => { S.bom[k] = NOMEN_MAJ.bom[k].map(x => x.slice()); }); Object.assign(S.mat, NOMEN_MAJ.mat);
    NOMEN_MAJ.nomen.forEach(a => { if (!S.nomen.some(n => n.lib === a[1] && n.size === a[2])) S.nomen.push({model:a[0], lib:a[1], size:a[2], t1:a[3], t2:a[4], cc:a[5], ca:a[6], ca2:a[7], colle:0}); });
    S.ajouts = S.ajouts || {}; delete S.ajouts.brassiere20261122;
    majBrassiere();
    const q = {"A-B":{S:240, M:185, L:80, XL:20, XXL:15}, "C-D":{S:175, M:450, L:290, XL:70, XXL:30}, "E-F":{S:50, M:170, L:115, XL:50, XXL:15}, "G-H":{M:30, L:25, XL:20}};
    let n = 0; Object.keys(q).forEach(m => Object.keys(q[m]).forEach(z => S.lines.push({id:'B' + (n++), lot, year:2026, client:'PERCKO', model:'BRASSIÈRE', lib:'BRASSIÈRE ' + m, size:z, qty:q[m][z], cc:0})));
    S.lines.push({id:'P1', lot:'PK202608', year:2026, client:'PERCKO', model:'PHARMA-HOMME', lib:'PHARMA_HOMME COL V NOIR', size:'M', qty:10, cc:0});
    S.lots[lot] = {ready:'2026-07-01'}; S.lots.PK202608 = {ready:'2026-07-01'};
    ui.lot = lot; ui.client = '*'; ui.tab = 'suivi'; ui.smode = 'p'; render();
  }, lot);

  // 1. parcours : comme l'exosquelette, sans la GADH
  const h = (await p.locator('.ph-t thead').textContent()) || '';
  r.push(['pilotage : « Passée à l\'assemblage (TEK-TREND) » et « En confection »', /assemblage \(TEK-TREND\)/.test(h) && /En confection/.test(h) && !/GADH/.test(h)]);
  r.push(['centre de coupe : MMGT', await p.evaluate(() => centreCoupe('BRASSIÈRE'))=== 'MMGT']);

  // 2. nomenclature mise à jour d'après la fiche du 22/11/2026
  const bom = await p.evaluate(() => ({cdxxl: bomLignes('BRASSIÈRE C-D', 'XXL').filter(b => /COQUES/.test(b.ref))[0].ref, ghl: bomLignes('BRASSIÈRE G-H', 'L').filter(b => /COQUES/.test(b.ref))[0].ref,
    ab: bomLignes('BRASSIÈRE A-B', 'XXL').filter(b => /COQUES/.test(b.ref))[0].ref, lam: bomLignes('BRASSIÈRE A-B', 'M').filter(b => /LAMINETTE/.test(b.ref))[0].q, t56: S.mat['ACC-COQUES-SANTOUL-T56'], fois: majBrassiere()}));
  r.push(['coques : C-D XXL et G-H L → Santoul T54 ; A-B XXL → P152SQ10-120', bom.cdxxl === 'ACC-COQUES-SANTOUL-T54' && bom.ghl === 'ACC-COQUES-SANTOUL-T54' && bom.ab === 'ACC-COQUES-P152SQ10-120' && !!bom.t56]);
  r.push(['laminette : 10 kg pour ~3650 pièces (0,00274 kg/pc)', bom.lam === 0.00274]);
  r.push(['mise à jour appliquée une seule fois', bom.fois === false]);

  // 3. consommations : coupe MMGT par modèle, total 0,6 m par pièce, pas d'assemblage GADH
  const c = await p.evaluate((lot) => { const B = besoinsMatieres(lot), cut = conso(lot, '*').rows.reduce((t, x) => t + x.cut, 0), mm = conso(lot, '*').rows.reduce((t, x) => t + x.needC, 0);
    return {tis: B['TIS-RENEW-CULT-NOIR'], cut, mm, colle: B['ADH-VIX1711C-175'] || {}, cc: ccCoupe('BRASSIÈRE C-D', 'M')}; }, lot);
  r.push(['tissu : 0,6 m × pièces à produire au total', Math.abs(c.tis.tot - 0.6 * c.cut) < 0.05]);
  r.push(['coupe MMGT : 0,137 m pour C-D (fiche de coupe)', c.cc === 0.137 && c.mm > 0 && Math.abs(c.tis.MMGT - c.mm) < 0.5]);
  r.push(['colle : comptée en confection TEK-TREND, plus à la GADH', !c.colle.GADH && c.colle.CONF > 0]);
  const fc = await p.evaluate((lot) => JSON.stringify(ficheGrid(lot, '*', 'c', true, 'MMGT').rows.map(x => (x.cells || []).map(y => y ? y.v : ''))), lot);
  r.push(['fiche de coupe MMGT : consommations 0,115 / 0,137 / 0,157 / 0,187', ['0.115', '0.137', '0.157', '0.187'].every(v => fc.indexOf(v) >= 0)]);

  // 4. fiche de consommation brassière
  const g = await p.evaluate((lot) => ficheBraGrid(lot).rows.map(x => (x.cells || []).map(y => y ? y.v : '')), lot);
  const ligne = (a) => g.filter(x => x[0] === a)[0] || [];
  r.push(['fiche brassière : titre, tissu 0,6, attaches 4', /Consommation unitaire matière brassière/i.test(String(g[0][0])) && ligne('Renew Cult Noir (total par pièce)')[2] === 0.6 && ligne('Attaches régleurs DH 821 doré')[3] === 4]);
  const agr = g.filter(x => x[1] === 'S' && (x[0] === 'Agrafe (cm)'))[0] || [];
  r.push(['fiche brassière : agrafe S = 9 / 11 / 13 / 15 cm', agr[2] === 9 && agr[3] === 11 && agr[4] === 13 && agr[5] === 15]);
  r.push(['fiche brassière : coques Santoul T54 après les P152SQ10', g.findIndex(x => x[0] === 'Coques Santoul T54') > g.findIndex(x => x[0] === 'Coques P152SQ10 -120')]);
  r.push(['fiche brassière : coques Santoul T54 (C-D XXL, E-F XL, G-H L)', JSON.stringify(ligne('Coques Santoul T54').slice(2, 6)) === JSON.stringify(['', 'XXL', 'XL', 'L'])]);
  const besTis = g.filter(x => x[7] === 'Renew Cult Noir')[0] || [];
  r.push(['fiche brassière : besoin de tissu de la commande', Math.abs(besTis[9] - 0.6 * c.cut) < 0.05]);
  await p.evaluate(() => { ui.tab = 'fiche'; ui.fiche = 'b'; render(); });
  const vue = await p.locator('#view').textContent();
  r.push(['onglet Fiches : « Brassière », sans « Assemblage (GADH) »', /Brassière \(Excel\)/.test(vue) && !/Assemblage \(GADH\)/.test(await p.locator('.seg').first().textContent())]);
  if (CAPTURES) await p.screenshot({path: CAPTURES + '/bra-fiche.png', fullPage: true});

  // 5. vue GADH : pas de brassière
  await p.evaluate(() => { VUE = 'gadh'; libellesExo.m = null; render(); });
  r.push(['vue GADH : brassières absentes', await p.evaluate((lot) => filtered(lot, '*').length === 0 && dashData().every(d => d.lot !== lot), lot)]);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  if (err.length) console.log(err.join('\n'));
  await b.close(); s.close();
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  process.exit(ko ? 1 : 0);
})();
