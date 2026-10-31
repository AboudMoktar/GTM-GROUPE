#!/usr/bin/env node
// ============================================================
// Tests des fonctions serveur de gestion des comptes (émulateurs Auth,
// Database et Functions). Projet fictif : rien ne touche la vraie base.
// Lancement (dans tests/) : npm run fonctions
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const admin = require('../functions/node_modules/firebase-admin');
const {initializeApp} = require('firebase/app');
const {getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut} = require('firebase/auth');
const {getFunctions, connectFunctionsEmulator, httpsCallable} = require('firebase/functions');
const C = require('../roles-config.js');

const PROJET = 'demo-gtm-groupe', DOM = '@tek-trend.app';
admin.initializeApp({projectId: PROJET, databaseURL: `http://127.0.0.1:9000?ns=${PROJET}`});
const app = initializeApp({projectId: PROJET, apiKey: 'demo-cle', authDomain: 'localhost'});
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
const fns = getFunctions(app, 'europe-west1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const appel = (nom, d) => httpsCallable(fns, nom)(d).then(r => r.data);
const profil = (r, username) => ({nom: C.ROLES[r].label, username, role: C.ROLES[r].role, profil: r, groupe: !!C.ROLES[r].groupe, societes: C.ROLES[r].societes});

let ok = 0, total = 0; const echecs = [];
async function test(lib, fn){ total++; try { await fn(); ok++; } catch(e){ echecs.push(lib + ' → ' + (e && e.message)); } }
const attendreRefus = async (p, code) => { try { await p; } catch(e){ if(!code || String(e.code).indexOf(code) >= 0) return; throw new Error('code ' + e.code); } throw new Error('aurait dû être refusé'); };

(async () => {
  // Comptes de départ : l'administrateur (mokhtar) et une secrétaire.
  const a = await admin.auth().createUser({email: 'mokhtar' + DOM, password: 'Admin2026x'});
  const s = await admin.auth().createUser({email: 'secretaire' + DOM, password: 'Secret2026x'});
  await admin.database().ref('groupe1/users_v2').set({[a.uid]: profil('sysadmin', 'mokhtar'), [s.uid]: profil('secretaire_tek', 'secretaire')});
  await admin.database().ref('groupe1/tek/employees').set({e1: {nom: 'Ben Ali'}});
  let nouveau = null;

  await test('Secrétaire : créer un compte (refusé)', async () => {
    await signInWithEmailAndPassword(auth, 'secretaire' + DOM, 'Secret2026x');
    await attendreRefus(appel('comptesCreer', {username: 'pirate', motDePasse: 'Pirate2026x', nom: 'X', profil: 'sysadmin'}), 'permission-denied');
    await signOut(auth);
  });
  await test('Non connecté : créer un compte (refusé)', async () => {
    await attendreRefus(appel('comptesCreer', {username: 'pirate2', motDePasse: 'Pirate2026x', nom: 'X', profil: 'sysadmin'}), 'unauthenticated');
  });
  await signInWithEmailAndPassword(auth, 'mokhtar' + DOM, 'Admin2026x');
  await test('Admin : créer la Cheftaine', async () => {
    const r = await appel('comptesCreer', {username: 'cheftaine', motDePasse: 'Chef2026x', nom: 'Cheftaine TEK', profil: 'agent_chaine'});
    nouveau = r.uid;
    const p = (await admin.database().ref('groupe1/users_v2/' + nouveau).get()).val();
    if(!p || p.profil !== 'agent_chaine' || p.role !== 'chef_chaine' || p.username !== 'cheftaine') throw new Error('profil incorrect');
    const u = await admin.auth().getUser(nouveau); if(u.email !== 'cheftaine' + DOM) throw new Error('e-mail incorrect');
  });
  await test('Admin : identifiant déjà utilisé (refusé)', async () => {
    await attendreRefus(appel('comptesCreer', {username: 'cheftaine', motDePasse: 'Chef2026x', nom: 'Doublon', profil: 'agent_chaine'}), 'already-exists');
  });
  await test('Admin : mot de passe trop faible (refusé)', async () => {
    await attendreRefus(appel('comptesCreer', {username: 'faible', motDePasse: 'abc', nom: 'Faible', profil: 'agent_chaine'}), 'invalid-argument');
  });
  await test('Admin : rôle inconnu (refusé)', async () => {
    await attendreRefus(appel('comptesCreer', {username: 'inconnu', motDePasse: 'Inconnu2026x', nom: 'X', profil: 'superadmin'}), 'invalid-argument');
  });
  await test('Admin : désactiver la Cheftaine', async () => {
    await appel('comptesActiver', {uid: nouveau, actif: false});
    const u = await admin.auth().getUser(nouveau); if(!u.disabled) throw new Error('Auth non désactivé');
    const d = (await admin.database().ref(`groupe1/users_v2/${nouveau}/desactive`).get()).val(); if(d !== true) throw new Error('champ desactive absent');
  });
  await test('Compte désactivé : connexion impossible', async () => {
    const a2 = getAuth(initializeApp({projectId: PROJET, apiKey: 'demo-cle'}, 'second')); connectAuthEmulator(a2, 'http://127.0.0.1:9099', {disableWarnings: true});
    await attendreRefus(signInWithEmailAndPassword(a2, 'cheftaine' + DOM, 'Chef2026x'), 'user-disabled');
  });
  await test('Admin : réactiver la Cheftaine', async () => {
    await appel('comptesActiver', {uid: nouveau, actif: true});
    const u = await admin.auth().getUser(nouveau); if(u.disabled) throw new Error('toujours désactivé');
  });
  await test('Admin : nouveau mot de passe', async () => {
    await appel('comptesMotDePasse', {uid: nouveau, motDePasse: 'Nouveau2026y'});
    const a3 = getAuth(initializeApp({projectId: PROJET, apiKey: 'demo-cle'}, 'troisieme')); connectAuthEmulator(a3, 'http://127.0.0.1:9099', {disableWarnings: true});
    await signInWithEmailAndPassword(a3, 'cheftaine' + DOM, 'Nouveau2026y');
  });
  await test('Admin : se désactiver lui-même (refusé)', async () => {
    await attendreRefus(appel('comptesActiver', {uid: a.uid, actif: false}), 'failed-precondition');
  });
  await test('Admin : se supprimer lui-même (refusé)', async () => {
    await attendreRefus(appel('comptesSupprimer', {uid: a.uid}), 'failed-precondition');
  });
  await test('Admin : supprimer la Cheftaine, données métier conservées', async () => {
    await appel('comptesSupprimer', {uid: nouveau});
    await attendreRefus(admin.auth().getUser(nouveau));
    if((await admin.database().ref('groupe1/users_v2/' + nouveau).get()).exists()) throw new Error('profil toujours présent');
    if(!(await admin.database().ref('groupe1/tek/employees/e1').get()).exists()) throw new Error('données métier touchées');
  });
  await test('Journal d\'audit : actions enregistrées', async () => {
    const j = (await admin.database().ref('groupe1/audit/j').get()).val() || {};
    const n = Object.values(j).reduce((a, jour) => a + Object.keys(jour).length, 0);
    if(n < 5) throw new Error('seulement ' + n + ' entrées');
  });
  await test('Admin désactivé dans la base : actions refusées', async () => {
    await admin.database().ref(`groupe1/users_v2/${a.uid}/desactive`).set(true);
    await attendreRefus(appel('comptesCreer', {username: 'apres', motDePasse: 'Apres2026x', nom: 'X', profil: 'direction'}), 'permission-denied');
  });

  console.log(`Fonctions serveur : ${ok}/${total} tests conformes`);
  echecs.forEach(e => console.log('  ÉCHEC  ' + e));
  process.exit(echecs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
