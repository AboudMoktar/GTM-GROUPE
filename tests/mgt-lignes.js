#!/usr/bin/env node
// CRM MGT : lignes d'articles (Listing) dans les factures et les offres, marges internes, document client sans prix d'achat,
// conversion offre -> facture sans doublon (repris du CRM de l'associé, V4.6.8C/D/E ; données d'essai, émulateur).
// Lancement (dans tests/) : npm run mgt-lignes
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
  const u2 = {uid: 'x'}, d2 = C.ROLES.secretaire_mgt;
  const art = (o) => J(Object.assign({sousFamille: 'Général', famille: 'MACHINE', dateMaj: '2026-02-20', _created_at: '2026-11-01T00:00:00Z', _updated_at: '2026-11-01T00:00:00Z'}, o));
  await admin.database().ref('/groupe1').set({mgt: {
    mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1, Factures: [{id: 'F-OLD', number: 'FA026-001', date: '2026-03-01', amount: 500, paid: 0, type: 'PIECE', status: 'Impayée', note: ''}],
      Offres: [{offerId: 'OF-1', type: 'machine', marque: 'MACPI', sentDate: '2026-11-01', amount: '', devise: 'EUR', status: 'En attente', commercial: 'Ali'}]}),
      '2': J({ID: '2', Societe: 'Autre client', _version: 1})},
    mgt_crm_listing: {'ART-0001': art({id: 'ART-0001', groupe: 'MACPI', marque: 'MACPI', categorie: 'MACHINES', reference: 'M-100', designation: 'MACHINE ESSAI A', prixCatalogue: 1000, remise: 0.4, prixAchat: 600, prixVente: 1200}),
      'ART-0002': art({id: 'ART-0002', groupe: 'MORGAN', marque: 'MORGAN', categorie: 'PIECES', reference: 'B-75-631', designation: 'ENCODER ESSAI', prixCatalogue: 200, prixAchat: 150, prixVente: 250})}},
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
  const A = await session('sysadmin'), fr = A.fr, p = A.p;
  const cli = async (id) => lire((await base()).mgt_crm_clients).find(x => String(x.ID) === id);
  // ---------- facture avec lignes ----------
  await fr.evaluate(() => openModule('billing')); await p.waitForTimeout(800);
  await fr.click('#billingAddBtn'); await p.waitForTimeout(400);
  r.push(['fenêtre de facture : bloc Articles (recherche dans le Listing)', await fr.locator('#billingModal:not([hidden]) #billLinesBox.lnEditor').count() === 1]);
  await fr.selectOption('#billClient', '1'); await fr.fill('#billNumber', 'FA026-010'); await fr.fill('#billDate', '2026-11-08');
  await fr.fill('#billLnSearch', 'encoder'); await p.waitForTimeout(600);
  r.push(['recherche : article proposé avec son prix', /B-75-631/.test(await fr.locator('#billLnResults').textContent())]);
  await fr.click('#billLnResults [data-ln="pick"]'); await p.waitForTimeout(300);
  await fr.fill('#billLinesBox tr[data-i="0"] [data-f="quantite"]', '2'); await p.waitForTimeout(200);
  r.push(['montant calculé (total HT des lignes) et marge affichée', await fr.inputValue('#billAmount') === '400' && /100,00/.test(await fr.locator('#billLinesBox .lnTotals').textContent())]);
  /* V4.6.9H : prix de vente standard = prix catalogue (ENCODER 250 → 200) */
  r.push(['nouvelle ligne : prix standard = prix catalogue', await fr.inputValue('#billLinesBox tr[data-i="0"] [data-f="prixVente"]') === '200']);
  await fr.click('#billingForm button[type=submit]'); await p.waitForTimeout(2000);
  let c1 = await cli('1'), f = c1.Factures.find(x => x.number === 'FA026-010');
  r.push(['fenêtre fermée après l\'enregistrement', await fr.evaluate(() => document.getElementById('billingModal').hidden)]);
  r.push(['facture enregistrée avec ses lignes figées (prix d\'achat, marge)', !!f && f.amount === 400 && f.lignes.length === 1 && f.lignes[0].prixAchat === 150 && f.lignes[0].articleId === 'ART-0002' && f.totaux.marge === 100 && f.montantSource === 'LIGNES']);
  r.push(['historique de la facture', Array.isArray(f.historique) && f.historique[0].action === 'CREATION']);
  // facture ancienne sans lignes : ajout du détail, montant d'origine gardé
  await fr.evaluate(() => editBillingInvoice('1', 'F-OLD')); await p.waitForTimeout(500);
  await fr.fill('#billLnSearch', 'machine essai'); await p.waitForTimeout(600); await fr.click('#billLnResults [data-ln="pick"]'); await p.waitForTimeout(300);
  await fr.click('#billingForm button[type=submit]'); await p.waitForTimeout(2000);
  c1 = await cli('1'); f = c1.Factures.find(x => x.id === 'F-OLD');
  r.push(['facture sans détail : lignes ajoutées, montant d\'origine conservé', f.amount === 1000 && f.montantSaisiOrigine === 500 && f.lignes.length === 1]);
  // document client : sans prix d'achat ni marge
  const doc = await fr.evaluate(() => MGT_LINES.clientDocumentHtml({titre: 'Facture', numero: 'X', date: '2026-11-08', client: 'Client Essai', lignes: [{reference: 'B-75-631', designation: 'ENCODER', quantite: 2, prixVente: 250, remise: 0, prixAchat: 150}]}));
  r.push(['document client : sans prix d\'achat ni marge', /500,00/.test(doc) && !/150,00/.test(doc) && !/[Mm]arge/.test(doc)]);
  // ---------- offre avec lignes ----------
  await fr.evaluate(() => openModule('offres')); await p.waitForTimeout(800);
  await fr.evaluate(() => openOffreEdit('1', 0)); await p.waitForTimeout(500);
  r.push(['« Modifier l\'offre » : bloc Articles', await fr.locator('#offreEditModal:not([hidden]) #offreLinesBox.lnEditor').count() === 1]);
  await fr.fill('#offLnSearch', 'M-100'); await p.waitForTimeout(600); await fr.click('#offLnResults [data-ln="pick"]'); await p.waitForTimeout(300);
  await fr.fill('#offreLinesBox tr[data-i="0"] [data-f="prixVente"]', '1100'); await fr.fill('#offreLinesBox tr[data-i="0"] [data-f="remise"]', '10'); await p.waitForTimeout(200);
  await fr.click('#offreEditSaveBtn'); await p.waitForTimeout(2500);
  c1 = await cli('1'); let o = c1.Offres.find(x => x.offerId === 'OF-1');
  r.push(['offre enregistrée avec ses lignes (prix négocié, remise), montant = total HT', !!o && o.lignes && o.lignes.length === 1 && o.lignes[0].prixVente === 1100 && o.lignes[0].remise === 10 && Number(o.amount) === 990 && o.totaux.marge === 390]);
  r.push(['offre : autres champs conservés', o.marque === 'MACPI' && o.commercial === 'Ali']);
  // ---------- conversion offre -> facture ----------
  await fr.evaluate(() => { openModule('offres'); }); await p.waitForTimeout(1200);
  await fr.locator('#offresModule', {hasText: 'Offres Macpi'}).getByText('Offres Macpi').click(); await p.waitForTimeout(800);
  const bt = fr.locator('[data-conv-open="1|0"]');
  r.push(['carte d\'offre : bouton « Convertir en facture »', await bt.count() === 1]);
  await bt.click(); await p.waitForTimeout(400);
  r.push(['fenêtre de conversion : numéro proposé, prix de l\'offre', /FA026-011/.test(await fr.inputValue('#mgtConvNumber')) && /990,00/.test(await fr.locator('#mgtConvBody').textContent())]);
  await fr.fill('#mgtConvNumber', 'FA026-010'); await fr.click('#mgtConvDoBtn'); await p.waitForTimeout(800);
  r.push(['numéro déjà utilisé : refusé', /déjà utilisé/.test(await fr.locator('#mgtConvErr').textContent())]);
  await fr.fill('#mgtConvNumber', 'FA026-011'); await fr.click('#mgtConvDoBtn'); await p.waitForTimeout(2500);
  c1 = await cli('1'); o = c1.Offres.find(x => x.offerId === 'OF-1'); f = c1.Factures.find(x => x.number === 'FA026-011');
  r.push(['facture créée depuis l\'offre (lignes et prix de l\'offre), offre liée', !!f && f.amount === 990 && f.lignes[0].prixVente === 1100 && f.offreOrigine.offerId === 'OF-1' && o.factureId === f.id && o.invoiceRef === 'FA026-011']);
  await fr.evaluate(() => { try { renderOffresModule(); } catch(e) {} }); await p.waitForTimeout(600);
  r.push(['offre convertie : « Facturée », plus de bouton de conversion (pas de doublon)', await fr.locator('[data-conv-open="1|0"]').count() === 0 && await fr.locator('.mgtConvLinked', {hasText: 'FA026-011'}).count() >= 1]);
  const n0 = (await cli('1')).Factures.length;
  await fr.evaluate(() => { window.confirm = () => false; window.MGT_CONVERSION.open('1', 0); }); await p.waitForTimeout(800);
  r.push(['nouvelle conversion de la même offre refusée', (await cli('1')).Factures.length === n0 && await fr.evaluate(() => document.getElementById('mgtConvertModal').hidden)]);
  if(process.env.CAPTURES){ await p.screenshot({path: process.env.CAPTURES + '/offres.png'}); await fr.evaluate(() => editBillingInvoice('1', 'F-OLD')); await p.waitForTimeout(500); await p.screenshot({path: process.env.CAPTURES + '/facture.png'}); }
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
