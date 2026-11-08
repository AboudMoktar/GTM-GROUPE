#!/usr/bin/env node
// CRM MGT : Facturation & Lettrage (repris du CRM de l'associé, V4.6.8H à L) — tableau de bord financier (rentabilité
// sur les seules factures complètes), deux espaces, situation de paiement, registre, impression / PDF / Excel internes.
// Lancement (dans tests/) : npm run mgt-facturation
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
    mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1, Factures: [
        {id: 'F1', number: 'FA026-001', date: '2026-03-05', amount: 500, paid: 500, type: 'PIECE', status: 'Payée', lignes: [{id: 'L1', reference: 'B-75-631', designation: 'ENCODER', quantite: 2, prixVente: 250, remise: 0, prixAchat: 150}]},
        {id: 'F2', number: 'FA026-002', date: '2026-04-10', amount: 1000, paid: 400, type: 'MACHINE', status: 'Payée', lignes: [{id: 'L2', reference: 'X', designation: 'MACHINE', quantite: 1, prixVente: 1000, remise: 0, prixAchat: null}]},
        {id: 'F3', number: 'FA025-009', date: '2025-12-01', amount: 300, paid: 0, type: 'AUTRE', status: 'Impayée'}]}),
      '2': J({ID: '2', Societe: 'Autre client', _version: 1, Factures: [{id: 'F4', number: 'FA026-003', date: '2026-04-20', amount: 800, paid: 0, type: 'INTERVENTION', status: 'Impayée'}]})},
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
  await fr.evaluate(() => openModule('billing')); await p.waitForTimeout(1200);
  // deux espaces
  r.push(['deux grandes cartes : Situation de paiement / Registre', await fr.locator('#billingModule .bnSpace').count() === 2 && /3 factures/.test(await fr.locator('#billingModule .bnSpace[data-bn="registre"]').textContent())]);
  r.push(['montants en euros (2 décimales)', /1[\s\u00a0\u202f]400,00[\s\u00a0\u202f]€/.test(await fr.locator('#billingModule .bnSpace[data-bn="situation"]').textContent())]);
  r.push(['filtre d\'année : 2025 ajouté automatiquement', await fr.locator('#billingYear option[value="2025"]').count() === 1]);
  // tableau de bord financier : rentabilité sur les seules factures complètes
  const fin = await fr.evaluate(() => { const r = MGT_FINANCE.compute('2026'); return [r.total, r.ok.n, r.ok.marge, r.inc.n, r.na.n]; });
  r.push(['rentabilité : seulement les factures complètes (1 complète, 1 incomplète, 1 sans lignes)', JSON.stringify(fin) === JSON.stringify([2300, 1, 200, 1, 1])]);
  r.push(['carte Bénéfice dans les statistiques', await fr.locator('#billProfitStat').count() === 1]);
  // situation de paiement
  const sit = await fr.evaluate(() => { const c = MGT_SITUATION.compute(); return [c.rows.length, c.T.billed, c.T.paid, c.T.solde]; });
  r.push(['situation : clients facturés, total, encaissé, solde restant', JSON.stringify(sit) === JSON.stringify([2, 2300, 900, 1400])]);
  r.push(['situation affichée', await fr.locator('#sitHost').count() === 1 && /Solde/.test(await fr.locator('#sitHost').textContent())]);
  // registre
  await fr.click('#billingModule .bnSpace[data-bn="registre"]'); await p.waitForTimeout(500);
  const reg = await fr.evaluate(() => { const c = MGT_REGISTER.compute(); return [c.list.map(x => x.f.number).join(','), c.T.alerts]; });
  r.push(['registre : date décroissante, alerte « Payée » avec solde', reg[0] === 'FA026-003,FA026-002,FA026-001' && reg[1] === 1]);
  r.push(['registre affiché avec bénéfice et alerte', /Incomplète/.test(await fr.locator('#billingRegisterView').textContent()) && await fr.locator('#billingRegisterView .rgAlert').count() >= 1]);
  // exports internes
  const dl = async (sel) => { const [d] = await Promise.all([p.waitForEvent('download', {timeout: 15000}).catch(() => null), fr.locator(sel).first().click()]); return d ? d.suggestedFilename() : null; };
  const nx = await dl('#billingRegisterView .exBar [data-ex="xlsx"]');
  r.push(['Excel du registre (document interne)', /^INTERNE_Registre_factures_2026_.*\.xlsx$/.test(nx || '')]);
  const np = await dl('#billingRegisterView .exBar [data-ex="pdf"]');
  r.push(['PDF du registre (moteur PDF chargé à la demande)', /^INTERNE_Registre_factures_2026_.*\.pdf$/.test(np || '') && await fr.evaluate(() => !!(window.jspdf && window.jspdf.jsPDF))]);
  const [pop] = await Promise.all([p.waitForEvent('popup', {timeout: 10000}).catch(() => null), fr.locator('#billingRegisterView .exBar [data-ex="print"]').first().click()]);
  r.push(['impression : document « interne » A4 paysage', !!pop && /interne/i.test(await pop.content())]);
  if(pop) await pop.close();
  if(process.env.CAPTURES){ await p.screenshot({path: process.env.CAPTURES + '/registre.png'}); await fr.click('#billingModule .bnSpace[data-bn="situation"]'); await p.waitForTimeout(500); await p.screenshot({path: process.env.CAPTURES + '/situation.png'}); }
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
