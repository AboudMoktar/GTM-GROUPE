#!/usr/bin/env node
// ============================================================
// Test de bout en bout : la vraie application, connectée aux émulateurs
// (Auth + Database avec les règles V2), un compte par rôle.
// Lancement (dans tests/) : npm run e2e   (serveur web local sur le port 8790)
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const fs = require('fs'), path = require('path');
const admin = require('../functions/node_modules/firebase-admin');
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

// Écritures typiques de chaque rôle : [clé, autorisée ?]
const ECRITURES = {
  sysadmin: [['mgt_parametres', true], ['employees', true]],
  responsable: [['prod_2026-11-02', true], ['gadh_employees', true], ['mgt_parametres', false]],
  secretaire_tek: [['employees', true], ['factures', true], ['prod_2026-11-02', false], ['schedule', false]],
  agent_chaine: [['prod_2026-11-02', true], ['fc_2026-11-02', true], ['employees', false], ['factures', false]],
  resp_gadh: [['cmd_saisies_c9', true], ['gadh_employees', false], ['prod_references', false]],
  secretaire_gadh: [['gadh_employees', true], ['gadh_factures', true], ['cmd_saisies_c9', false]],
  technico_mgt: [['mgt_parametres', true], ['employees', false]],
  secretaire_mgt: [['mgt_parametres', false]],
  direction: [['prod_2026-11-02', false], ['gadh_employees', false], ['mgt_parametres', false]]
};

(async () => {
  const comptes = {};
  for(const r of C.ORDRE){
    const u = await admin.auth().createUser({email: r.replace(/_/g, '') + DOM, password: MDP});
    const d = C.ROLES[r];
    comptes[u.uid] = {nom: d.label, username: r.replace(/_/g, ''), role: d.role, profil: r, groupe: !!d.groupe, societes: d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  await admin.database().ref('/').set(base);
  // Règles V2 appliquées à la base utilisée par l'application (même espace de noms).
  const regles = fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8');
  const rep = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: regles});
  if(!rep.ok) throw new Error('Règles non chargées : ' + rep.status + ' ' + await rep.text());

  const b = await chromium.launch();
  let ok = 0, total = 0; const echecs = [];
  for(const r of C.ORDRE){
    const ctx = await b.newContext(); const p = await ctx.newPage();
    const refus = [], erreurs = [];
    p.on('console', m => { const t = m.text(); if(/permission_denied/i.test(t)) refus.push(t.slice(0, 160)); });
    p.on('pageerror', e => erreurs.push(e.message));
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
    await p.waitForTimeout(4000);
    const etat = await p.evaluate(() => ({
      connecte: !!currentUser, profil: currentUser && currentUser.profil,
      sources: typeof firebaseDossiersLisibles === 'function' ? firebaseDossiersLisibles() : [],
      chargees: Array.from(typeof hlDossiersCharges !== 'undefined' ? hlDossiersCharges : []),
      ecran: (document.querySelector('h2') || {}).textContent || ''
    }));
    total++;
    const manquantes = etat.sources.filter(s => etat.chargees.indexOf(s) < 0);
    if(etat.connecte && !refus.length && !erreurs.length && !manquantes.length) ok++;
    else echecs.push(`${r} : connexion/chargement — connecté=${etat.connecte}, refus=${refus.length}${refus[0] ? ' (' + refus[0] + ')' : ''}, erreurs=${erreurs.join(' | ')}, non chargées=${manquantes.join(',')}`);
    for(const [cle, attendu] of (ECRITURES[r] || [])){
      total++;
      const chemin = await p.evaluate((cle) => firebaseCheminDe(cle), cle);
      const res = await p.evaluate(async ([chemin, cle]) => {
        try { await fbRootRef.child(chemin).set({test: cle, t: Date.now()}); return true; } catch(e) { return false; }
      }, [chemin, cle]);
      if(res === attendu) ok++; else echecs.push(`${r} : écriture ${cle} → ${res ? 'autorisée' : 'refusée'}, attendu ${attendu ? 'autorisée' : 'refusée'}`);
    }
    console.log(`${r.padEnd(16)} écran « ${etat.ecran.trim().slice(0, 40)} » · ${etat.sources.length} source(s) de données chargée(s)`);
    await ctx.close();
  }
  await b.close();
  console.log(`Bout en bout (application + émulateurs) : ${ok}/${total} contrôles conformes`);
  echecs.forEach(e => console.log('  ÉCHEC  ' + e));
  process.exit(echecs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
