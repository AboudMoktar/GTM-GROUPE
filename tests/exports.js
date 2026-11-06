#!/usr/bin/env node
// Suivi PERCKO, onglet Exports : export libre sur plusieurs commandes, cartons, validation, documents (données d'essai, sans base).
// Lancement (dans tests/) : npm run exports
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), ctx = await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true});
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.print = () => {}; });
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof vExports === 'function');
  // deux commandes : PKA (ancienne) et PKB ; NEOLYS et ALLOGA (limité à sa commande)
  await p.evaluate(() => {
    const L = (id, lot, cl, lib, sz, q) => ({id, lot, year:2026, client:cl, model:'M', lib, size:sz, qty:q, cc:0});
    S.lines.push(L('A_S', 'PK202610', 'NEOLYS', 'LYNE PRO homme gris', 'S', 20), L('A_M', 'PK202610', 'NEOLYS', 'LYNE PRO homme gris', 'M', 10),
                 L('B_S', 'PK202611', 'NEOLYS', 'LYNE PRO homme gris', 'S', 30), L('B_M', 'PK202611', 'NEOLYS', 'LYNE PRO homme gris', 'M', 30),
                 L('B_G', 'PK202611', 'NEOLYS', 'Gilet homme noir', 'L', 12), L('B_AL', 'PK202611', 'ALLOGA', 'PHARMA_HOMME COL V NOIR', 'M', 60));
    const ret = {A_S: 8, A_M: 10, B_S: 30, B_M: 25, B_G: 12, B_AL: 64};
    Object.keys(ret).forEach((id, i) => ['cp', 'gadh', 'asm', 'ret', 'conf'].forEach((st, k) => S.moves.push({id:'M' + i + k, date:'2026-11-01', lineId:id, stage:st, qty:ret[id], nc:0, note:''})));
    S.lots.PK202610 = {ready:true}; S.lots.PK202611 = {ready:true};
    ui.tab = 'exp'; ui.xp = null; render();
  });
  const r = [];
  const etat = () => p.evaluate(() => JSON.parse(JSON.stringify({ex: S.exports, mv: S.moves.filter(m => m.ct)})));
  r.push(['onglet Exports présent', await p.locator('#tabs button', {hasText: 'Exports'}).count() === 1]);
  // 1. nouvel export NEOLYS
  await p.click('text=+ Nouvel export'); await p.waitForTimeout(200);
  await p.fill('.xp-form input[type=date]', '2026-11-07');
  r.push(['destinataire prérempli selon la nature', /NEOLYS/.test(await p.inputValue('.xp-form textarea'))]);
  await p.click('text=Créer l\'export et ajouter les cartons'); await p.waitForTimeout(300);
  let E = (await etat()).ex;
  r.push(['export créé (N°1, NEOLYS, en cours)', E.length === 1 && E[0].n === 1 && E[0].cl === 'NEOLYS' && E[0].st === 'cours' && E[0].d === '2026-11-07']);
  r.push(['éditeur du carton N°1 ouvert', /Carton N°1/.test(await p.locator('#view').textContent())]);
  // 2. carton en tableau : commande PK202610, modèles de la commande en lignes, tailles en colonnes
  const cell = (lib, sz) => p.locator('.xp-mx input[title^="' + lib + ' · ' + sz + ' "]');
  r.push(['bandeau : carton en cours toujours affiché', /Carton N°1/.test(await p.locator('.xp-sticky').textContent()) && /carton 1 sur 1/.test(await p.locator('.xp-sticky').textContent())]);
  r.push(['commandes enregistrées proposées', await p.locator('.xp-cmd .sx-chip').count() === 2]);
  await p.locator('.xp-cmd .sx-chip', {hasText: 'PK202610'}).click(); await p.waitForTimeout(150);
  r.push(['tableau : les modèles de la commande', await p.locator('.xp-mx tbody tr').count() === 1 && await cell('Lyne Pro Homme Gris', 'S').count() === 1 && await p.locator('text=Afficher tous les modèles').count() === 1]);
  r.push(['reste du retour GADH en gris dans la case', await cell('Lyne Pro Homme Gris', 'S').getAttribute('placeholder') === '8']);
  await cell('Lyne Pro Homme Gris', 'S').fill('12'); await cell('Lyne Pro Homme Gris', 'M').fill('5');
  r.push(['saisie libre, dépassement en rouge, total à jour', await cell('Lyne Pro Homme Gris', 'S').getAttribute('class') === 'trop' && (await p.locator('.xp-sticky .xp-tot').textContent()) === '17']);
  await p.click('text=Afficher tous les modèles'); await p.waitForTimeout(150);
  r.push(['tous les modèles du catalogue sur demande', await p.locator('.xp-mx tbody tr').count() >= 5 && await cell('Lyne Pro Homme Gris', 'S').inputValue() === '12']);
  // 3. commande pas encore enregistrée
  await p.fill('input[placeholder^="Autre N°"]', 'pk202612'); await p.click('.xp-cmd button:has-text("OK")'); await p.waitForTimeout(150);
  r.push(['N° de lot libre accepté', await p.locator('.xp-cmd .sx-chip', {hasText: 'PK202612 (non enregistrée)'}).count() === 1 && /contient aussi 17 pièce/.test(await p.locator('#view').textContent())]);
  await cell('Gilet Homme Noir', 'L').fill('7');
  r.push(['total du carton (deux commandes)', (await p.locator('.xp-sticky .xp-tot').textContent()) === '24']);
  await p.click('text=✔ Valider et carton suivant'); await p.waitForTimeout(300);
  ({ex: E} = await etat()); let c1 = E[0].cartons[0];
  const q = (c, id, lot, lib, sz) => c.it.filter(x => (id ? x[0] === id : (!x[0] && x[2] === lot && x[3] === lib && x[4] === sz))).reduce((a, x) => a + x[1], 0);
  r.push(['pièces rattachées à leur commande, ou libres', q(c1, 'A_S') === 12 && q(c1, 'A_M') === 5 && q(c1, null, 'PK202612', 'Gilet homme noir', 'L') === 7]);
  let mv = (await etat()).mv;
  r.push(['carton : seules les pièces des commandes enregistrées vont au suivi', mv.filter(m => m.ct === c1.id && m.stage === 'emb').reduce((a, m) => a + m.qty, 0) === 17]);
  r.push(['carton suivant ouvert (N°2, même commande)', /Carton N°2/.test(await p.locator('.xp-sticky').textContent()) && await p.locator('.xp-cmd .sx-chip.on', {hasText: 'PK202612'}).count() === 1]);
  await cell('Gilet Homme Noir', 'L').fill('7');
  await p.locator('.xp-cmd .sx-chip', {hasText: /^PK202610$/}).click(); await p.waitForTimeout(150);
  await cell('Lyne Pro Homme Gris', 'M').fill('5');
  await p.click('text=✔ Valider le carton N°2'); await p.waitForTimeout(300);
  ({ex: E} = await etat()); const c2 = E[0].cartons[1];
  r.push(['carton N°2 enregistré', E[0].cartons.length === 2 && q(c2, 'A_M') === 5 && q(c2, null, 'PK202612', 'Gilet homme noir', 'L') === 7 && !q(c2, 'A_S')]);
  // modifier un carton : le tableau montre ce qui est déjà dedans
  await p.locator('.xp-carton', {hasText: 'Carton N°1'}).locator('text=Modifier').click(); await p.waitForTimeout(200);
  r.push(['modifier : quantités déjà mises affichées', /Carton N°1/.test(await p.locator('.xp-sticky').textContent()) && await p.locator('.xp-cmd .sx-chip.on').count() === 1]);
  r.push(['modifier : tableau prérempli', await cell('Lyne Pro Homme Gris', 'S').inputValue() === '12' && await cell('Lyne Pro Homme Gris', 'M').inputValue() === '5']);
  await p.click('text=Annuler'); await p.waitForTimeout(200);
  // 5. les cartons de l'export comptent dans le reste à emballer de la commande
  r.push(['reste à emballer de la commande à jour', await p.evaluate(() => dispoRetour('PK202610', 'A_S', null) === 0 && dispoRetour('PK202610', 'A_M', null) === 0)]);
  // 6. documents
  const html = await p.evaluate(() => { const e = S.exports[0], c = pkExports.colisExport(e); return {col: pkExports.colisageHtml(e, c), tot: pkExports.totalHtml(e, c), D: pkExports.totalDonneesExport(e, c)}; });
  r.push(['colisage : commande de chaque ligne', /PK202610/.test(html.col) && /PK202612/.test(html.col) && /Date d'export : le 07\/11\/2026/.test(html.col)]);
  const gt = await p.evaluate(() => { const e = S.exports[0], c = pkExports.colisExport(e), tot = (g) => { const r = g.rows[g.rows.length - 1]; return [r.cells[0].v, r.cells[3].v]; };
    const gA = pkExports.totalCommandeGrid(e, c, 'PK202610'), head = gA.rows[3].cells.map(x => x.v).join('|'), lyneS = gA.rows.find(r => r.cells[1] && r.cells[1].v === 'LYNE PRO homme gris' && r.cells[2].v === 'S');
    return {head, A: tot(gA), B: tot(pkExports.totalCommandeGrid(e, c, 'PK202612')), tout: tot(pkExports.totalCommandeGrid(e, c, null)), lot: gA.rows[1].cells[3].v, lyneS: lyneS && lyneS.cells[3].v, nRefs: gA.rows.length}; });
  r.push(['liste total au format de la commande', gt.head === 'Model|LIBELLE|Taille|Quantité|Total' && gt.lot === 'PK202610' && gt.lyneS === 12 && gt.nRefs > 10]);
  r.push(['liste total : une par commande, ou sans lot', gt.A[1] === 22 && gt.B[1] === 14 && gt.tout[1] === 36 && /PK202610/.test(html.tot) && /PK202612/.test(html.tot)]);
  const etA = html.D.etat.find(x => x.lot === 'PK202610');
  r.push(['état des commandes (commandé, cet export, reste)', etA && etA.T.cde === 30 && etA.T.ce === 22 && etA.T.reste === 8]);
  await p.click('text=← Export N°1').catch(() => {});
  await p.waitForTimeout(200);
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 8000}).catch(() => null), p.click('text=📗 Tout en Excel')]);
  r.push(['Excel de l\'export (4 feuilles)', (!!dl && /^Export_Export1_NEOLYS_20261107\.xlsx$/.test(dl.suggestedFilename())) || /Fichier prêt : Export_Export1_NEOLYS_20261107\.xlsx/.test(await p.locator('#toast').textContent())]);
  const sl = await p.evaluate(() => { const e = S.exports[0], c = pkExports.colisExport(e); return {col: pkExports.colisageHtml(e, c, true), tot: pkExports.totalHtml(e, c, true), g: pkExports.totalGridX(e, c, true)}; });
  r.push(['liste de colisage sans lot', !/PK2026/.test(sl.col) && /PERCKO/.test(sl.col) && /Total t-shirt pour export/.test(sl.col)]);
  r.push(['liste total sans lot (un seul total)', /PK202610 \+ PK202612/.test(sl.tot) && />36</.test(sl.tot)]);
  const pdf = await p.evaluate(() => { let out = null; const sv = window.saveFile; window.saveFile = (n, d) => { out = {n, s: Array.from(d.slice(0, 9)).map(c => String.fromCharCode(c)).join(''), t: Array.from(d).map(c => String.fromCharCode(c)).join('')}; }; pkExports.pdfX(S.exports[0]); window.saveFile = sv; return out && {n: out.n, debut: out.s, logo: /\/Subtype \/Image/.test(out.t) && /DCTDecode/.test(out.t) && /\/Im1 Do/.test(out.t)}; });
  r.push(['tout en PDF (fiches avec logo, colisage, liste total)', !!pdf && pdf.n === 'Export_Export1_NEOLYS_20261107.pdf' && pdf.debut.startsWith('%PDF-1.4') && pdf.logo]);
  await p.click('text=Sans lot'); await p.waitForTimeout(150);
  r.push(['choix « sans lot » pour les documents', await p.locator('text=🖨 Liste total (sans lot)').count() === 1]);
  await p.click('text=Avec les lots (par commande)'); await p.waitForTimeout(150);
  await p.click('text=🖨 Tout imprimer'); await p.waitForTimeout(300);
  r.push(['impression : fiches, colisage, liste total', await p.evaluate(() => { const z = document.getElementById('pk-doc-zone'); return !!z && /CARTON N°2/.test(z.innerHTML) && /Liste|Total t-shirt pour export/.test(z.innerHTML) && /LIBELLE/.test(z.innerHTML) && /PK202612/.test(z.innerHTML); })]);
  // 7. validation : pièces expédiées, affectées à leurs commandes
  await p.click('text=✔ Valider l\'export (Fini)'); await p.waitForTimeout(200);
  await p.click('text=✔ Oui, valider (pièces expédiées)'); await p.waitForTimeout(300);
  ({ex: E, mv} = await etat());
  const exp = (id) => mv.filter(m => m.ct === E[0].id && m.stage === 'exp' && m.lineId === id).reduce((a, m) => a + m.qty, 0);
  r.push(['export validé : FINI', E[0].st === 'fini']);
  r.push(['pièces expédiées sur leurs commandes', exp('A_S') === 12 && exp('A_M') === 10 && mv.filter(m => m.stage === 'exp').length === 3]);
  // la commande PK202612 est enregistrée ensuite : rattachement
  await p.evaluate(() => { S.lines.push({id:'C_G', lot:'PK202612', year:2026, client:'NEOLYS', model:'M', lib:'Gilet homme noir', size:'L', qty:20, cc:0}); ['cp','gadh','asm','ret','conf'].forEach((st, k) => S.moves.push({id:'MC' + k, date:'2026-11-02', lineId:'C_G', stage:st, qty:20, nc:0, note:''})); render(); });
  r.push(['commande enregistrée ensuite : rattachement proposé', await p.locator('text=Rattacher aux commandes').count() === 1]);
  await p.click('text=Rattacher aux commandes'); await p.waitForTimeout(300);
  ({ex: E, mv} = await etat());
  r.push(['pièces rattachées : emballées et expédiées sur la commande', E[0].cartons.every(c => c.it.every(x => x[0])) && exp('C_G') === 14 && mv.filter(m => m.lineId === 'C_G' && m.stage === 'emb').reduce((a, m) => a + m.qty, 0) === 14]);
  r.push(['export fini : cartons non modifiables', await p.locator('text=+ Ajouter un carton').count() === 0]);
  // 8. sauvegarde : l'export est enregistré et relu
  const rt = await p.evaluate(() => { const d = desiredDocs(); const avant = JSON.stringify(S.exports); applyDocs(d); return {doc: !!d.exports, same: JSON.stringify(S.exports) === avant, mv: S.moves.filter(m => m.ct).length}; });
  r.push(['export enregistré et relu à l\'identique', rt.doc && rt.same && rt.mv === mv.length]);
  // 9. rouvrir puis supprimer : plus rien d'expédié ni d'emballé
  await p.evaluate(() => { ui.xp = {id: S.exports[0].id}; render(); });
  await p.click('text=Rouvrir l\'export'); await p.waitForTimeout(300);
  ({ex: E, mv} = await etat());
  r.push(['export rouvert : expédition annulée', E[0].st === 'cours' && !mv.some(m => m.stage === 'exp')]);
  await p.click('text=Supprimer l\'export'); await p.waitForTimeout(300);
  ({ex: E, mv} = await etat());
  r.push(['export supprimé : pièces de nouveau à emballer', E.length === 0 && mv.length === 0]);
  // 10. ALLOGA : une seule taille, limité à la commande
  const al = await p.evaluate(() => { const e = {id:'X2', n:2, d:'2026-11-08', cl:'ALLOGA', nat:'ALLOGA', dest:null, st:'cours', dv:'', cartons:[]}; S.exports.push(e); const l = lineById('B_AL'); return pkExports.dispoLigne(l, 'ALLOGA', null); });
  r.push(['ALLOGA : disponible indiqué (60 sur 64 revenues)', al === 60]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
