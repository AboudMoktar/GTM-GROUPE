#!/usr/bin/env node
// ============================================================
// Parcours des ventes GADH dans la vraie application (émulateurs, règles V2) :
// devis → commande → livraison (sortie de stock) → facture, puis consultation par le Technico MGT.
// Lancement (dans tests/) : npm run e2e-ventes   (serveur web local sur le port 8790)
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const fs = require('fs'), path = require('path'), os = require('os');
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
  // Données réelles si une sauvegarde est fournie (GTM_SAUVEGARDE=chemin du fichier JSON), sinon données d'essai.
  const svf = process.env.GTM_SAUVEGARDE;
  if(svf && fs.existsSync(svf)){ const sv = JSON.parse(fs.readFileSync(svf, 'utf8')), g1 = sv.groupe1 || sv; base.groupe1.tek = g1.tek; base.groupe1.liaison = g1.liaison; }
  await admin.database().ref('/').set(base);
  // Règles V2 appliquées à la base utilisée par l'application (même espace de noms).
  const regles = fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8');
  const rep = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: regles});
  if(!rep.ok) throw new Error('Règles non chargées : ' + rep.status + ' ' + await rep.text());


  const b = await chromium.launch();
  const ouvrir = async (r) => {
    const ctx = await b.newContext({viewport:{width:412, height:900}, serviceWorkers:'block', acceptDownloads:true}); const p = await ctx.newPage();
    const refus = [], erreurs = [];
    p.on('console', m => { const t = m.text(); if(/permission_denied/i.test(t)) refus.push(t.slice(0, 160)); });
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.addInitScript(() => { try { delete window.showSaveFilePicker; } catch(e) {} window.showSaveFilePicker = undefined; });
    await p.route(u => { const s = String(u); return !(s.startsWith('http://localhost') || s.startsWith('http://127.0.0.1')); }, rt => {
      // Excel : copie locale si présente (npm install --no-save xlsx@0.18.5), sinon chargement normal depuis cdnjs.
      const XLSX_LOCAL = path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');
      if(/xlsx\.full\.min\.js$/.test(rt.request().url())) return fs.existsSync(XLSX_LOCAL) ? rt.fulfill({contentType:'application/javascript', body:fs.readFileSync(XLSX_LOCAL, 'utf8')}) : rt.continue();
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


  const A = await ouvrir('sysadmin'); const p = A.p; let ok = 0, total = 0; const echecs = [];
  const verif = (lib, c, d) => { total++; if(c) ok++; else echecs.push(lib + (d ? ' — ' + d : '')); console.log((c ? '  ok    ' : '  ÉCHEC ') + lib); };
  await p.evaluate(() => { window.__html = []; window.open = () => ({document:{open(){}, write(x){ window.__html.push(x); }, close(){}}}); });
  const essais = [['TEK période (statistiques)', "rpTekPeriode", "'2026-09-01', '2026-11-01'"], ['TEK jour (historique)', "rpTekJour", "'2026-10-29'"], ['GADH période (statistiques)', "rpGadhPeriode", "'2026-10-01', '2026-11-01'"], ['GADH jour (historique)', "rpGadhJour", "'2026-10-30'"]];
  for(const [lib, fn, args] of essais){
    const dl = p.waitForEvent('download', {timeout:15000}).catch(() => null);
    await p.evaluate(`${fn}Excel(${args})`); const d = await dl;
    if(!d) console.log('diag', await p.evaluate(() => ({xlsx: typeof XLSX, toast: (document.querySelector('.toast, #toast') || {}).textContent})));
    let taille = 0; if(d){ const f = path.join(os.tmpdir(), d.suggestedFilename()); await d.saveAs(f); taille = fs.statSync(f).size; }
    verif(lib + ' : fichier Excel ' + (d ? d.suggestedFilename() : '—'), d && taille > 3000, 'taille ' + taille);
    await p.evaluate(`${fn}Pdf(${args})`);
    const html = await p.evaluate(() => window.__html.pop());
    const v = await A.ctx.newPage(); await v.setContent(html.replace(/<script>[\s\S]*?<\/script>/, ''), {waitUntil:'load'});
    const pdf = await v.pdf({preferCSSPageSize:true}); const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const nom = path.join(os.tmpdir(), 'fiche-' + fn + '.pdf'); fs.writeFileSync(nom, pdf); await v.close();
    verif(lib + ' : PDF de ' + pages + ' page(s)', pages >= 1 && pages <= 2, 'pages ' + pages);
  }
  // boutons présents à l'écran
  await p.evaluate(() => { kpiAller('tek', 'rendement', 'stats'); }); await p.waitForTimeout(600);
  verif('Statistiques TEK : boutons Excel et PDF', await p.evaluate(() => /Fiche de cet écran/.test(document.getElementById('main').innerText)));
  await p.evaluate(() => { histViewMode = 'jour'; nav('historique'); }); await p.waitForTimeout(600);
  verif('Historique TEK : boutons Excel et PDF', await p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /rpTekJourPdf/.test(b.getAttribute('onclick') || ''))));
  await p.evaluate(() => { kpiAller('gadh', 'gadh', 'gadh-stats'); }); await p.waitForTimeout(600);
  verif('Statistiques GADH : boutons Excel et PDF', await p.evaluate(() => /Fiche de cet écran/.test(document.getElementById('main').innerText)));
  await p.evaluate(() => nav('gadh-historique')); await p.waitForTimeout(600);
  verif('Historique GADH : boutons Excel et PDF', await p.evaluate(() => /Fiche de cet écran/.test(document.getElementById('main').innerText)));
  // Paramètres MGT nettoyés
  await p.evaluate(() => { kpiAller('mgt', 'mgt'); }); await p.waitForTimeout(1500);
  const fr = p.frames().find(f => /mgt-crm-app/.test(f.url()));
  await fr.evaluate(() => openModule('settings')); await p.waitForTimeout(1000);
  const txt = await fr.evaluate(() => document.getElementById('settingsModule').innerText);
  verif('Paramètres MGT : plus de « Droits par profil », « Comparer une sauvegarde », raccourcis', !/Droits par profil|Comparer une sauvegarde|Importer une sauvegarde\b|Note rapide/.test(txt) && !/\bTâches\b/.test(txt), txt);
  console.log(txt);
  await p.setViewportSize({width:412, height:900}); await p.waitForTimeout(400); await p.screenshot({path:path.join(os.tmpdir(), 'mgt-params.png')});
  verif('Aucune erreur', !A.erreurs.length, A.erreurs.join(' | '));
  await b.close();
  console.log(`Fiches et paramètres : ${ok}/${total} contrôles conformes`); echecs.forEach(e => console.log('  ÉCHEC  ' + e));
  process.exit(echecs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
