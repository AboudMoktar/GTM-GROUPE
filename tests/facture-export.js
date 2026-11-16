#!/usr/bin/env node
// Facture TEK-TREND préparée depuis un export du suivi : une ligne par article du tarif (par col et couleur pour
// les PHARMA), prix du tarif, colis et poids repris de l'export, brouillon modifiable. Quantités et prix inventés.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8785), b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:1366, height:768}, serviceWorkers:'block'}); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8785/index.html'); await p.waitForFunction(() => typeof renderShell === 'function' && typeof percFacturerExport === 'function');
  await p.evaluate(() => { hlEcritureAutorisee = () => true;
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}};
    // tarif d'essai : prix inventés (1 € de plus par article), rangés dans les réglages comme le fait l'écran « Catalogue & prix »
    memoryCache['grp1_fact_params'] = {valeurPiece:2.5, valeurExo:7, tarifExport:percTarif().map((a, i) => ({code:a.code, prix:a.fam === 'flex' ? 0 : 10 + i}))};
    memoryCache['grp1_fact_clients'] = {defaut:{nom:'PERCKO'}};
    activeSociete = 'tek'; activeModule = 'commandes'; renderShell(); nav('commandes-home'); });
  await p.waitForTimeout(1200);
  const fr = () => p.frames().find(f => /suivi-commandes/.test(f.url()));
  await fr().waitForFunction(() => typeof S === 'object' && typeof render === 'function' && typeof pkExports === 'object');
  await fr().evaluate(() => {
    const L = (id, client, model, lib, size) => { S.lines.push({id, lot:'PKT', client, model, lib, size, qty:500, cc:0}); ['cp', 'gadh', 'asm', 'ret'].forEach((st, q) => S.moves.push({id:'M' + id + q, date:'2026-11-10', lineId:id, stage:st, qty:500, nc:0, note:''})); };
    L('a1', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V NOIR', 'S'); L('a2', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V NOIR', 'M'); L('a3', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V NOIR', 'XL');
    L('a4', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V SABLE', 'XXXL');
    L('b1', 'NEOLYS', 'PHARMA-FEMME COL V', 'PHARMA_FEMME COL V ROSE POUDRE', 'XS'); L('b2', 'NEOLYS', 'PHARMA-FEMME COL ROND', 'PHARMA_FEMME COL ROND NOIR', 'L');
    L('b3', 'FLÉCHÉS', 'PHARMA-FEMME COL V', 'PHARMA_FEMME COL V NOIR', 'M');
    L('c1', 'NEOLYS', 'Sport-H-Re-Mi', 'Tee-shirt Sport homme noir', 'XXL'); L('c2', 'NEOLYS', 'Sport-F-Re-Mi', 'Tee-shirt Sport femme noir', 'XXXL');
    L('d1', 'NEOLYS', 'Gilet-F-Noir', 'Gilet femme noir', 'XXXL'); L('e1', 'NEOLYS', 'Pro Homme', 'LYNE PRO homme gris', 'M'); L('f1', 'NEOLYS', 'Flex Homme', 'Flex homme noir', 'S');
    S.exports = [{id:'E1', n:3, d:'2026-11-21', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', com:'', cartons:[]}];
    const e = S.exports[0], it = (id, q) => { const l = S.lines.find(x => x.id === id); return [id, q, 'PKT', l.lib, l.size]; };
    pkExports.enregistrerCartonExport(e, {id:'C1', n:1, kg:12.5, com:'', it:[it('a1', 10), it('a2', 5), it('a3', 7), it('a4', 2), it('b1', 4)]});
    pkExports.enregistrerCartonExport(e, {id:'C2', n:2, kg:8, com:'', it:[it('a1', 3), it('b2', 6), it('b3', 9), it('c1', 11), it('c2', 1), it('d1', 2), it('e1', 8), it('f1', 4)]});
    persist(); ui.lot = 'PKT'; ui.tab = 'exp'; ui.xp = {id:'E1'}; render(); });
  await p.waitForTimeout(900);
  await fr().locator('[data-xp="facture"]').click();
  await p.waitForFunction(() => activeModule === 'factures' && typeof factId !== 'undefined' && !!factId);
  const F = await p.evaluate(() => { const f = factToutes('tek')[factId], t = factTotaux(f); return {statut:f.statut, objet:f.objet, origine:f.origine, percko:f.percko, ht:t.ht, lignes:f.lignes.map(l => [l.ref, l.designation.replace('\n', ' '), l.qte, l.pu].join(' ; '))}; });
  const prix = await p.evaluate(() => { const o = {}; percTarif().forEach(a => { o[a.code] = a.prix; }); return o; });
  const attendu = [
    ['ART001', 'PHARMA HOMME COL V NOIR XS S M', 18], ['ART002', 'PHARMA HOMME COL V NOIR L XL XXL', 7], ['ART003', 'PHARMA HOMME COL V SABLE 3XL', 2],
    ['ART007', 'PHARMA FEMME COL V ROSE XS S M', 4], ['ART008', 'PHARMA FEMME COL R NOIR L XL XXL', 6], ['ART010', 'PHARMA FEMME COL V NOIR FLECHES XS S M', 9],
    ['ART014', 'Sport-H-Re-Mi Taille L,XL,2XL', 11], ['ART020', 'Gilet-F-Noir Taille L,XL,2XL,3XL', 2], ['ART021', 'Pro Homme', 8], ['ART023', 'Flex Homme Taille XS,S,M', 4]
  ].map(x => [x[0], x[1], x[2], prix[x[0]]].join(' ; ')).concat([' ; Tee-shirt Sport femme noir · XXXL ; 1 ; 0']);
  ok(F.statut === 'brouillon' && /Export N°3 du 21\/11\/26/.test(F.objet) && F.origine.type === 'export' && F.origine.exportId === 'E1', 'brouillon créé et rattaché à l\'export N°3');
  ok(JSON.stringify(F.lignes) === JSON.stringify(attendu), 'lignes : article, col, couleur, groupe de tailles, quantité et prix du tarif' + (JSON.stringify(F.lignes) === JSON.stringify(attendu) ? '' : '\n   lu      : ' + F.lignes.join('\n             ') + '\n   attendu : ' + attendu.join('\n             ')));
  const htAtt = 18 * prix.ART001 + 7 * prix.ART002 + 2 * prix.ART003 + 4 * prix.ART007 + 6 * prix.ART008 + 9 * prix.ART010 + 11 * prix.ART014 + 2 * prix.ART020 + 8 * prix.ART021;
  ok(Math.abs(F.ht - htAtt) < 0.005, 'total HT = somme des quantités × prix (' + F.ht + ')');
  ok(String(F.percko.colis) === '2' && Number(F.percko.poidsBrut) === 20.5 && F.percko.destination === 'NEOLYS' && /Neolys/i.test(F.percko.livraison), 'expédition : 2 colis, 20,5 kg brut, adresse NEOLYS');
  ok(/PHARMA/.test(F.percko.composition) && /SPORT/.test(F.percko.composition), 'composition de matière des familles présentes');
  // valeur matière première : 72 pièces × 2,5 (valeurs d'essai), calcul affiché
  const V1 = await p.evaluate(() => ({v:Number(factToutes('tek')[factId].percko.valeurMatiere), t:document.querySelector('[data-pk="valeur-calcul"]').textContent}));
  ok(V1.v === 180 && /72 pièce\(s\) × 2,50 €/.test(V1.t), 'valeur matière première calculée : 72 pièces × 2,50 = 180 — ' + V1.t);
  // un exosquelette ajouté à la main compte à part ; une ligne de frais ne compte pas
  await p.evaluate(() => { factModifier(f => { f.lignes.push({ref:'ART047', designation:'EXOSQUELETTE', qte:3, pu:1, remise:0}); f.lignes.push({ref:'ART0002', designation:'FRAIS EXPORT', qte:1, pu:50, remise:0}); }); });
  ok(await p.evaluate(() => Number(factToutes('tek')[factId].percko.valeurMatiere)) === 201, 'avec 3 exosquelettes : 72 × 2,50 + 3 × 7 = 201 (les frais ne comptent pas)');
  await p.evaluate(() => { factModifier(f => { f.lignes.splice(f.lignes.length - 2, 2); }); });
  // saisie à la main : gardée, plus de recalcul ; « Reprendre le calcul » y revient
  await p.evaluate(() => percMaj('valeurMatiere', '999'));
  await p.evaluate(() => factMajLigne(0, 'qte', 19));
  ok(await p.evaluate(() => Number(factToutes('tek')[factId].percko.valeurMatiere)) === 999, 'valeur saisie à la main : conservée quand les quantités changent');
  await p.evaluate(() => percValeurAuto());
  ok(await p.evaluate(() => Number(factToutes('tek')[factId].percko.valeurMatiere)) === 182.5, '« Reprendre le calcul » : 73 × 2,50 = 182,50');
  await p.evaluate(() => factMajLigne(0, 'qte', 18));
  // modifiable : quantité, prix, ligne ajoutée
  await p.evaluate(() => { factMajLigne(0, 'qte', 20); factMajLigne(9, 'pu', 14.78); factAjouterLigne(); });
  const M = await p.evaluate(() => { const f = factToutes('tek')[factId]; return {q:f.lignes[0].qte, pu:f.lignes[9].pu, n:f.lignes.length, champs:document.querySelectorAll('.mgt-ligne input:not([disabled])').length}; });
  ok(Number(M.q) === 20 && Number(M.pu) === 14.78 && M.n === 12 && M.champs > 20, 'la facture reste modifiable (quantité, prix, lignes)');
  // deuxième demande pour le même export : la facture existante est proposée, pas de doublon
  await p.evaluate(() => { activeModule = 'commandes'; renderShell(); nav('commandes-home'); });
  await p.waitForTimeout(1200);
  await fr().waitForFunction(() => typeof S === 'object' && typeof pkExports === 'object' && S.exports.length === 1);
  await fr().evaluate(() => { ui.lot = 'PKT'; ui.tab = 'exp'; ui.xp = {id:'E1'}; render(); });
  await fr().locator('[data-xp="facture"]').click();
  ok(await fr().locator('.xp-choix [data-choix="ouvrir"]').count() === 1 && await p.evaluate(() => Object.keys(factToutes('tek')).length) === 1, 'facture déjà faite : proposée à l\'ouverture, aucun doublon');
  await fr().locator('.xp-choix [data-choix="ouvrir"]').click();
  await p.waitForFunction(() => activeModule === 'factures');
  ok(await p.evaluate(() => Number(factToutes('tek')[factId].lignes[0].qte) === 20), 'c\'est bien la facture déjà modifiée qui s\'ouvre');
  // écran « Catalogue & prix » : le tarif d'export est modifiable et enregistré dans les réglages
  await p.evaluate(() => nav('fact-catalogue'));
  ok(await p.locator('.pk-tx').count() === 47, 'catalogue : les 47 articles du tarif d\'export');
  await p.locator('.pk-tx[data-code="ART023"] .pk-txp').fill('14.78');
  await p.evaluate(() => percSauverCatalogue(true));
  ok(await p.evaluate(() => percTarif().find(a => a.code === 'ART023').prix === 14.78 && percTarif().find(a => a.code === 'ART001').prix === 10), 'prix modifié enregistré, les autres conservés');
  // le code ne contient aucun prix du tarif d'export (dépôt public)
  ok(await p.evaluate(() => { memoryCache['grp1_fact_params'] = {}; return percTarif().every(a => a.prix === 0) && percValeurs().piece === 0 && percValeurs().exo === 0; }), 'sans réglages, aucun prix ni valeur : ils ne sont pas dans le code');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur'); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
