#!/usr/bin/env node
// ============================================================
// GADH · Gestion des commandes : scénario complet de bout en bout dans la vraie application
// (émulateurs Firebase, règles V2, données d'essai isolées : aucune donnée réelle).
//  0. Migration des anciens modules « Achats et stock » et « Ventes » (sauvegarde, sans doublon)
//  1. Fournisseurs  2. Articles, paliers et tarifs  3. Import d'une liste de besoins (CSV)
//  4. Offre (versions, comparaison)  5. Acceptation  6. Offre → commande client
//  7. Besoins nets  8. Commandes fournisseurs générées  9. Réception partielle (frais)
// 10. Solde de la réception  11. Lots FIFO et stock  12. Réservations  13. Livraison partielle
// 14. Livraison du solde  15. Restes à livrer  16. Facturation GADH  17. Coûts réels et rentabilité
// 18. Tableaux de bord  19. Imports et exports  20. Droits (interface et Firebase), hors ligne puis synchronisation
// Lancement (dans tests/) : npm run e2e-commandes-gadh   (serveur web local sur le port 8790)
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const fs = require('fs'), path = require('path');
const admin = require('./admin.js');
const {chromium} = require('playwright');
const C = require('../roles-config.js');
const {donneesInitiales} = require('./scenarios.js');

const PROJET = 'demo-gtm-groupe', DOM = '@tek-trend.app', MDP = 'Test2026ok';
const SITE = process.env.GTM_SITE || 'http://localhost:8790/index.html';
admin.initializeApp({projectId: PROJET, databaseURL: `http://127.0.0.1:9000?ns=${PROJET}`});
const SDK = path.join(__dirname, 'node_modules', 'firebase');
const CONFIG = `const firebaseConfig = {apiKey:'demo-cle', authDomain:'localhost', databaseURL:'http://127.0.0.1:9000?ns=${PROJET}', projectId:'${PROJET}'};
(function(){ const init = firebase.initializeApp.bind(firebase); firebase.initializeApp = function(c, n){ const app = init(c, n);
  try { app.auth().useEmulator('http://127.0.0.1:9099', {disableWarnings:true}); } catch(e) {} try { app.database().useEmulator('127.0.0.1', 9000); } catch(e) {} return app; }; })();`;
const J = (s) => typeof s === 'string' && s.indexOf('__gtm_json_v1:') === 0 ? JSON.parse(s.slice(14)) : s;
async function liste(cle){ const v = (await admin.database().ref('/groupe1/gadh/' + cle).once('value')).val(); return v ? Object.values(v).map(J).filter(Boolean) : []; }
// Fiches créées par le scénario (hors fiches reprises par la migration).
async function nouveaux(cle){ return (await liste(cle)).filter(x => !x.migre); }
async function objet(cle){ const v = (await admin.database().ref('/groupe1/gadh/' + cle).once('value')).val(); return J(v) || {}; }

(async () => {
  const comptes = {};
  for(const r of C.ORDRE){
    const u = await admin.auth().createUser({email: r.replace(/_/g, '') + DOM, password: MDP});
    const d = C.ROLES[r];
    comptes[u.uid] = {nom: d.label, username: r.replace(/_/g, ''), role: d.role, profil: r, groupe: !!d.groupe, societes: d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  // Anciennes données d'essai (modules remplacés) : prix et unité de l'article « Fil ».
  Object.assign(base.groupe1.gadh.gadh_achat_articles.ar1, {prix:2, prixVente:4, unite:'bobine', fournisseurId:'fo1'});
  base.groupe1.gadh.gadh_fact_params = {raison:'GADH Essai', adresse:'Adresse d\'essai', tva:19, timbre:0, delai:30};
  await admin.database().ref('/').set(base);
  const regles = fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8');
  const rep = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: regles});
  if(!rep.ok) throw new Error('Règles non chargées : ' + rep.status + ' ' + await rep.text());

  const b = await chromium.launch();
  const ouvrir = async (r, large) => {
    const ctx = await b.newContext({viewport:large ? {width:1366, height:900} : {width:412, height:900}, acceptDownloads:true, locale:'fr-FR', serviceWorkers:'block'}); const p = await ctx.newPage();
    const refus = [], erreurs = [];
    p.on('console', m => { const t = m.text(); if(/permission_denied/i.test(t)) refus.push(t.slice(0, 160)); if(m.type() === 'error' && /Gestion des commandes|GC|gc[A-Z]/.test(t)) erreurs.push(t.slice(0, 200)); });
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.route(u => { const s = String(u); return !(s.startsWith('http://localhost') || s.startsWith('http://127.0.0.1')); }, rt => {
      const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url());
      if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')});
      return rt.abort();
    });
    await p.route('**/firebase-config.js', rt => rt.fulfill({contentType: 'application/javascript', body: CONFIG}));
    await p.goto(SITE);
    await p.waitForSelector('#login-user', {timeout: 15000});
    await p.fill('#login-user', r.replace(/_/g, '')); await p.fill('#login-pass', MDP);
    await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout:30000});
    await p.waitForTimeout(3500);
    return {ctx, p, refus, erreurs};
  };
  let ok = 0, total = 0; const echecs = [];
  const verif = (lib, cond, detail) => { total++; if(cond) ok++; else echecs.push(lib + (detail !== undefined ? ' — ' + detail : '')); console.log((cond ? '  ok    ' : '  ÉCHEC ') + lib + (cond || detail === undefined ? '' : ' — ' + detail)); };
  const pause = (p, ms) => p.waitForTimeout(ms || 500);
  const etape = (n, t) => console.log('\n' + n + '. ' + t);
  const proche = (a, x) => Math.abs(a - x) < 0.006;
  const confirmer = async (p) => { await p.click('[data-gc="confirmer"]'); await pause(p, 700); };
  const CAP = process.env.CAPTURES;
  const capture = async (pg, nom) => { if(CAP){ await pg.waitForTimeout(300); await pg.screenshot({path:path.join(CAP, nom + '.png'), fullPage:true}); } };

  // ================= Secrétaire GADH (téléphone) =================
  const S = await ouvrir('secretaire_gadh');
  let p = S.p;
  etape(0, 'Module et migration des anciennes données');
  verif('GADH : « Gestion des commandes » remplace « Achats et stock » et « Ventes »', await p.evaluate(() => { const m = modulesDeSociete('gadh'); return m.indexOf('gadh-commandes') >= 0 && m.indexOf('gadh-achats') < 0 && m.indexOf('gadh-ventes') < 0 && m.indexOf('factures') >= 0; }));
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-commandes'); }); await pause(p, 800);
  verif('Module ouvert : tableau de bord, barre du bas (Accueil, Ventes, Achats, Stock, Plus)', await p.evaluate(() => activeModule === 'gadh-commandes' && activeTab === 'gc-accueil' && Array.from(document.querySelectorAll('.bottomnav button')).map(x => x.innerText.trim()).join('|') === 'Accueil|Ventes|Achats|Stock|Plus'),
    await p.evaluate(() => Array.from(document.querySelectorAll('.bottomnav button')).map(x => x.innerText.trim()).join('|')));
  await p.evaluate(() => nav('gc-reglages')); await pause(p);
  verif('Anciennes données détectées (1 fournisseur, 1 article, 1 bon, 1 devis…)', /1 fournisseur\(s\), 1 article\(s\), 1 bon\(s\) d'achat, 1 mouvement\(s\), 1 devis, 1 commande\(s\), 1 livraison\(s\)/.test(await p.innerText('#gc-body')));
  await p.click('[data-gc="migrer"]'); await pause(p, 300); await confirmer(p); await pause(p, 1500);
  let sauv = await liste('gadh_gc_sauvegardes'), arts = await liste('gadh_gc_articles'), fours = await liste('gadh_gc_fournisseurs'), mvts = await liste('gadh_gc_mouvements');
  verif('Sauvegarde complète enregistrée avant migration (anciennes données incluses)', sauv.length === 1 && sauv[0].type === 'migration' && !!sauv[0].contenu.anciennes.gadh_achat_bons);
  verif('Fournisseur et article repris (sans doublon), stock initial de 30 bobines au dernier prix (2 €)', fours.length === 1 && fours[0].nom === 'Tissus Sfax' && arts.length === 1 && arts[0].designation === 'Fil' && mvts.length === 1 && mvts[0].type === 'initial' && mvts[0].qte === 30 && mvts[0].coutUnit === 2,
    JSON.stringify([fours.length, arts.length, mvts.map(m => [m.type, m.qte, m.coutUnit])]));
  verif('Anciennes données intactes', !!(await admin.database().ref('/groupe1/gadh/gadh_achat_bons').once('value')).val());
  await p.evaluate(() => gcControle()); await pause(p, 300);
  // Les anciennes données d'essai sont incomplètes (bon d'achat sans fournisseur, livraison sans commande) : le contrôle doit le signaler.
  const ctl = await p.innerText('#gc-controle');
  verif('Contrôle de cohérence après migration : les 2 liens manquants des anciennes données sont signalés', /2 anomalie/.test(ctl) && /fournisseur inconnu/.test(ctl) && /commande client inconnue/.test(ctl), ctl);
  verif('Migration : devis, commande, livraison et bon d\'achat repris (numéros conservés)', (await liste('gadh_gc_offres')).some(o => o.numero === 'DV-2026-001' && o.migre) && (await liste('gadh_gc_cmd_clients')).some(c => c.numero === 'CC-2026-001' && c.migre) && (await liste('gadh_gc_cmd_fournisseurs')).some(c => c.ancienNumero === 'BA-2026-001'));
  await p.click('[data-gc="migrer"]'); await pause(p, 300); await confirmer(p); await pause(p, 1000);
  verif('Migration relancée : aucun doublon', (await liste('gadh_gc_articles')).length === 1 && (await liste('gadh_gc_fournisseurs')).length === 1 && (await liste('gadh_gc_mouvements')).length === 1);

  etape(1, 'Fournisseurs');
  await p.evaluate(() => nav('gc-fournisseurs')); await pause(p);
  for(const [nom, delai, cond] of [['Textiles Test', 10, '30 jours fin de mois'], ['Accessoires Test', 5, 'Comptant']]){
    await p.click('[data-gc="nouveau-fournisseur"]'); await pause(p, 300);
    await p.fill('#gf-nom', nom); await p.fill('#gf-delai', String(delai)); await p.fill('#gf-cond', cond); await p.fill('#gf-tel', '00 00 00 00');
    await p.click('[data-gc="enregistrer-fournisseur"]'); await pause(p, 700);
    await p.evaluate(() => nav('gc-fournisseurs')); await pause(p, 300);
  }
  await p.click('[data-gc="nouveau-fournisseur"]'); await pause(p, 300); await p.fill('#gf-nom', 'textiles test'); await p.click('[data-gc="enregistrer-fournisseur"]'); await pause(p, 400);
  fours = await liste('gadh_gc_fournisseurs');
  verif('2 fournisseurs créés (doublon de nom refusé)', fours.length === 3 && await p.evaluate(() => /déjà ce nom/.test(document.querySelector('#toast') ? document.querySelector('#toast').innerText : document.body.innerText)), fours.map(f => f.nom).join(', '));
  await p.evaluate(() => mgtFermer());
  const F1 = fours.find(f => f.nom === 'Textiles Test').id, F2 = fours.find(f => f.nom === 'Accessoires Test').id;

  etape(2, 'Articles, paliers de prix et tarifs fournisseurs');
  await p.evaluate(() => nav('gc-catalogue')); await pause(p);
  await p.click('[data-gc="nouvel-article"]'); await pause(p, 300);
  await p.fill('#ga-ref', 'TIS-001'); await p.fill('#ga-des', 'Tissu coton'); await p.fill('#ga-cat', 'Matière'); await p.fill('#ga-unite', 'm');
  await p.selectOption('#ga-four', F1); await p.fill('#ga-pa', '5'); await p.fill('#ga-pv', '10'); await p.fill('#ga-seuil', '20');
  await p.evaluate(() => { const z = document.getElementById('ga-paliers'); z.insertAdjacentHTML('beforeend', gcPalierLigne({min:100, prix:9})); z.insertAdjacentHTML('beforeend', gcPalierLigne({min:500, prix:8})); });
  await p.click('[data-gc="enregistrer-article"]'); await pause(p, 700);
  arts = await liste('gadh_gc_articles');
  const A1 = arts.find(a => a.ref === 'TIS-001');
  verif('Article TIS-001 : paliers 100 → 9 € et 500 → 8 €, historique des prix', !!A1 && A1.paliers.length === 2 && A1.paliers[1].prix === 8 && A1.histoPrix.length === 2);
  const A2 = arts.find(a => a.designation === 'Fil');
  await p.evaluate((id) => gcFormArticle(id), A2.id); await pause(p, 300);
  await p.fill('#ga-ref', 'FIL-01'); await p.selectOption('#ga-four', F2); await p.fill('#ga-pa', '2'); await p.fill('#ga-pv', '4');
  await p.click('[data-gc="enregistrer-article"]'); await pause(p, 600);
  await p.evaluate(() => nav('gc-catalogue')); await pause(p, 300);
  await p.click('[data-gc="nouvel-article"]'); await pause(p, 300); await p.fill('#ga-ref', 'tis-001'); await p.fill('#ga-des', 'Autre'); await p.fill('#ga-unite', 'm'); await p.click('[data-gc="enregistrer-article"]'); await pause(p, 400);
  verif('Doublon de référence refusé (casse et tirets ignorés)', (await liste('gadh_gc_articles')).length === 2);
  await p.evaluate(() => mgtFermer());
  await p.evaluate(() => nav('gc-tarifs')); await pause(p);
  for(const [prix, min] of [['4.5', '0'], ['4.2', '300']]){
    await p.click('[data-gc="nouveau-tarif"]'); await pause(p, 300);
    await p.selectOption('#gt-art', A1.id); await p.selectOption('#gt-four', F1); await p.fill('#gt-prix', prix); await p.fill('#gt-min', min); await p.fill('#gt-ref', 'TX-' + min);
    await p.click('[data-gc="enregistrer-tarif"]'); await pause(p, 500);
  }
  await p.click('[data-gc="nouveau-tarif"]'); await pause(p, 300); await p.selectOption('#gt-art', A1.id); await p.selectOption('#gt-four', F2); await p.fill('#gt-prix', '4.4'); await p.click('[data-gc="enregistrer-tarif"]'); await pause(p, 500);
  verif('3 tarifs négociés enregistrés', (await liste('gadh_gc_tarifs')).length === 3);
  const cmp = await p.evaluate((id) => GC.comparerFournisseurs(gcD(), id, 350, getTodayISO()).map(c => [c.nom, c.prix, !!c.meilleur]), A1.id);
  verif('Comparaison pour 350 m : Textiles Test 4,20 € (meilleur) puis Accessoires Test 4,40 €', JSON.stringify(cmp) === JSON.stringify([['Textiles Test', 4.2, true], ['Accessoires Test', 4.4, false]]), JSON.stringify(cmp));

  etape(3, 'Import d\'une liste de besoins (CSV)');
  await p.evaluate(() => nav('gc-demandes')); await pause(p);
  await p.click('[data-gc="importer-liste"]'); await pause(p, 300);
  await p.selectOption('#gi-client', 'k1');
  const csv = '﻿Référence;Désignation;Quantité;Unité\nTIS-001;Tissu coton;300;m\nFIL-01;Fil;50;bobine\nXXX-9;Article inconnu;5;u\nTIS-001;Tissu coton;250;m\nFIL-01;Fil;abc;bobine\n';
  await p.setInputFiles('#gi-fichier', {name:'besoins-client.csv', mimeType:'text/csv', buffer:Buffer.from(csv, 'utf8')});
  await p.click('[data-gc="analyser-import"]'); await pause(p, 1200);
  const imp = await p.evaluate(() => gcStatsImport(gcImport.lignes));
  await capture(p, '03-import');
  verif('Colonnes détectées ; 5 lignes : 2 reconnues, 1 inconnue, 1 doublon, 1 quantité en erreur', imp.total === 5 && imp.ok === 2 && imp.inconnu === 1 && imp.doublon === 1 && imp.erreur === 1, JSON.stringify(imp));
  await p.click('[data-gc="regrouper"]'); await pause(p, 500);
  verif('Doublons regroupés : tissu 550 m', await p.evaluate(() => gcImport.lignes.find(l => l.ref === 'TIS-001').qte === 550));
  await p.evaluate(() => { const i = gcImport.lignes.findIndex(l => l.ref === 'XXX-9'); gcImport.lignes[i].ignoree = true; gcImportRecalculer(); nav('gc-import'); }); await pause(p, 300);
  await p.click('[data-gc="enregistrer-demande"]'); await pause(p, 900);
  const dems = await liste('gadh_gc_demandes');
  verif('Demande DP enregistrée avec l\'origine (fichier, en-têtes, lignes brutes)', dems.length === 1 && dems[0].fichier.nom === 'besoins-client.csv' && dems[0].brut.length === 5 && dems[0].entetes[2] === 'Quantité' && /^DP-\d{4}-001$/.test(dems[0].numero));

  etape(4, 'Offre commerciale, versions et comparaison');
  await p.click('[data-gc="creer-offre"]'); await pause(p, 900);
  let offres = await nouveaux('gadh_gc_offres');
  const of = offres[0];
  verif('Offre OF créée sans ressaisie : tissu 550 m au palier 8 €, fil 50 × 4 € → 4 600 € HT', offres.length === 1 && of.lignes.length === 2 && of.lignes.find(l => l.articleId === A1.id).pu === 8 && await p.evaluate((o) => GC.totaux(o).ht, of) === 4600, JSON.stringify(of.lignes.map(l => [l.designation, l.qte, l.pu])));
  await p.click('[data-gc="offre-envoyee"]'); await pause(p, 300); await confirmer(p);
  await p.click('[data-gc="nouvelle-version"]'); await pause(p, 900);
  verif('Nouvelle version : écran de saisie de la v2', await p.evaluate(() => activeTab === 'gc-edition' && gcEdit.doc.version === 2));
  await p.fill('#gel-qte-0', '450'); await p.dispatchEvent('#gel-qte-0', 'change'); await pause(p, 400);
  await capture(p, '04-edition-offre');
  verif('Saisie : 450 m → palier 9 € appliqué automatiquement', await p.evaluate(() => gcEdit.doc.lignes[0].pu === 9));
  await p.click('[data-gc="enregistrer-doc"]'); await pause(p, 800);
  await p.click('[data-gc="comparer-version"]'); await pause(p, 400);
  await capture(p, '04-comparaison');
  verif('Comparaison v1 → v2 : tissu modifié, écart −350 €', /Modifiée/.test(await p.innerText('.modal-sheet')) && /-350,00|−350,00/.test((await p.innerText('.modal-sheet')).replace(/\s/g, '')), (await p.innerText('.modal-sheet')).slice(0, 300));
  await p.evaluate(() => mgtFermer());
  offres = await nouveaux('gadh_gc_offres');
  verif('Version 1 conservée dans l\'historique', offres[0].version === 2 && offres[0].versions.length === 1 && offres[0].versions[0].totaux.ht === 4600);

  etape(5, 'Acceptation de l\'offre');
  await p.click('[data-gc="offre-acceptee"]'); await pause(p, 300); await p.fill('#gc-conf-motif', 'Accord par téléphone'); await confirmer(p);
  offres = await nouveaux('gadh_gc_offres');
  verif('Offre acceptée (date, auteur, motif)', offres[0].statut === 'acceptee' && offres[0].decision.motif === 'Accord par téléphone');

  etape(6, 'Offre → commande client');
  const souhaitee = await p.evaluate(() => GC.ajouterJours(getTodayISO(), 19));
  await p.click('[data-gc="offre-commande"]'); await pause(p, 300); await p.fill('#goc-date', souhaitee); await p.click('[data-gc="valider-commande-offre"]'); await pause(p, 900);
  let cmds = await nouveaux('gadh_gc_cmd_clients');
  const cc = cmds[0];
  await capture(p, '06-commande');
  verif('Commande CC confirmée : tissu 450 × 9, fil 50 × 4 → 4 250 € HT, liée à l\'offre', cmds.length === 1 && cc.statut === 'confirmee' && cc.lignes[0].qte === 450 && cc.lignes[0].pu === 9 && cc.offreId === of.id && await p.evaluate((c) => GC.totaux(c).ht, cc) === 4250);
  verif('Offre liée à sa commande', (await nouveaux('gadh_gc_offres'))[0].commandeId === cc.id);

  etape(7, 'Calcul des besoins nets');
  await p.evaluate(() => nav('gc-besoins')); await pause(p, 600);
  const B = await p.evaluate(() => GC.besoins(gcD(), getTodayISO()).articles.map(a => ({id:a.articleId, m:a.manquant, r:a.reappro, c:a.aCommander, s:a.couvertStock, f:a.fournisseurId, u:a.urgence})));
  const bT = B.find(x => x.id === A1.id), bF = B.find(x => x.id === A2.id);
  verif('Tissu : 450 manquants + 20 (seuil) = 470 à commander chez Textiles Test', bT && bT.m === 450 && bT.r === 20 && bT.c === 470 && bT.f === F1, JSON.stringify(bT));
  verif('Fil : 30 en stock, 20 manquants', bF && bF.s === 30 && bF.m === 20 && bF.c === 20, JSON.stringify(bF));
  await capture(p, '07-besoins');
  verif('Écran des besoins : urgences et dates « commander avant » affichées', /Commander avant le/.test(await p.innerText('#gc-body')));

  etape(8, 'Commandes fournisseurs générées depuis les besoins');
  await p.click('[data-gc="generer-cf"]'); await pause(p, 1000);
  let cfs = await nouveaux('gadh_gc_cmd_fournisseurs');
  const cfT = cfs.find(c => c.fournisseurId === F1), cfF = cfs.find(c => c.fournisseurId === F2);
  verif('2 commandes fournisseurs en brouillon (une par fournisseur), tissu 470 au tarif négocié 4,20 €', cfs.length === 2 && cfT.lignes[0].qte === 470 && cfT.lignes[0].pu === 4.2 && cfF.lignes[0].qte === 20 && cfT.statut === 'brouillon', JSON.stringify(cfs.map(c => [c.numero, c.lignes[0].qte, c.lignes[0].pu])));
  await p.evaluate((id) => gcOuvrir('gc-achat', id), cfT.id); await pause(p);
  await p.click('[data-gc="valider-cf"]'); await pause(p, 600);
  await p.click('[data-gc="envoyer-cf"]'); await pause(p, 600);
  await p.click('[data-gc="confirmer-cf"]'); await pause(p, 300); await p.fill('#gcc-ref', 'CONF-77'); await p.click('[data-gc="valider-confirmation"]'); await pause(p, 600);
  cfs = await nouveaux('gadh_gc_cmd_fournisseurs');
  verif('Validation, envoi, confirmation fournisseur tracés', cfs.find(c => c.id === cfT.id).statut === 'confirmee' && cfs.find(c => c.id === cfT.id).historique.length === 3 && cfs.find(c => c.id === cfT.id).confirmation.reference === 'CONF-77');
  verif('Stock tissu attendu : 470', await p.evaluate((id) => GC.stockArticle(gcD(), id).attente, A1.id) === 470);

  etape(9, 'Réception partielle avec frais');
  await p.click('[data-gc="receptionner"]'); await pause(p, 400);
  await p.fill('.grc-q', '200'); await p.fill('#grc-ref', 'BLF-1');
  await p.fill('.grf-fr .fr-lib', 'Transport'); await p.fill('.grf-fr .fr-mt', '100'); await p.selectOption('.grf-fr .fr-meth', 'quantite');
  await p.click('[data-gc="valider-reception"]'); await pause(p, 1000);
  let recs = await nouveaux('gadh_gc_receptions'); cfs = await nouveaux('gadh_gc_cmd_fournisseurs');
  verif('Bon de réception BR : 200 m, commande « reçue en partie » (non clôturée)', recs.length === 1 && recs[0].lignes[0].qte === 200 && await p.evaluate((id) => GC.statutCmdF(gcD().cmdF.find(c => c.id === id), GC.recus(gcD())).cle, cfT.id) === 'partielle');
  verif('Lot créé : coût réel 4,20 + 0,50 de transport', await p.evaluate((id) => { const l = GC.lots(gcD(), id)[0]; return l.coutUnit === 4.2 && l.fraisUnit === 0.5; }, A1.id));

  etape(10, 'Solde de la réception');
  await p.evaluate((id) => gcOuvrir('gc-achat', id), cfT.id); await pause(p);
  await p.click('[data-gc="receptionner"]'); await pause(p, 400);
  verif('Reste proposé : 270', await p.inputValue('.grc-q') === '270');
  await p.fill('.grc-pu', '4'); await p.fill('.grf-fr .fr-lib', 'Manutention'); await p.fill('.grf-fr .fr-mt', '54'); await p.selectOption('.grf-fr .fr-meth', 'valeur');
  await p.click('[data-gc="valider-reception"]'); await pause(p, 1000);
  verif('Commande fournisseur « reçue »', await p.evaluate((id) => GC.statutCmdF(gcD().cmdF.find(c => c.id === id), GC.recus(gcD())).cle, cfT.id) === 'recue');

  etape(11, 'Lots et stock');
  const L = await p.evaluate((id) => GC.lots(gcD(), id).map(l => [l.qteInit, l.coutUnit, l.fraisUnit, l.reste]), A1.id);
  verif('2 lots FIFO : 200 à 4,70 et 270 à 4,20 (frais compris)', JSON.stringify(L) === JSON.stringify([[200, 4.2, 0.5, 200], [270, 4, 0.2, 270]]), JSON.stringify(L));
  const st = await p.evaluate((id) => GC.stockArticle(gcD(), id), A1.id);
  verif('Stock tissu : physique 470, disponible 470, valeur 2 074 €', st.physique === 470 && st.disponible === 470 && st.valeur === 2074 && st.attente === 0, JSON.stringify(st));
  await p.evaluate(() => nav('gc-lots')); await pause(p);
  await capture(p, '11-lots');
  verif('Écran des lots : valeur restante affichée (tissu 940 + 1 134, fil repris 60 → 2 134 €)', /1\s?134,00/.test(await p.innerText('#gc-body')) && /2\s?134,00/.test(await p.innerText('#gc-body')));

  etape(12, 'Réservation pour le client');
  await p.evaluate((id) => gcOuvrir('gc-commande', id), cc.id); await pause(p);
  await p.click('[data-gc="reserver-tout"]'); await pause(p, 800);
  const res = await p.evaluate(() => GC.reservations(gcD()));
  verif('Réservé : 450 m de tissu et 30 bobines', res[cc.id + '|l1'] === 450 && res[cc.id + '|l2'] === 30, JSON.stringify(res));
  verif('Tissu disponible pour les autres : 20 (le réservé n\'est jamais disponible)', await p.evaluate((id) => GC.stockArticle(gcD(), id).disponible, A1.id) === 20);

  etape(13, 'Livraison partielle');
  await p.click('[data-gc="livrer"]'); await pause(p, 400);
  await p.fill('.gl-q[data-lid="l1"]', '300'); await p.fill('.gl-q[data-lid="l2"]', '30');
  await p.fill('.gl-fr .fr-lib', 'Transport client'); await p.fill('.gl-fr .fr-mt', '60');
  await p.click('[data-gc="valider-livraison"]'); await pause(p, 1000);
  let bls = await nouveaux('gadh_gc_livraisons');
  const bl1 = bls[0];
  await capture(p, '13-livraison');
  verif('BL créé : 300 m (FIFO : 200 du 1er lot + 100 du 2e) et 30 bobines', bls.length === 1 && bl1.lignes[0].allocations.length === 2 && bl1.lignes[0].allocations[0].qte === 200 && bl1.lignes[0].allocations[1].qte === 100 && bl1.lignes[1].qte === 30);
  verif('Commande « livrée en partie » (statut automatique)', await p.evaluate((id) => GC.statutCmdC(gcD().cmdC.find(c => c.id === id), GC.livres(gcD())).cle, cc.id) === 'partielle');
  verif('Réservé restant : 150 m', await p.evaluate((id) => GC.reservations(gcD())[id + '|l1'], cc.id) === 150);

  etape(14, 'Réception du fil puis livraison du solde');
  await p.evaluate((id) => gcOuvrir('gc-achat', id), cfF.id); await pause(p);
  await p.click('[data-gc="valider-cf"]'); await pause(p, 500);
  await p.click('[data-gc="receptionner"]'); await pause(p, 400); await p.fill('.grc-pu', '2.1'); await p.click('[data-gc="valider-reception"]'); await pause(p, 900);
  await p.evaluate((id) => gcOuvrir('gc-commande', id), cc.id); await pause(p);
  await p.click('[data-gc="livrer"]'); await pause(p, 400);
  verif('Quantités proposées : 150 m et 20 bobines (reste à livrer)', await p.inputValue('.gl-q[data-lid="l1"]') === '150' && await p.inputValue('.gl-q[data-lid="l2"]') === '20');
  await p.click('[data-gc="valider-livraison"]'); await pause(p, 1000);
  bls = await nouveaux('gadh_gc_livraisons');
  verif('2e BL enregistré', bls.length === 2);

  etape(15, 'Quantités restantes');
  const rest = await p.evaluate((id) => { const d = gcD(), c = d.cmdC.find(x => x.id === id), liv = GC.livres(d); return {st:GC.statutCmdC(c, liv).cle, l1:liv[id + '|l1'], l2:liv[id + '|l2'], res:GC.reservations(d)[id + '|l1'], stock:GC.stockArticle(d, c.lignes[0].articleId)}; }, cc.id);
  verif('Commande « livrée » : 450/450 et 50/50, réservé soldé', rest.st === 'livree' && rest.l1 === 450 && rest.l2 === 50 && rest.res === 0, JSON.stringify(rest));
  verif('Stock tissu : 20 restants (2e lot), fil : 0', rest.stock.physique === 20 && await p.evaluate((id) => GC.stockArticle(gcD(), id).physique, A2.id) === 0);
  await p.evaluate((id) => gcOuvrir('gc-commande', id), cc.id); await pause(p);
  verif('Fiche commande : statut « Livrée », plus de bouton « Livrer »', /Livrée/.test(await p.innerText('#gc-body')) && await p.locator('[data-gc="livrer"]').count() === 0);

  etape(16, 'Liaison avec la Facturation GADH');
  await p.evaluate(() => nav('gc-livraisons')); await pause(p);
  await p.evaluate(() => { gcD().livraisons.filter(b => !b.migre).forEach(b => { gcSelectionBL[b.id] = true; }); });
  await p.click('[data-gc="facturer-selection"]'); await pause(p, 300); await confirmer(p); await pause(p, 800);
  const facts = (await admin.database().ref('/groupe1/gadh/gadh_factures').once('value')).val(), fl = Object.entries(J(facts) || {}).map(([k, v]) => [k, J(v)]).filter(([, f]) => f && f.origine && f.origine.type === 'livraison');
  const fact = fl.length ? fl[0][1] : null;
  bls = await nouveaux('gadh_gc_livraisons');
  verif('Une facture brouillon dans la Facturation GADH (2 BL, origine « livraison »)', fl.length === 1 && fact.origine.type === 'livraison' && fact.origine.ids.length === 2 && fact.clientId === 'k1' && bls.every(x => x.factureId === fl[0][0]), JSON.stringify(fact && fact.origine));
  verif('Lignes de la facture : 4 250 € HT, sans ressaisie', proche(fact.lignes.reduce((s, l) => s + l.qte * l.pu * (1 - (l.remise || 0) / 100), 0), 4250));
  verif('Statut de facture visible sur les livraisons', /Brouillon/.test(await p.innerText('#gc-body')));
  await p.evaluate((id) => gcOuvrir('gc-livraison', id), bl1.id); await pause(p);
  verif('BL facturé : pas d\'annulation possible (avoir dans la Facturation)', await p.evaluate(() => !/Annuler/.test(Array.from(document.querySelectorAll('.gc-actions button')).map(b => b.innerText).join('|'))));
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('factures'); }); await pause(p, 600);
  verif('Facture présente dans le module Facturation GADH', /Livraisons BL-/.test(await p.innerText('#main')) || /BL-/.test(await p.innerText('#main')));
  await p.evaluate(() => { chooseModule('gadh-commandes'); }); await pause(p, 600);

  etape(17, 'Coûts réels et rentabilité');
  const RT = await p.evaluate(() => GC.rentabilite(gcD(), {}).total);
  verif('Rentabilité réelle : CA 4 250, coût 2 152 (achats FIFO + frais), marge 2 098', RT.ca === 4250 && RT.cout === 2152 && RT.marge === 2098 && RT.provisoire === false, JSON.stringify(RT));
  const R1 = await p.evaluate((id) => GC.coutLivraison(gcD().livraisons.find(b => b.id === id)), bl1.id);
  verif('BL 1 : CA 2 820, achat 1 300, frais 180, marge 1 340 ; taux de marque 47,52 %', R1.ca === 2820 && R1.achat === 1300 && R1.fraisLots + R1.fraisLivraison === 180 && R1.marge === 1340 && R1.tauxMarque === 47.52, JSON.stringify([R1.ca, R1.achat, R1.fraisLots, R1.fraisLivraison, R1.marge, R1.tauxMarque]));
  await p.evaluate(() => { gcFiltresRenta = {vue:'article', du:'', au:'', clientId:'', articleId:'', cmdId:''}; nav('gc-rentabilite'); }); await pause(p);
  await capture(p, '17-rentabilite');
  verif('Écran rentabilité par article : total 4 250 € et marge 2 098 €', /4\s?250,00/.test(await p.innerText('#gc-body')) && /2\s?098,00/.test(await p.innerText('#gc-body')));
  // Frais connus après coup : aucun changement rétroactif
  await p.evaluate(() => { const r = gcD().receptions.find(x => !x.migre); gcEnregistrer('receptions', Object.assign({}, r, {frais:[{id:'x', libelle:'Transport', montant:150, methode:'quantite', statut:'reel'}]})); }); await pause(p, 300);
  verif('Frais de réception modifiés après coup : la rentabilité passée ne change pas', await p.evaluate(() => GC.rentabilite(gcD(), {}).total.cout) === 2152);

  etape(18, 'Tableau de bord');
  await p.evaluate(() => { gcFiltresAccueil = null; nav('gc-accueil'); }); await pause(p, 600);
  const acc = await p.innerText('#gc-body');
  await capture(p, '18-accueil');
  verif('Indicateurs : CA, coûts réels, marge, valeur du stock, besoins', /Chiffre d'affaires livré/.test(acc) && /4\s?250,00/.test(acc) && /Coûts réels/.test(acc) && /Valeur du stock/.test(acc) && /Besoins d'approvisionnement/.test(acc));
  await p.selectOption('#gcf-client', 'k1'); await p.click('text=Appliquer'); await pause(p, 500);
  verif('Filtre client appliqué', await p.evaluate(() => gcFiltresAccueil.clientId === 'k1'));

  etape(19, 'Imports et exports');
  await p.evaluate(() => { gcImportCat = null; nav('gc-import-catalogue'); }); await pause(p);
  const csvCat = 'Référence;Désignation;Unité;Prix achat;Prix vente;Seuil;Fournisseur\nTIS-001;Tissu coton;m;5;11;20;Textiles Test\nBOU-01;Bouton nacre;pièce;0,05;0,2;500;Mercerie Nouvelle\nBAD;;pièce;x;1;;\n';
  await p.setInputFiles('#gc-cat-fichier', {name:'catalogue.csv', mimeType:'text/csv', buffer:Buffer.from(csvCat, 'latin1')}); await pause(p, 800);
  await capture(p, '19-import-catalogue');
  verif('Import catalogue : aperçu (1 mise à jour, 1 création, 1 ligne ignorée)', /1 création\(s\)/.test(await p.innerText('#gc-body')) && /1 mise\(s\) à jour/.test(await p.innerText('#gc-body')), (await p.innerText('#gc-body')).slice(0, 200));
  await p.click('[data-gc="valider-import-catalogue"]'); await pause(p, 900);
  arts = await liste('gadh_gc_articles');
  verif('Catalogue importé : prix de vente mis à jour (historisé), article et fournisseur créés', arts.length === 3 && arts.find(a => a.ref === 'TIS-001').prixVente === 11 && arts.find(a => a.ref === 'TIS-001').histoPrix.some(h => h.source === 'import') && arts.find(a => a.ref === 'BOU-01').prixAchat === 0.05 && (await liste('gadh_gc_fournisseurs')).some(f => f.nom === 'Mercerie Nouvelle'));
  await p.evaluate(() => nav('gc-stock')); await pause(p);
  let dl = p.waitForEvent('download', {timeout:20000}).catch(() => null); await p.click('[data-gc-ex="pdf"]'); let f = await dl;
  verif('État de stock en PDF', !!f && /\.pdf$/.test(f.suggestedFilename()), f && f.suggestedFilename());
  dl = p.waitForEvent('download', {timeout:20000}).catch(() => null); await p.click('[data-gc-ex="xlsx"]'); f = await dl;
  let contenu = f ? fs.readFileSync(await f.path(), 'utf8') : '';
  verif('Export Excel (hors ligne : CSV lisible par Excel) de l\'état de stock', !!f && /\.(xlsx|csv)$/.test(f.suggestedFilename()) && (/\.xlsx$/.test(f.suggestedFilename()) || /Tissu coton/.test(contenu)), f && f.suggestedFilename());
  await p.evaluate((id) => gcOuvrir('gc-livraison', id), bl1.id); await pause(p);
  dl = p.waitForEvent('download', {timeout:20000}).catch(() => null); await p.evaluate((id) => gcDocument('livraison', id, 'pdf'), bl1.id); f = await dl;
  verif('Bon de livraison en PDF', !!f && /bon-de-livraison.*\.pdf$/.test(f.suggestedFilename()), f && f.suggestedFilename());
  const popup = p.waitForEvent('popup', {timeout:8000}).catch(() => null); await p.evaluate((id) => gcDocument('offre', id, 'print'), of.id); const w = await popup;
  verif('Impression de l\'offre (document avec en-tête de la société)', !!w && /OFFRE COMMERCIALE/.test(await w.content()) && /GADH Essai/.test(await w.content()));
  if(w) await w.close();
  for(const [doc, id] of [['commande', cc.id], ['achat', cfT.id], ['reception', (await nouveaux('gadh_gc_receptions'))[0].id]]){
    dl = p.waitForEvent('download', {timeout:20000}).catch(() => null); await p.evaluate(([d, i]) => gcDocument(d, i, 'pdf'), [doc, id]); f = await dl;
    verif('PDF : ' + doc, !!f && /\.pdf$/.test(f.suggestedFilename()), f && f.suggestedFilename());
  }
  await p.evaluate(() => nav('gc-rentabilite')); await pause(p);
  dl = p.waitForEvent('download', {timeout:20000}).catch(() => null); await p.click('[data-gc-ex="pdf"]'); f = await dl;
  verif('État de rentabilité en PDF', !!f && /rentabilite/i.test(f.suggestedFilename()), f && f.suggestedFilename());

  etape(20, 'Droits, hors ligne puis synchronisation');
  // Hors ligne : la secrétaire ajuste le stock, puis la connexion revient.
  await S.ctx.setOffline(true); await pause(p, 1500);
  await p.evaluate((id) => { gcFormAjustement(id); }, A1.id); await pause(p, 300);
  await p.selectOption('#gj-type', 'plus'); await p.fill('#gj-qte', '5'); await p.fill('#gj-motif', 'Trouvé en réserve (hors ligne)');
  await p.click('[data-gc="valider-ajustement"]'); await pause(p, 800);
  const local = await p.evaluate((id) => GC.stockArticle(gcD(), id).physique, A1.id);
  const serveurAvant = (await liste('gadh_gc_mouvements')).filter(m => /hors ligne/.test(m.motif || '')).length;
  verif('Hors ligne : stock mis à jour sur l\'appareil (25), rien encore sur le serveur', local === 25 && serveurAvant === 0, local + ' / ' + serveurAvant);
  await S.ctx.setOffline(false); await pause(p, 8000);
  const serveurApres = (await liste('gadh_gc_mouvements')).filter(m => /hors ligne/.test(m.motif || '')).length;
  verif('Retour en ligne : mouvement synchronisé sur le serveur', serveurApres === 1);
  verif('Journal : opérations tracées (auteur, date)', (await liste('gadh_gc_journal')).filter(j => j.par === C.ROLES.secretaire_gadh.label).length >= 25);
  verif('Secrétaire GADH : aucun refus Firebase, aucune erreur', S.refus.length === 0 && S.erreurs.length === 0, JSON.stringify(S.refus.concat(S.erreurs)).slice(0, 400));
  const ecriture = (pg, cle) => pg.evaluate((c) => new Promise(r => { fbRootRef.child('gadh/' + c + '/essai').set('x').then(() => r(true)).catch(() => r(false)); setTimeout(() => r('délai'), 8000); }), cle);

  // Technico MGT : gestion des commandes complète (12/11/2026), facturation GADH en consultation
  const T = await ouvrir('technico_mgt', true);
  verif('Technico MGT : module proposé dans GADH', await T.p.evaluate(() => modulesDeSociete('gadh').indexOf('gadh-commandes') >= 0));
  await T.p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-commandes'); nav('gc-commandes'); }); await pause(T.p, 800);
  verif('Technico MGT : commandes visibles, bouton « Nouvelle commande »', /CC-/.test(await T.p.innerText('#main')) && await T.p.locator('[data-gc="nouvelle-commande"]').count() > 0);
  await T.p.evaluate((id) => gcOuvrir('gc-commande', id), cc.id); await pause(T.p);
  verif('Technico MGT : écriture acceptée par Firebase (commandes)', await ecriture(T.p, 'gadh_gc_cmd_clients') === true);
  verif('Technico MGT : factures GADH toujours refusées par Firebase', await ecriture(T.p, 'gadh_factures') === false);
  // Responsable GADH : aucun accès
  const RG = await ouvrir('resp_gadh', true);
  verif('Responsable GADH : module non proposé', await RG.p.evaluate(() => modulesDeSociete('gadh').indexOf('gadh-commandes') < 0));
  verif('Responsable GADH : lecture refusée par Firebase', await RG.p.evaluate(() => new Promise(r => { fbRootRef.child('gadh/gadh_gc_cmd_clients').once('value').then(() => r(true)).catch(() => r(false)); setTimeout(() => r('délai'), 8000); })) === false);
  // Direction : lecture seule
  const DI = await ouvrir('direction', true);
  await DI.p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-commandes'); nav('gc-rentabilite'); }); await pause(DI.p, 800);
  await capture(DI.p, '20-direction-rentabilite');
  verif('Direction : rentabilité consultable', /4\s?250,00/.test(await DI.p.innerText('#main')));
  verif('Direction : écriture refusée par Firebase', await ecriture(DI.p, 'gadh_gc_articles') === false);
  // Responsable TEK-TREND : accès complet + tableau de bord GADH
  const RT2 = await ouvrir('responsable', true);
  await RT2.p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-tableau'); }); await pause(RT2.p, 1200);
  await capture(RT2.p, '20-tableau-gadh');
  verif('Tableau de bord GADH : section « Gestion des commandes »', /Gestion des commandes/.test(await RT2.p.innerText('#main')) && /CA livré du mois/.test(await RT2.p.innerText('#main')));
  verif('Responsable : écriture autorisée', await ecriture(RT2.p, 'gadh_gc_journal') === true);
  await admin.database().ref('/groupe1/gadh/gadh_gc_journal/essai').remove();
  verif('Aucune erreur dans les autres sessions', [T, RG, DI, RT2].every(x => x.erreurs.length === 0), JSON.stringify([T, RG, DI, RT2].map(x => x.erreurs)).slice(0, 400));

  await b.close();
  console.log('\n' + ok + '/' + total + ' vérifications');
  if(echecs.length){ console.log('Échecs :\n - ' + echecs.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
