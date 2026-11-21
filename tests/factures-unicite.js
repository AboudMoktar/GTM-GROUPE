#!/usr/bin/env node
// ============================================================
// Factures : unicité des numéros (correction C2), dans la vraie application (émulateurs, règles V2).
//  - chaque numéro attribué est réservé sur le compteur du serveur (transaction) ;
//  - un compteur plus ancien envoyé par un autre poste ne fait pas reculer le serveur ;
//  - deux factures avec le même numéro : la plus ancienne garde le sien, l'autre reçoit le suivant,
//    la correction est notée dans la facture ;
//  - deux postes qui numérotent en même temps finissent avec des numéros tous différents.
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
  for(const r of ['secretaire_tek']){
    const u = await admin.auth().createUser({email: r.replace(/_/g, '') + DOM, password: MDP});
    const d = C.ROLES[r];
    comptes[u.uid] = {nom: d.label, username: r.replace(/_/g, ''), role: d.role, profil: r, groupe: !!d.groupe, societes: d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  base.groupe1.tek = base.groupe1.tek || {};
  base.groupe1.tek.fact_compteurs = {FA: {2026: 30}};
  base.groupe1.tek.factures = {
    fa1: {type: 'facture', numero: 'FA26/030', statut: 'emise', date: '2026-11-02', clientId: 'defaut', lignes: [{designation: 'Essai', qte: 1, pu: 10}], paiements: []}
  };
  await admin.database().ref('/').set(base);
  const regles = fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8');
  const rep = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: regles});
  if(!rep.ok) throw new Error('Règles non chargées : ' + rep.status);

  if(!process.env.GTM_SITE ) require('./serveur.js').demarrer(8790);
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
    await p.fill('#login-user', 'secretairetek'); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && typeof factToutes === 'function' && Object.keys(factToutes('tek')).length > 0, null, {timeout: 20000});
    await p.waitForTimeout(1500);
    return {p, err};
  };
  const lire = async (ch) => (await admin.database().ref(ch).once('value')).val();
  const A = await ouvrir(), p = A.p;

  // 1) Numéro attribué = réservé sur le serveur
  const n1 = await p.evaluate(() => factNumero('tek', 'facture', '2026'));
  await p.waitForTimeout(1500);
  ok(n1 === 'FA26/031', 'numéro suivant attribué (' + n1 + ')');
  ok(await lire(COMPTEUR) === 31, 'compteur du serveur réservé à 31', await lire(COMPTEUR));

  // 2) Un autre poste renvoie un compteur ancien (30) : le compteur remonte au numéro réservé suivant
  await admin.database().ref(COMPTEUR).set(30);
  await p.waitForTimeout(1200);
  const n2 = await p.evaluate(() => factNumero('tek', 'facture', '2026'));
  await p.waitForTimeout(1500);
  ok(n2 === 'FA26/032', 'pas de numéro redonné malgré le compteur ancien (' + n2 + ')');
  ok(await lire(COMPTEUR) === 32, 'compteur du serveur à 32', await lire(COMPTEUR));

  // 3) Doublon : deux factures validées portent FA26/030 → la plus récente est renumérotée (automatiquement)
  await admin.database().ref('/groupe1/tek/factures/fz9').set({type: 'facture', numero: 'FA26/030', statut: 'emise', date: '2026-11-20', clientId: 'defaut', lignes: [{designation: 'Doublon', qte: 1, pu: 5}], paiements: [], creeLe: '2099-01-01T00:00:00Z'});
  await p.waitForTimeout(1500);
  await p.evaluate(() => factVerifierDoublons('tek'));   // déjà fait automatiquement si un contrôle est passé entre-temps
  await p.waitForTimeout(2000);
  const fz = await lire('/groupe1/tek/factures/fz9'), f1 = await lire('/groupe1/tek/factures/fa1');
  ok(f1.numero === 'FA26/030', 'la facture la plus ancienne garde FA26/030', f1.numero);
  ok(/^FA26\/\d{3}$/.test(fz.numero) && fz.numero !== 'FA26/030' && fz.numero !== n1 && fz.numero !== n2, 'la plus récente reçoit un numéro libre (' + (fz && fz.numero) + ')');
  ok(Array.isArray(fz.corrections) && /double/.test(fz.corrections[0].motif), 'correction notée dans la facture');

  // 4) Deux postes numérotent en même temps → numéros tous différents après contrôle
  const B = await ouvrir();
  const [xa, xb] = await Promise.all([
    p.evaluate(() => { const l = factToutes('tek'), id = 'pa' + Date.now(); l[id] = {type: 'facture', statut: 'emise', date: '2026-11-21', clientId: 'defaut', lignes: [], paiements: [], numero: factNumero('tek', 'facture', '2026')}; factEnregistrer('tek', l); return l[id].numero; }),
    B.p.evaluate(() => { const l = factToutes('tek'), id = 'pb' + Date.now(); l[id] = {type: 'facture', statut: 'emise', date: '2026-11-21', clientId: 'defaut', lignes: [], paiements: [], numero: factNumero('tek', 'facture', '2026')}; factEnregistrer('tek', l); return l[id].numero; })
  ]);
  await p.waitForTimeout(3000);
  await p.evaluate(() => factVerifierDoublons('tek')); await B.p.evaluate(() => factVerifierDoublons('tek'));
  await p.waitForTimeout(3000);
  const toutes = Object.values(await lire('/groupe1/tek/factures') || {}).map(f => f.numero).filter(Boolean);
  ok(toutes.length === 4, 'les 4 factures sont présentes (aucune perdue, voir C3)', toutes.length);
  ok(new Set(toutes).size === toutes.length, `numéros tous différents après numérotation simultanée (${xa}, ${xb} → ${toutes.sort().join(', ')})`);
  ok(!A.err.length && !B.err.length, 'aucune erreur JavaScript', A.err.concat(B.err).join(' / '));
  await b.close(); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
