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
  r.push(['poids automatique : 12 kg (moins de 90 pièces)', await p.inputValue('.xp-cedit .xp-kg') === '12']);
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
  // poids et commentaire d'un carton, modifiables sur la fiche de l'export
  r.push(['poids auto : 90 pièces = 18 kg, sinon 12 kg', await p.evaluate(() => pkExports.poidsAuto(90) === 18 && pkExports.poidsAuto(24) === 12 && S.exports[0].cartons[0].kg === null && pkExports.poidsDe(S.exports[0], S.exports[0].cartons[0]) === 12)]);
  await p.locator('.xp-carton', {hasText: 'Carton N°1'}).locator('.xp-kg').fill('15'); await p.keyboard.press('Tab'); await p.waitForTimeout(250);
  await p.locator('.xp-carton', {hasText: 'Carton N°1'}).locator('.xp-cin').fill('Carton renforcé'); await p.keyboard.press('Tab'); await p.waitForTimeout(250);
  ({ex: E} = await etat());
  r.push(['poids et commentaire du carton modifiés', E[0].cartons[0].kg === 15 && E[0].cartons[0].com === 'Carton renforcé' && /27 kg/.test(await p.locator('.xp-kpi').textContent())]);
  // toutes les informations de l'export modifiables (N°, commentaire…)
  const infos = async (n, com) => { await p.click('text=✏️ Modifier les informations'); await p.waitForTimeout(150); await p.fill('.xp-form input[type=number]', n); await p.locator('.xp-form textarea').nth(1).fill(com); await p.click('text=✔ Enregistrer'); await p.waitForTimeout(250); };
  await infos('5', 'Transporteur DHL');
  ({ex: E, mv} = await etat());
  r.push(['informations modifiées (N°, commentaire), suivi à jour', E[0].n === 5 && E[0].com === 'Transporteur DHL' && mv.every(m => /N°5/.test(m.note)) && /Transporteur DHL/.test(await p.locator('#view').textContent())]);
  await infos('1', 'Transporteur DHL');
  // 5. les cartons de l'export comptent dans le reste à emballer de la commande
  r.push(['reste à emballer de la commande à jour', await p.evaluate(() => dispoRetour('PK202610', 'A_S', null) === 0 && dispoRetour('PK202610', 'A_M', null) === 0)]);
  // 6. documents
  const html = await p.evaluate(() => { const e = S.exports[0], c = pkExports.colisExport(e); return {col: pkExports.colisageHtml(e, c), tot: pkExports.totalHtml(e, c), D: pkExports.totalDonneesExport(e, c)}; });
  r.push(['colisage : commande de chaque ligne', /PK202610/.test(html.col) && /PK202612/.test(html.col) && /Date d'export : le 07\/11\/2026/.test(html.col)]);
  const gt = await p.evaluate(() => { const e = S.exports[0], c = pkExports.colisExport(e), tot = (g) => { const r = g.rows[g.rows.length - 1]; return [r.cells[0].v, r.cells[3].v]; };
    const gA = pkExports.totalCommandeGrid(e, c, 'PK202610'), head = gA.rows[3].cells.map(x => x.v).join('|'), lyneS = gA.rows.find(r => r.cells[1] && r.cells[1].v === 'LYNE PRO homme gris' && r.cells[2].v === 'S');
    return {head, A: tot(gA), B: tot(pkExports.totalCommandeGrid(e, c, 'PK202612')), tout: tot(pkExports.totalCommandeGrid(e, c, null)), lot: gA.rows[1].cells[3].v, lyneS: lyneS && lyneS.cells[3].v, nRefs: gA.rows.length, vides: gA.rows.slice(4, -1).filter(r => !(r.cells[3].v > 0)).length}; });
  r.push(['liste total au format de la commande', gt.head === 'Model|LIBELLE|Taille|Quantité|Total' && gt.lot === 'PK202610' && gt.lyneS === 12]);
  r.push(['liste total : seulement les modèles et tailles avec quantité', gt.nRefs === 7 && gt.vides === 0]);
  r.push(['liste total : une par commande, ou sans lot', gt.A[1] === 22 && gt.B[1] === 14 && gt.tout[1] === 36 && /PK202610/.test(html.tot) && /PK202612/.test(html.tot)]);
  const rc = await p.evaluate(() => { const e = S.exports[0], c = pkExports.colisExport(e), v = (g, r) => g.rows[r].cells.map(x => x ? x.v : '');
    const g = pkExports.recapTotalGrid(e, c, false), gs = pkExports.recapTotalGrid(e, c, true), iT = g.rows.findIndex(r => r.cells[0] && r.cells[0].v === 'TOTAL PIÈCES'), iS = gs.rows.findIndex(r => r.cells[0] && r.cells[0].v === 'TOTAL PIÈCES');
    return {head: v(g, 2).join('|'), tot: v(g, iT).slice(2).join('|'), ct: v(g, iT + 1).slice(2).join('|'), f: g.rows[iT].cells[4].f, headS: v(gs, 2).join('|'), totS: gs.rows[iS].cells[2].v,
      noms: pkExports.feuillesDoc(e, 'total').map(x => x.name).join('|'), html: /Récapitulatif — Export N°1/.test(pkExports.totalHtml(e, c)) && /TOTAL PIÈCES/.test(pkExports.totalHtml(e, c, true))}; });
  r.push(['liste total : récapitulatif par commande et total', rc.head === 'Model|LIBELLE|PK202610|PK202612|TOTAL' && rc.tot === '22|14|36' && rc.ct === '2|2|2' && /^SUM\(E\d+:E\d+\)$/.test(rc.f)]);
  r.push(['récapitulatif sans lot (total seul)', rc.headS === 'Model|LIBELLE|TOTAL' && rc.totS === 36]);
  r.push(['récapitulatif imprimé, en PDF et en Excel', rc.html && rc.noms === 'Liste total PK202610|Liste total PK202612|Récapitulatif']);
  const etA = html.D.etat.find(x => x.lot === 'PK202610');
  const ec = await p.evaluate(() => { const e = S.exports[0], g = pkExports.etatCommandeGrid(e, 'PK202610'), v = (r) => g.rows[r].cells.map(x => x ? x.v : '');
    const iS = g.rows.findIndex(r => r.cells[2] && r.cells[2].v === 'S'), iT = g.rows.length - 1;
    return {t0: v(0).join('|'), t1: v(1).join('|'), head: v(2).join('|'), s: v(iS).slice(1).join('|'), tot: v(iT).slice(3).join('|'), f: g.rows[iS].cells[12].f, gB: pkExports.etatCommandeGrid(e, 'PK202612'), noms: pkExports.feuillesDoc(e, 'etat').map(x => x.name).join('|')}; });
  r.push(['état des commandes au format de la commande', /^Commande: (NOVEMBRE|OCTOBRE)\|\|LOT\|ANNEE/.test(ec.t0) && /\|PK202610\|2026\|/.test(ec.t1) && ec.head === 'Model|LIBELLE|Taille|NEOLYS|ALLOGA|FLÉCHÉS|VESTIAIRES|Total|Total|Statut|Exporté 07/11|Emballés|Reste']);
  r.push(['état : quantités, exporté, reste (formule)', ec.s === 'LYNE PRO homme gris|S|20||||20|30||12||8' && ec.tot === '30|0|0|0|30|30||22|0|8' && /^MAX\(0,H\d+-SUM\(K\d+:L\d+\)\)$/.test(ec.f)]);
  const sur = await p.evaluate(() => { S.lines.push({id:'Z1', lot:'PKZ', year:2026, client:'NEOLYS', model:'M', lib:'LYNE PRO homme gris', size:'S', qty:50, cc:0}, {id:'Z2', lot:'PKZ', year:2026, client:'NEOLYS', model:'M', lib:'LYNE PRO homme gris', size:'M', qty:100, cc:0});
    ['cp','gadh','asm','ret','conf','ctl','emb'].forEach((st, k) => S.moves.push({id:'MZ' + k, date:'2026-11-02', lineId:'Z1', stage:st, qty:55, nc:0, note:''}));
    const g = pkExports.etatCommandeGrid(null, 'PKZ'), h = g.rows[2].cells.map(x => x ? x.v : ''), iR = h.lastIndexOf('Reste'), rs = g.rows.slice(3, -1).map(x => x.cells[iR].v), t = g.rows[g.rows.length - 1].cells[iR];
    S.lines = S.lines.filter(l => l.lot !== 'PKZ'); S.moves = S.moves.filter(m => !/^MZ/.test(m.id)); return {rs: rs.join('|'), t: t.v, f: t.f}; });
  r.push(['reste jamais négatif ; TOTAL = total − (expédié + emballé)', sur.rs === '0|100' && sur.t === 95 && /^MAX\(0,/.test(sur.f)]);
  r.push(['état : une page par commande',ec.noms === 'Etat PK202610|Etat PK202612']);
  r.push(['état des commandes (commandé, cet export, reste)', etA && etA.T.cde === 30 && etA.T.ce === 22 && etA.T.reste === 8]);
  const doc = (d, b) => p.locator('.xp-doc[data-doc="' + d + '"]').locator('button', {hasText: b});
  r.push(['chaque document à part : imprimer, PDF, Excel', await p.locator('.xp-doc').count() === 5 && await doc('total', 'PDF').count() === 1 && await doc('colis', 'Excel').count() === 1 && await p.locator('text=Tout en PDF').count() === 0]);
  await doc('total', 'Excel').click(); await p.waitForTimeout(300);
  r.push(['liste total en Excel', /Fichier prêt : Liste_total_Export1_NEOLYS_20261107\.xlsx/.test(await p.locator('#toast').textContent())]);
  const sl = await p.evaluate(() => { const e = S.exports[0], c = pkExports.colisExport(e); return {col: pkExports.colisageHtml(e, c, true), tot: pkExports.totalHtml(e, c, true), g: pkExports.totalGridX(e, c, true)}; });
  r.push(['liste de colisage sans lot', !/PK2026/.test(sl.col) && /PERCKO/.test(sl.col) && /Total t-shirt pour export/.test(sl.col)]);
  r.push(['liste total sans lot (un seul total)', /PK202610 \+ PK202612/.test(sl.tot) && />36</.test(sl.tot)]);
  const pdf = await p.evaluate(() => { const out = {}; const sv = window.saveFile; window.saveFile = (n, d) => { out[n] = Array.from(d).map(c => String.fromCharCode(c)).join(''); };
    ['fiches', 'colis', 'total', 'etat'].forEach(q => pkExports.pdfDoc(S.exports[0], q)); window.saveFile = sv; return Object.keys(out).map(n => ({n, ok: out[n].startsWith('%PDF-1.4'), logo: /\/Subtype \/Image/.test(out[n]) && /DCTDecode/.test(out[n])})); });
  r.push(['PDF de chaque document (fiches avec logo)', pdf.length === 4 && pdf.every(x => x.ok) && pdf.find(x => x.n === 'Fiches_cartons_Export1_NEOLYS_20261107.pdf').logo && !!pdf.find(x => x.n === 'Liste_total_Export1_NEOLYS_20261107.pdf')]);
  await p.click('text=Sans lot'); await p.waitForTimeout(150);
  r.push(['choix « sans lot » pour les documents', /Tout l'export/.test(await p.locator('.xp-doc[data-doc="total"]').textContent()) && await p.locator('.xp-doc[data-doc="etat"]').count() === 0]);
  await p.click('text=Avec les lots (par commande)'); await p.waitForTimeout(150);
  await doc('total', 'Imprimer').click(); await p.waitForTimeout(300);
  r.push(['impression de la liste total seule', await p.evaluate(() => { const z = document.getElementById('pk-doc-zone'); return !!z && /LIBELLE/.test(z.innerHTML) && /PK202612/.test(z.innerHTML) && !/CARTON N°2/.test(z.innerHTML); })]);
  if (await p.locator('#pk-apercu').count()) await p.click('#pk-apercu [data-ap="Fermer"]');
  await doc('fiches', 'Imprimer').click(); await p.waitForTimeout(300);
  r.push(['impression des fiches cartons', await p.evaluate(() => { const z = document.getElementById('pk-doc-zone'); return !!z && /CARTON N°2/.test(z.innerHTML); })]);
  if (await p.locator('#pk-apercu').count()) await p.click('#pk-apercu [data-ap="Fermer"]');
  // 7. validation : pièces expédiées, affectées à leurs commandes
  await p.click('text=✔ Valider l\'export (Fini)'); await p.waitForTimeout(200);
  await p.click('text=✔ Oui, valider (pièces expédiées)'); await p.waitForTimeout(300);
  ({ex: E, mv} = await etat());
  const exp = (id) => mv.filter(m => m.ct === E[0].id && m.stage === 'exp' && m.lineId === id).reduce((a, m) => a + m.qty, 0);
  r.push(['export validé : FINI', E[0].st === 'fini']);
  r.push(['pièces expédiées sur leurs commandes', exp('A_S') === 12 && exp('A_M') === 10 && mv.filter(m => m.stage === 'exp').length === 3]);
  r.push(['export validé : ouvert dans l\'Archive avec ses détails', await p.evaluate(() => ui.tab === 'arch' && ui.amodeX === 'exp') && /Export validé \(archivé\)/.test(await p.locator('#view').textContent()) && await p.locator('.xp-carton').count() === 2 && await p.locator('.xp-doc').count() === 5]);
  await p.evaluate(() => { ui.tab = 'exp'; ui.xp = {}; render(); }); await p.waitForTimeout(150);
  r.push(['Exports : seulement les exports en cours', await p.locator('.xp-li').count() === 0 && /1 export\(s\) validé/.test(await p.locator('#view').textContent())]);
  await p.click('text=Voir les exports expédiés'); await p.waitForTimeout(150);
  r.push(['Archive : liste des exports expédiés', await p.evaluate(() => ui.tab === 'arch') && await p.locator('.xp-li.fini').count() === 1]);
  await p.locator('.xp-li.fini').click(); await p.waitForTimeout(150);
  const ec2 = await p.evaluate(() => pkExports.etatCommandeGrid(null, 'PK202610').rows[2].cells.map(x => x ? x.v : '').join('|'));
  r.push(['état de commande (tout le lot) depuis le suivi', ec2 === 'Model|LIBELLE|Taille|NEOLYS|ALLOGA|FLÉCHÉS|VESTIAIRES|Total|Total|Statut|Exporté 07/11|Emballés|Reste']);
  await p.evaluate(() => { ui.tab = 'suivi'; ui.lot = 'PK202610'; ui.smode = 'q'; render(); }); await p.waitForTimeout(150);
  r.push(['boutons « État de commande » dans le suivi', await p.locator('.xp-etat').count() === 1 && await p.locator('.xp-etat button', {hasText: 'PDF'}).count() === 1]);
  await p.evaluate(() => { ui.tab = 'arch'; ui.amodeX = 'exp'; ui.xpa = {id: S.exports[0].id}; render(); }); await p.waitForTimeout(150);
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
  r.push(['export rouvert : expédition annulée, retour dans « Exports en cours »', E[0].st === 'cours' && !mv.some(m => m.stage === 'exp') && await p.evaluate(() => ui.tab === 'exp')]);
  r.push(['état de commande : export en cours signalé', await p.evaluate(() => pkExports.etatCommandeGrid(null, 'PK202610').rows[2].cells.some(x => x && x.v === 'En cours 07/11'))]);
  await p.click('text=✔ Valider l\'export (Fini)'); await p.waitForTimeout(200);
  await p.click('text=✔ Oui, valider (pièces expédiées)'); await p.waitForTimeout(300);
  await p.click('text=Supprimer l\'export'); await p.waitForTimeout(300);
  ({ex: E, mv} = await etat());
  r.push(['export validé supprimé : plus rien d\'expédié ni d\'emballé', E.length === 0 && mv.length === 0]);
  r.push(['commande modifiable à toute étape (taille déjà traitée mise à 0)', await p.evaluate(() => { try { setLine('PK202611', 2026, 'NEOLYS', 'LYNE PRO homme gris', 'S', 0); } catch (e) { return false; } const l = lineById('B_S'); return !!l && l.qty === 0; })]);
  // 10. ALLOGA : une seule taille, limité à la commande
  const al = await p.evaluate(() => { const e = {id:'X2', n:2, d:'2026-11-08', cl:'ALLOGA', nat:'ALLOGA', dest:null, st:'cours', dv:'', cartons:[]}; S.exports.push(e); const l = lineById('B_AL'); return pkExports.dispoLigne(l, 'ALLOGA', null); });
  r.push(['ALLOGA : disponible indiqué (60 sur 64 revenues)', al === 60]);
  // 11. FLÉCHÉS / VESTIAIRES : des produits, pas des clients ; le client se choisit à la création des cartons (nature de l'export)
  await p.evaluate(() => { S.lines.push({id:'B_F', lot:'PK202611', year:2026, client:'FLÉCHÉS', model:'M', lib:'PHARMA_HOMME COL V NOIR', size:'S', qty:40, cc:0});
    ['cp','gadh','asm','ret','conf'].forEach((st, k) => S.moves.push({id:'MF' + k, date:'2026-11-02', lineId:'B_F', stage:st, qty:40, nc:0, note:''}));
    ui.tab = 'exp'; ui.xp = {nouveau:true}; render(); });
  const natures = await p.locator('.xp-form .seg button').allTextContents();
  r.push(['FLÉCHÉS : jamais une nature d\'export (seulement les clients)', natures.includes('NEOLYS') && natures.includes('ALLOGA') && !natures.some(t => /FLÉCHÉS|VESTIAIRES/.test(t))]);
  r.push(['FLÉCHÉS : disponible pour un export NEOLYS ou ALLOGA', await p.evaluate(() => pkExports.dispoLigne(lineById('B_F'), 'NEOLYS', null) === 40 && pkExports.dispoLigne(lineById('B_F'), 'ALLOGA', null) === 40)]);
  await p.evaluate(() => { S.exports.push({id:'X3', n:3, d:'2026-11-09', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', cartons:[]}); ui.xp = {id:'X3', carton:{nouveau:true}}; render(); });
  await p.locator('.xp-cmd .sx-chip', {hasText: /PK202611$/}).click(); await p.waitForTimeout(150);
  const cf = p.locator('.xp-mx input[data-sp="FLÉCHÉS"][title^="Pharma Homme Col V Noir · FLÉCHÉS · S "]');
  r.push(['carton : ligne « FLÉCHÉS » à part, sous son modèle', await cf.count() === 1 && await p.locator('.xp-mx tr.sp .xp-tag.sp', {hasText: 'FLÉCHÉS'}).count() === 1 && await cf.getAttribute('placeholder') === '40']);
  await cf.fill('10'); await cell('Lyne Pro Homme Gris', 'S').fill('5');
  await p.click('text=✔ Valider le carton N°1'); await p.waitForTimeout(300);
  const x3 = await p.evaluate(() => JSON.parse(JSON.stringify(S.exports.find(e => e.id === 'X3'))));
  const itF = x3.cartons[0].it.find(x => x[0] === 'B_F');
  r.push(['carton : pièces FLÉCHÉS sur leur ligne, pour NEOLYS', !!itF && itF[1] === 10 && itF[5] === 'FLÉCHÉS' && await p.evaluate(() => S.moves.filter(m => m.lineId === 'B_F' && m.stage === 'emb').reduce((a, m) => a + m.qty, 0) === 10)]);
  r.push(['fiche de l\'export : étiquette FLÉCHÉS, pas « surplus »', await p.locator('.xp-carton .xp-tag.sp', {hasText: 'FLÉCHÉS'}).count() === 1 && !/surplus FLÉCHÉS/.test(await p.locator('#view').textContent())]);
  const fd = await p.evaluate(() => { const e = S.exports.find(x => x.id === 'X3'), c = pkExports.colisExport(e), it = c[0].items.find(x => x.sp === 'FLÉCHÉS');
    const g = pkExports.totalCommandeGrid(e, c, 'PK202611'), rf = g.rows.find(r => r.cells[1] && r.cells[1].v === 'PHARMA_HOMME COL V NOIR · FLÉCHÉS');
    const et = pkExports.etatCommandeGrid(null, 'PK202611'), head = et.rows[2].cells.map(x => x ? x.v : ''), iF = head.indexOf('FLÉCHÉS'), iX = head.findIndex(v => /^En cours 09\/11/.test(v));
    const rs = et.rows.find(r => r.cells[1] && r.cells[1].v === 'PHARMA_HOMME COL V NOIR' && r.cells[2] && r.cells[2].v === 'S');
    return {it: it && it.lib + '|' + it.src, col: /Pharma Homme Col V Noir · Fléchés/.test(pkExports.colisageHtml(e, c)), tot: rf && rf.cells[3].v, fl: rs && rs.cells[iF].v, ex: rs && rs.cells[iX].v, tot2: pkExports.totalDonneesExport(e, c).parLot.PK202611.libs.map(b => b.src).join(',')}; });
  r.push(['documents : « LIBELLÉ · FLÉCHÉS » pour le client de l\'export', fd.it === 'PHARMA_HOMME COL V NOIR · FLÉCHÉS|NEOLYS' && fd.col && fd.tot === 10 && fd.tot2 === 'NEOLYS,NEOLYS']);
  r.push(['état de commande : colonne FLÉCHÉS et export suivi', fd.fl === 40 && fd.ex === 10]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
