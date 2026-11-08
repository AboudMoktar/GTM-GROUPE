#!/usr/bin/env node
// CRM MGT : Listing (catalogue d'articles) dans la base GTM — import depuis le fichier du CRM de l'associé, navigation,
// fiche, historique des prix, corbeille, fusion ; Secrétaire MGT en consultation (données d'essai, émulateur).
// Lancement (dans tests/) : npm run mgt-listing
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const path = require('path'), fs = require('fs');
const TESTS = __dirname, req = require;
const {chromium} = req('playwright'); const admin = require(TESTS + '/admin.js'); const C = require(path.join(__dirname, '..', 'roles-config.js')); const serveur = require(TESTS + '/serveur.js');
const SDK = path.join(TESTS, 'node_modules', 'firebase'), MDP = 'Test2026ok';
const J = (v) => '__gtm_json_v1:' + JSON.stringify(v);
const lire = (v) => typeof v === 'string' && v.startsWith('__gtm_json_v1:') ? JSON.parse(v.slice(14)) : (v && typeof v === 'object' ? Object.keys(v).filter(k => v[k]).map(k => typeof v[k] === 'string' && v[k].startsWith('__gtm_json_v1:') ? JSON.parse(v[k].slice(14)) : v[k]) : []);
(async () => {
  admin.initializeApp({projectId: 'demo-gtm-groupe', databaseURL: 'http://127.0.0.1:9000?ns=demo-gtm-groupe'});
  const u = await admin.auth().createUser({email: 'sysadmin@tek-trend.app', password: MDP}), d = C.ROLES.sysadmin;
  const auj = new Date().toISOString().slice(0, 10);
  const u2 = await admin.auth().createUser({email: 'secmgt@tek-trend.app', password: MDP}), d2 = C.ROLES.secretaire_mgt;
  await admin.database().ref('/groupe1').set({mgt: {mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1})}},
    users_v2: {[u.uid]: {nom: d.label, username: 'sysadmin', role: d.role, profil: 'sysadmin', groupe: true, societes: d.societes},
      [u2.uid]: {nom: d2.label, username: 'secmgt', role: d2.role, profil: 'secretaire_mgt', groupe: !!d2.groupe, societes: d2.societes}}});
  await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-gtm-groupe', {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const s = serveur.demarrer(8790), b = await chromium.launch();
  async function session(login){ const ctx = await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'fr-FR'});
  await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')}); return rt.abort(); });
  const p = await ctx.newPage(); p.on('pageerror', e => err.push(login + ': ' + e.message)); p.on('dialog', x => x.accept());
  await p.goto('http://localhost:8790/index.html'); await p.waitForSelector('#login-user');
  await p.fill('#login-user', login); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
  await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await p.waitForTimeout(2500);
  await p.evaluate(() => { try { kpiAller('mgt', 'mgt'); } catch(e) {} });
  let fr = null; for(let i = 0; i < 200 && !fr; i++){ fr = p.frames().find(f => /mgt-crm-app/.test(f.url())); if(!fr) await p.waitForTimeout(100); }
  await fr.waitForLoadState('load'); await p.waitForTimeout(4000);
  return {p, fr, ctx}; }
  const err = [], r = [], base = async () => (await admin.database().ref('/groupe1/mgt').once('value')).val();
  /* fichier du CRM de l'associé (données d'essai) : Listing intégré comme dans V4.6.8 */
  const cols = ['id','groupe','marque','categorie','famille','sousFamille','reference','referenceBrute','designation','designationBrute','prixCatalogue','remise','prixAchat','prixVente','dateMaj','dateMajPrecision','dateMajBrute','regleCalculExcel','formuleAchatExcel','formuleVenteExcel','ligneExcel','anomalies','remiseFormuleExcel'];
  const L = (id, g, m, c, ref, des, pc, rem, pa, pv, an) => [id, g, m, c, c === 'PIECES' ? 'PIÈCES DE RECHANGE' : 'MACHINE', 'Général', ref, ref, des, des, pc, rem, pa, pv, '2026-02-20', 'jour', '2026-02-20 00:00:00', 'Achat = Catalogue x (1 - Remise) | Vente = Achat x 2', '=G2*0.6', '=I2*2', 2, an || [], null];
  const seed = {meta: {format: 'mgt-listing-seed', version: 1, fichier: 'Listing_essai.xlsx', feuille: 'Catalogue', sha256: 'x', nb: 4}, cols, rows: [
    L('ART-0001', 'MACPI', 'MACPI', 'MACHINES', 'M-100', 'MACHINE ESSAI A', 1000, 0.4, 600, 1200),
    L('ART-0002', 'MORGAN', 'MORGAN', 'PIECES', 'B-75-631', 'ENCODER ESSAI', 200, null, 150, 250),
    L('ART-0003', 'MORGAN', 'MORGAN', 'MACHINES', 'T-9', 'TABLE DE COUPE ESSAI', 5000, null, 3250, 6250, [['REFERENCE_EN_DOUBLE', 'Référence présente deux fois']]),
    L('ART-0004', 'AUTRES', 'LOTUS', 'MACHINES', 'LTS 500', 'PRESSE ESSAI', null, null, 5035, null)]};
  const html = Buffer.from('<!doctype html><html><head><title>CRM</title></head><body><script id="mgt-v468-listing-seed" type="application/json">' + JSON.stringify(seed) + '</script></body></html>');
  // ---------- administrateur ----------
  const A = await session('sysadmin'), fr = A.fr, p = A.p;
  await fr.evaluate(() => openModule('stock')); await p.waitForTimeout(800);
  r.push(['Listing vide : invitation à importer', await fr.locator('#listingModule:not([hidden]) .lsVide').count() === 1 && await fr.locator('#listingModule [data-ls="import"]').count() === 1]);
  await fr.setInputFiles('#lsImportFile', {name: 'CRM_MGT_V4_6_8M.html', mimeType: 'text/html', buffer: html}); await p.waitForTimeout(3000);
  let g = await base();
  const L1 = g.mgt_crm_listing || {};
  r.push(['import : 4 articles dans la base GTM, article par article', Object.keys(L1).length === 4 && String(L1['ART-0001']).startsWith('__gtm_json_v1:')]);
  const a1 = lire(L1['ART-0001']);
  r.push(['forme compacte (prix, ligne Excel, sans formules)', a1.prixAchat === 600 && a1.prixVente === 1200 && a1.xl === 2 && !a1.excel && !a1.historiquePrix && JSON.stringify(a1).length < 600]);
  r.push(['import noté (date, nombre, fichier)', /Listing_essai/.test(String(g.mgt_crm_listing_meta || ''))]);
  r.push(['accueil : fenêtres Morgan / Macpi / Autres avec leurs nombres', /2\s*articles/.test(await fr.locator('.lsCardBtn.b-MORGAN').textContent()) && /1\s*articles?/.test(await fr.locator('.lsCardBtn.b-MACPI').textContent())]);
  await fr.click('.lsCardBtn.b-MORGAN'); await p.waitForTimeout(300);
  await fr.click('[data-ls="list"][data-c="PIECES"]'); await p.waitForTimeout(300);
  r.push(['liste Morgan › Pièces : prix catalogue, achat, vente', await fr.locator('.lsTable tbody tr').count() === 1 && /B-75-631/.test(await fr.locator('.lsTable tbody').textContent()) && /150,00/.test(await fr.locator('.lsTable tbody').textContent())]);
  await fr.click('[data-ls="view"][data-id="ART-0002"]'); await p.waitForTimeout(300);
  r.push(['fiche article : historique avec le prix importé', /Import initial/.test(await fr.locator('#lsDlgBox').textContent()) && /Ligne Excel|ligne 2/i.test(await fr.locator('#lsDlgBox').textContent())]);
  // modification du prix : nouvelle ligne datée
  await fr.click('#lsDlgBox [data-ls="edit"]'); await p.waitForTimeout(300);
  await fr.fill('#lsF_prixVente', '275'); await fr.fill('#lsF_note', 'Nouveau tarif'); await fr.click('#lsDlgBox button[type=submit]'); await p.waitForTimeout(1800);
  const a2 = lire((await base()).mgt_crm_listing['ART-0002']);
  r.push(['prix modifié : historique (prix importé + nouveau prix), journal', a2.prixVente === 275 && a2.historiquePrix.length === 2 && a2.historiquePrix[0].prixVente === 250 && a2.historiquePrix[1].prixVente === 275 && a2.journal.some(j => j.action === 'MODIFICATION')]);
  r.push(['seul l\'article modifié a changé', lire((await base()).mgt_crm_listing['ART-0001']).prixVente === 1200]);
  // corbeille et restauration
  await fr.click('#lsDlgBox [data-ls="close"]').catch(() => {}); await fr.evaluate(() => window.MGT_LISTING_UI.closeDialog());
  await fr.evaluate(async () => { await dm.listingSoftDelete('ART-0003'); }); await p.waitForTimeout(1500);
  r.push(['corbeille : article retiré des listes, gardé dans la base', !!lire((await base()).mgt_crm_listing['ART-0003'])._deleted_at && (await fr.evaluate(async () => (await dm.listingSearch('table')).length)) === 0]);
  await fr.evaluate(async () => { await dm.listingRestore('ART-0003'); }); await p.waitForTimeout(1500);
  r.push(['restauration', !lire((await base()).mgt_crm_listing['ART-0003'])._deleted_at]);
  // recherche
  r.push(['recherche (référence, désignation)', (await fr.evaluate(async () => (await dm.listingSearch('encoder')).map(a => a.id).join()))  === 'ART-0002']);
  // instantané pour une ligne de facture / d'offre
  const snap = await fr.evaluate(async () => dm.listingSnapshot('ART-0002'));
  r.push(['instantané figé (prix de vente en vigueur, prix d\'achat)', snap.prixVente === 275 && snap.prixAchat === 150 && !!snap.prixHistoriqueId]);
  // nouvel article
  const nv = await fr.evaluate(async () => (await dm.listingCreateArticle({groupe:'MORGAN', categorie:'SERVICES', marque:'Morgan', reference:'SRV-1', designation:'Installation', prixVente:'300'})).id);
  await p.waitForTimeout(1500);
  r.push(['nouvel article enregistré', !!(await base()).mgt_crm_listing[nv]]);
  // réimport du même fichier : rien n'est écrasé
  await fr.evaluate(() => { window.MGT_LISTING_UI.open(); }); await p.waitForTimeout(300);
  await fr.setInputFiles('#lsImportFile', {name: 'CRM_MGT_V4_6_8M.html', mimeType: 'text/html', buffer: html}); await p.waitForTimeout(2500);
  r.push(['réimport : aucun article écrasé (prix modifié gardé)', lire((await base()).mgt_crm_listing['ART-0002']).prixVente === 275 && Object.keys((await base()).mgt_crm_listing).length === 5]);
  if(process.env.CAPTURES){ await fr.evaluate(() => { window.MGT_LISTING_UI.open(); }); await p.waitForTimeout(400); await p.screenshot({path: process.env.CAPTURES + '/listing.png'}); await fr.evaluate(() => window.MGT_LISTING_UI.openView('ART-0002')); await p.waitForTimeout(400); await p.screenshot({path: process.env.CAPTURES + '/listing-fiche.png'}); }
  // ---------- Secrétaire MGT : consultation ----------
  const S = await session('secmgt');
  await S.fr.evaluate(() => openModule('stock')); await S.p.waitForTimeout(800);
  r.push(['Secrétaire : Listing lu (5 articles)', (await S.fr.evaluate(async () => (await dm.listingStats()).total)) === 5 && await S.fr.locator('#listingModule:not([hidden]) .lsCardBtn').count() === 3]);
  r.push(['Secrétaire : prix d\'achat visibles', (await S.fr.evaluate(async () => (await dm.listingGetArticle('ART-0001')).prixAchat)) === 600]);
  r.push(['Secrétaire : ni ajout, ni import, ni modification', await S.fr.locator('#listingModule [data-ls="new"]').count() === 0 && await S.fr.locator('#listingModule [data-ls="import"]').count() === 0]);
  await S.fr.evaluate(async () => { try { await dm.listingUpdateArticle('ART-0001', {prixVente: 1}); } catch(e) {} }); await S.p.waitForTimeout(2000);
  r.push(['Secrétaire : écriture refusée par les règles de la base', lire((await base()).mgt_crm_listing['ART-0001']).prixVente === 1200]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
