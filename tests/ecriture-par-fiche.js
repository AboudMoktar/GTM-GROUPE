#!/usr/bin/env node
// ============================================================
// Écriture fiche par fiche des factures (correction C3), dans la vraie application (émulateurs, règles V2) :
// deux postes qui modifient en même temps deux factures différentes gardent tous les deux leur
// modification (avant : le dernier qui enregistrait remplaçait toute la liste) ; une suppression ne
// touche que la facture supprimée ; le format stocké ne change pas ({id: facture}).
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
  base.groupe1.tek.fact_compteurs = {FA: {2026: 4}};
  base.groupe1.tek.factures = {
    fa1: {type: 'facture', numero: 'FA26/004', statut: 'emise', date: '2026-11-02', clientId: 'defaut', lignes: [{designation: 'Essai', qte: 1, pu: 10}], paiements: []}
  };
  await admin.database().ref('/').set(base);
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
    await p.fill('#login-user', 'secretairetek'); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && typeof factToutes === 'function' && Object.keys(factToutes('tek')).length > 0, null, {timeout: 20000});
    await p.waitForTimeout(1500);
    return {p, err};
  };
  const lire = async (ch) => (await admin.database().ref(ch).once('value')).val();
  const A = await ouvrir(), B = await ouvrir();
  // Les deux postes modifient en même temps deux factures différentes, sans s'être vus.
  await Promise.all([
    A.p.evaluate(() => { const l = factToutes('tek'); l.fa1.objet = 'Modifiée sur le poste A'; factEnregistrer('tek', l); }),
    B.p.evaluate(() => { const l = factToutes('tek'); l.nouv = {type: 'facture', numero: '', statut: 'brouillon', date: '2026-11-21', clientId: 'defaut', lignes: [], paiements: [], objet: 'Créée sur le poste B'}; factEnregistrer('tek', l); })
  ]);
  await A.p.waitForTimeout(2500);
  let f = await lire('/groupe1/tek/factures');
  ok(f && f.fa1 && f.fa1.objet === 'Modifiée sur le poste A', 'modification du poste A conservée', f && f.fa1 && f.fa1.objet);
  ok(f && f.nouv && f.nouv.objet === 'Créée sur le poste B', 'facture créée sur le poste B conservée', JSON.stringify(Object.keys(f || {})));
  ok(f && typeof f.fa1 === 'object' && !Array.isArray(f), 'format stocké inchangé ({id: facture})');
  // Les deux postes voient les deux changements
  const vu = async (P) => P.evaluate(() => { const l = factToutes('tek'); return !!(l.nouv && l.fa1 && l.fa1.objet === 'Modifiée sur le poste A'); });
  const vA = await vu(A.p), vB = await vu(B.p);
  ok(vA && vB, 'chaque poste voit les deux changements', 'A:' + vA + ' B:' + vB + ' ' + JSON.stringify(await A.p.evaluate(() => Object.keys(factToutes('tek')))) + JSON.stringify(await B.p.evaluate(() => [Object.keys(factToutes('tek')), factToutes('tek').fa1.objet])));
  // Suppression d'un brouillon sur B pendant qu'A modifie fa1 : chacun ne touche que sa facture
  await Promise.all([
    A.p.evaluate(() => { const l = factToutes('tek'); l.fa1.objet = 'Deuxième modification A'; factEnregistrer('tek', l); }),
    B.p.evaluate(() => { const l = factToutes('tek'); delete l.nouv; factEnregistrer('tek', l); })
  ]);
  await A.p.waitForTimeout(2500);
  f = await lire('/groupe1/tek/factures');
  ok(f && !f.nouv && f.fa1 && f.fa1.objet === 'Deuxième modification A', 'suppression sur B et modification sur A toutes deux appliquées', JSON.stringify(f && Object.keys(f)) + ' ' + (f && f.fa1 && f.fa1.objet));
  ok(!A.err.length && !B.err.length, 'aucune erreur JavaScript', A.err.concat(B.err).join(' / '));
  await b.close(); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
