#!/usr/bin/env node
// ============================================================
// Chargement à la demande (audit D1) : à l'ouverture de l'application, la liste du CRM MGT
// (catalogue, la plus grosse donnée) n'est PAS téléchargée ; elle l'est à l'ouverture du CRM,
// et le reste du dossier MGT (clients, factures…) est bien chargé dès le départ.
// Lancement : dans l'émulateur (voir lancer-tout.js).
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
const COMPTEUR = '/groupe1/tek/fact_compteurs/FA/2026';

let echecs = 0;
function ok(c, m, d){ console.log((c ? 'ok    ' : 'ÉCHEC ') + m + (c || d === undefined ? '' : ' — ' + d)); if(!c) echecs++; }

(async () => {
  const comptes = {};
  for(const r of ['direction']){
    const u = await admin.auth().createUser({email: r.replace(/_/g, '') + DOM, password: MDP});
    const d = C.ROLES[r];
    comptes[u.uid] = {nom: d.label, username: r.replace(/_/g, ''), role: d.role, profil: r, groupe: !!d.groupe, societes: d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  base.groupe1.tek = base.groupe1.tek || {};
  base.groupe1.tek.fact_compteurs = {FA: {2026: 4}};
  base.groupe1.tek.factures = {
    fa1: {type: 'facture', numero: 'FA26/004', statut: 'emise', date: '2026-11-02', clientId: 'defaut', lignes: [{designation: 'Essai', qte: 1, pu: 10}], paiements: []}
  };
  await admin.database().ref('/').set(base);
  await admin.database().ref('/groupe1/mgt').update({
    mgt_crm_listing: {a1: '__gtm_json_v1:' + JSON.stringify({id: 'a1', ref: 'ART-ESSAI', designation: 'Article essai', prix: 12})},
    mgt_crm_listing_meta: '__gtm_json_v1:' + JSON.stringify({maj: '2026-11-22'}),
    mgt_crm_tags: '__gtm_json_v1:' + JSON.stringify(['essai'])
  });
  const regles = fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8');
  const rep = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: regles});
  if(!rep.ok) throw new Error('Règles non chargées : ' + rep.status);

  if(!process.env.GTM_SITE) require('./serveur.js').demarrer(8790);
  const b = await chromium.launch();
  const ouvrir = async () => {
    const ctx = await b.newContext({viewport: {width: 1200, height: 900}}); const p = await ctx.newPage(); const err = [];
    p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
    await p.route(u => { const s = String(u); return !(s.startsWith('http://localhost') || s.startsWith('http://127.0.0.1')); }, rt => {
      const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url());
      if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')});
      return rt.abort();
    });
    await p.route('**/firebase-config.js', rt => rt.fulfill({contentType: 'application/javascript', body: CONFIG}));
    await p.goto(SITE); await p.waitForSelector('#login-user', {timeout: 15000});
    await p.fill('#login-user', 'direction'); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && typeof getJSON === 'function', null, {timeout: 20000});
    await p.waitForTimeout(1500);
    return {p, err};
  };
  const A = await ouvrir(), p = A.p;
  await p.waitForTimeout(2500);
  if(process.env.DBG > 1){ const m = (await admin.database().ref('/groupe1/mgt').once('value')).val() || {}; console.log('SERVEUR', Object.keys(m).join(','), JSON.stringify(m.mgt_crm_tags), JSON.stringify(m.mgt_crm_listing_meta)); }
  if(process.env.DBG > 1) console.log(await p.evaluate(() => JSON.stringify({src: firebaseDossiersLisibles(), dem: firebaseSourcesALaDemande(), cles: Object.keys(memoryCache).filter(k => /mgt/.test(k)), charges: Array.from(hlDossiersCharges)})));
  const avant = await p.evaluate(() => ({liste: getJSON('mgt_crm_listing', null), meta: getJSON('mgt_crm_listing_meta', null), tags: getJSON('mgt_crm_tags', null),
    ecrireListe: typeof hlEcritureAutorisee === 'function' ? hlEcritureAutorisee('mgt_crm_listing') : null, ecrireTags: typeof hlEcritureAutorisee === 'function' ? hlEcritureAutorisee('mgt_crm_tags') : null}));
  ok(avant.liste === null, 'liste du CRM non téléchargée à l\'ouverture', JSON.stringify(avant.liste).slice(0, 80));
  ok(avant.meta !== null && avant.tags !== null, 'reste du dossier MGT chargé dès le départ (avant et après la liste)', JSON.stringify(avant));
  ok(avant.ecrireListe === false && avant.ecrireTags === true, 'écriture de la liste bloquée tant qu\'elle n\'est pas chargée', JSON.stringify(avant));
  await p.evaluate(() => firebaseChargerALaDemande());
  await p.waitForTimeout(2500);
  const apres = await p.evaluate(() => ({liste: getJSON('mgt_crm_listing', null), ecrire: hlEcritureAutorisee('mgt_crm_listing')}));
  ok(apres.liste && JSON.stringify(apres.liste).indexOf('ART-ESSAI') >= 0, 'liste chargée à l\'ouverture du CRM', JSON.stringify(apres.liste).slice(0, 120));
  ok(apres.ecrire === true, 'écriture de la liste autorisée une fois chargée');
  ok(!A.err.length, 'aucune erreur JavaScript', A.err.join(' / '));
  await b.close(); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
