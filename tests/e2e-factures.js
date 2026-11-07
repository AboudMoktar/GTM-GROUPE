#!/usr/bin/env node
// ============================================================
// Facturation TEK-TREND dans la vraie application (émulateurs, règles V2) : saisie des factures PERCKO
// déjà émises (numéro d'origine, quantités, frais, paiement), correction, compteur, contrôles.
// Lancement (dans tests/) : npm run e2e-factures   (serveur web local sur le port 8790)
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const fs = require('fs'), path = require('path'), os = require('os');
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

// Écritures typiques de chaque rôle : [clé, autorisée ?]
const ECRITURES = {
  sysadmin: [['mgt_parametres', true], ['employees', true]],
  responsable: [['prod_2026-11-02', true], ['gadh_employees', true], ['mgt_parametres', false]],
  secretaire_tek: [['employees', true], ['factures', true], ['prod_2026-11-02', false], ['schedule', false]],
  agent_chaine: [['prod_2026-11-02', true], ['fc_2026-11-02', true], ['employees', false], ['factures', false]],
  resp_gadh: [['cmd_saisies_c9', true], ['gadh_employees', false], ['gadh_achat_bons', false], ['gadh_vente_devis', false], ['prod_references', false]],
  secretaire_gadh: [['gadh_employees', true], ['gadh_factures', true], ['gadh_achat_bons', true], ['gadh_vente_livraisons', true], ['cmd_saisies_c9', false]],
  technico_mgt: [['mgt_parametres', true], ['gadh_achat_bons', false], ['gadh_vente_devis', false], ['gadh_factures', false], ['employees', false]],
  secretaire_mgt: [['mgt_crm_clients', true], ['mgt_crm_droits', false], ['mgt_parametres', false], ['employees', false]],
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
  const ouvrir = async (r) => {
    const ctx = await b.newContext({viewport:{width:412, height:900}}); const p = await ctx.newPage();
    const refus = [], erreurs = [];
    p.on('console', m => { const t = m.text(); if(/permission_denied/i.test(t)) refus.push(t.slice(0, 160)); });
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
    await p.waitForTimeout(4000);
    return {ctx, p, refus, erreurs};
  };
  let ok = 0, total = 0; const echecs = [];
  const verif = (lib, cond, detail) => { total++; if(cond) ok++; else echecs.push(lib + (detail ? ' — ' + detail : '')); console.log((cond ? '  ok    ' : '  ÉCHEC ') + lib); };
  const pause = (p, ms) => p.waitForTimeout(ms || 600);
  const T = await ouvrir('secretaire_tek'); const p = T.p;
  await p.evaluate(() => { activeSociete = 'tek'; chooseModule('factures'); nav('fact-liste'); }); await pause(p);
  verif('Facturation TEK-TREND : bouton « Saisir une facture déjà émise »', await p.locator('button', {hasText: 'Saisir une facture déjà émise'}).count() === 1);
  await p.click('button:has-text("Saisir une facture déjà émise")'); await pause(p);
  verif('Écran de saisie : catalogue PERCKO et frais', await p.locator('.fs-art').count() > 20 && await p.locator('.fs-fr').count() >= 3);
  verif('Numéro proposé : FA26/001', await p.inputValue('#fs-num') === 'FA26/001');
  await p.fill('#fs-num', 'FA26/003'); await p.fill('#fs-date', '2026-03-15'); await p.selectOption('#fs-dest', 'NEOLYS'); await p.fill('#fs-objet', 'Expédition PK202602');
  await p.fill('.fs-art[data-i="0"] .fs-q', '100'); await p.fill('.fs-fr[data-j="0"] .fs-q', '1'); await p.fill('#fs-colis', '12');
  await p.check('#fs-paye'); await p.fill('#fs-pdate', '2026-04-10');
  if(process.env.CAPTURES){ const D = process.env.CAPTURES; await p.screenshot({path:D + '/tel.png'}); await p.setViewportSize({width:1366, height:900}); await pause(p, 300); await p.screenshot({path:D + '/pc.png'}); await p.evaluate(() => window.scrollTo(0, 99999)); await p.screenshot({path:D + '/pc2.png'}); await p.setViewportSize({width:412, height:900}); }
  verif('Total calculé à l\'écran (100 × 11,70 + 60 = 1 230 €)', /1\s?230,00 €/.test(await p.locator('#fs-total').textContent()));
  await p.click('button:has-text("Enregistrer et saisir la suivante")'); await pause(p, 900);
  const f1 = await p.evaluate(() => { const l = factListe('tek'), id = Object.keys(l).find(k => l[k].numero === 'FA26/003'), f = l[id]; return f && {f, t:factTotaux(f, l), st:factStatut(f, l)}; });
  verif('Facture FA26/003 enregistrée émise, avec son numéro d\'origine', f1 && f1.f.statut === 'emise' && f1.f.date === '2026-03-15' && f1.f.client && f1.f.client.nom === 'PERCKO' && f1.f.origine.type === 'saisie');
  verif('Lignes et montant (1 230 € HT, TVA 0)', f1 && f1.f.lignes.length === 2 && Math.abs(f1.t.ttc - 1230) < 1e-6 && f1.f.devise === 'EUR', f1 && JSON.stringify(f1.t));
  verif('Paiement repris : facture payée', f1 && f1.st === 'payee' && f1.f.paiements[0].date === '2026-04-10');
  verif('Détails d\'expédition (destination, colis)', f1 && f1.f.percko.destination === 'NEOLYS' && f1.f.percko.colis === '12' && /Neolys/i.test(f1.f.percko.livraison));
  verif('Saisie suivante : numéro suivant proposé, date gardée', await p.inputValue('#fs-num') === 'FA26/004' && await p.inputValue('#fs-date') === '2026-03-15');
  // contrôles
  await p.fill('#fs-num', 'FA26/003'); await p.fill('.fs-art[data-i="1"] .fs-q', '5'); await p.click('button:has-text("Enregistrer et saisir la suivante")'); await pause(p, 400);
  verif('Numéro déjà saisi : refusé', /existe déjà/.test(await p.locator('#toast, .toast').first().textContent()));
  await p.fill('#fs-num', 'FA25/010'); await p.click('button:has-text("Enregistrer et saisir la suivante")'); await pause(p, 400);
  verif('Numéro d\'une autre année que la date : refusé', /ne correspond pas/.test(await p.locator('#toast, .toast').first().textContent()));
  // facture ALLOGA, non payée
  await p.fill('#fs-num', 'FA26/030'); await p.selectOption('#fs-dest', 'ALLOGA'); await p.uncheck('#fs-paye');
  await p.click('button:has-text("✔ Enregistrer")'); await pause(p, 900);
  const f2 = await p.evaluate(() => { const l = factListe('tek'), id = Object.keys(l).find(k => l[k].numero === 'FA26/030'); return id && {id, f:l[id], st:factStatut(l[id], l)}; });
  verif('Facture ALLOGA non payée (prix ALLOGA du catalogue)', f2 && f2.f.percko.destination === 'ALLOGA' && !f2.f.paiements.length && ['impayee', 'retard'].indexOf(f2.st) >= 0 && f2.f.lignes[0].pu === 12.55, f2 && JSON.stringify(f2.f.lignes[0]));
  verif('Compteur : la prochaine facture émise continue après FA26/030', await p.evaluate(() => factNumero('tek', 'facture', '2026') === 'FA26/031'));
  // correction d'une facture saisie
  await p.evaluate((id) => factOuvrir(id), f2.id); await pause(p);
  verif('Facture saisie : bouton « Corriger la saisie »', await p.locator('button', {hasText: 'Corriger la saisie'}).count() === 1);
  await p.click('button:has-text("Corriger la saisie")'); await pause(p);
  await p.fill('.fs-art[data-i="1"] .fs-q', '8'); await p.click('button:has-text("Enregistrer la correction")'); await pause(p, 900);
  const f3 = await p.evaluate((id) => factListe('tek')[id], f2.id);
  verif('Correction enregistrée (même facture, même numéro)', f3 && f3.numero === 'FA26/030' && f3.lignes[0].qte === 8 && await p.evaluate(() => Object.values(factToutes('tek')).filter(f => f.numero === 'FA26/030').length === 1));
  await pause(p, 1500);
  const enBase = await p.evaluate(async () => { const v = (await fbRootRef.child('tek/factures').once('value')).val() || {}; return Object.values(v).map(f => typeof f === 'string' ? JSON.parse(f) : f).map(f => f.numero).sort(); });
  verif('Factures enregistrées dans la base (Firebase)', JSON.stringify(enBase.filter(n => /^FA26\//.test(n))) === JSON.stringify(['FA26/003', 'FA26/030']), JSON.stringify(enBase));
  verif('Aucun refus des règles ni erreur', !T.refus.length && !T.erreurs.length, T.refus.concat(T.erreurs).join(' | '));
  await T.ctx.close(); await b.close();
  console.log(`Factures déjà émises : ${ok}/${total} contrôles conformes`);
  echecs.forEach(e => console.log('  ÉCHEC  ' + e));
  process.exit(echecs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
