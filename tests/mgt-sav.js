#!/usr/bin/env node
// CRM MGT : nouveautés V4.6.9S2 du CRM de l'associé — Parc machines, fiche machine (identifiant MCH-), SAV / interventions
// (création, enregistrement dans la fiche client, bon d'intervention PDF), historique de la machine, services hors marge,
// droits GTM (Direction en consultation) (données d'essai, émulateur).
// Lancement (dans tests/) : npm run mgt-sav
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const path = require('path'), fs = require('fs');
const TESTS = __dirname, req = require;
const {chromium} = req('playwright'); const admin = require(TESTS + '/admin.js'); const C = require(path.join(__dirname, '..', 'roles-config.js')); const serveur = require(TESTS + '/serveur.js');
const SDK = path.join(TESTS, 'node_modules', 'firebase'), MDP = 'Test2026ok';
const J = (v) => '__gtm_json_v1:' + JSON.stringify(v);
const lire = (v) => typeof v === 'string' && v.startsWith('__gtm_json_v1:') ? JSON.parse(v.slice(14)) : v;
(async () => {
  admin.initializeApp({projectId: 'demo-gtm-groupe', databaseURL: 'http://127.0.0.1:9000?ns=demo-gtm-groupe'});
  const u = await admin.auth().createUser({email: 'sysadmin@tek-trend.app', password: MDP}), d = C.ROLES.sysadmin;
  const u2 = await admin.auth().createUser({email: 'direction@tek-trend.app', password: MDP}), d2 = C.ROLES.direction;
  const x = new Date(), auj = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  await admin.database().ref('/groupe1').set({mgt: {
    mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1, Machines: [{commercial: 'Presse à repasser', model: 'P-100', serial: 'S-001', year: '2022'}, {commercial: 'Table de coupe', model: 'T-9', serial: 'S-002', year: '2023'}]}),
      '2': J({ID: '2', Societe: 'Autre client', _version: 1, Machines: [{commercial: 'Presse', model: 'P-100', serial: 'S-001', year: '2021'}]})}},
    users_v2: {[u.uid]: {nom: d.label, username: 'sysadmin', role: d.role, profil: 'sysadmin', groupe: true, societes: d.societes},
      [u2.uid]: {nom: d2.label, username: 'direction', role: d2.role, profil: 'direction', groupe: !!d2.groupe, societes: d2.societes}}});
  await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-gtm-groupe', {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const s = serveur.demarrer(8790), b = await chromium.launch(), err = [], cons = [];
  async function session(login){
    const ctx = await b.newContext({viewport: {width: 1366, height: 900}, serviceWorkers: 'block', locale: 'fr-FR', acceptDownloads: true});
    await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]))}); return rt.abort(); });
    const p = await ctx.newPage(); p.on('pageerror', e => err.push(login + ': ' + e.message)); p.on('dialog', x => { cons.push(login + ' (dialogue) : ' + x.message()); x.accept(); });
    p.on('console', m => { if(m.type() === 'error' && /SAV|PARC|MACHINE|HISTORIQUE|SERVICES|absente|introuvable/i.test(m.text())) cons.push(login + ': ' + m.text()); });
    await p.goto('http://localhost:8790/index.html'); await p.waitForSelector('#login-user');
    await p.fill('#login-user', login); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await p.waitForTimeout(2500);
    await p.evaluate(() => { try { kpiAller('mgt', 'mgt'); } catch(e) {} });
    let fr = null; for(let i = 0; i < 200 && !fr; i++){ fr = p.frames().find(f => /mgt-crm-app/.test(f.url())); if(!fr) await p.waitForTimeout(100); }
    await fr.waitForLoadState('load'); await p.waitForTimeout(6000);
    return {p, fr};
  }
  const r = [], client = async (id) => lire((await admin.database().ref('/groupe1/mgt/mgt_crm_clients/' + id).once('value')).val());
  const {p, fr} = await session('sysadmin');
  r.push(['modules V4.6.9S2 chargés (parc, fiche machine, SAV, historique, services)', await fr.evaluate(() => !!(window.MGT_PARC && window.MGT_MACH && window.MGT_SAV && window.MGT_HIST && window.MGT_V469S_SERVICES && window.MGT_V469R_FIX))]);
  // ---------- services hors marge ----------
  const t = await fr.evaluate(() => MGT_LINES.calcTotals([{quantite: 1, prixVente: 100, prixAchat: 60}, {quantite: 1, prixVente: 50, prixAchat: 10, categorie: 'SERVICES'}]));
  r.push(['service : compté dans le total HT, hors coût et marge', t.totalHT === 150 && t.marge === 40 && t.cout === 60 && t.totalServices === 50 && t.tauxMarge === 40]);
  // ---------- parc machines ----------
  await fr.evaluate(() => openModule('machines')); await p.waitForTimeout(1200);
  const parc = await fr.locator('#machineModule').textContent();
  r.push(['Parc machines : toutes les machines des fiches clients', /S-001/.test(parc) && /S-002/.test(parc) && /Table de coupe/.test(parc) && (await fr.evaluate(() => MGT_PARC.filtered().length)) === 3]);
  r.push(['menu : « Parc machines »', /Parc machines/.test(await fr.locator('.navItem[data-module="machines"]').first().textContent())]);
  const ids = await fr.evaluate(() => MGT_MACH.all().map(x => x.m.id)), ids2 = await fr.evaluate(() => MGT_MACH.all().map(x => x.m.id));
  r.push(['identifiant unique et stable (MCH-…)', ids.length === 3 && ids.every(i => /^MCH-/.test(i)) && new Set(ids).size === 3 && JSON.stringify(ids) === JSON.stringify(ids2)]);
  r.push(['contrôle des doublons de n° de série', (await fr.evaluate(() => MGT_MACH.duplicates('S-001').length)) === 2 && (await fr.evaluate(() => MGT_MACH.duplicates('S-002').length)) === 1]);
  // ---------- SAV : nouvelle intervention ----------
  await fr.evaluate(() => openModule('sav')); await p.waitForTimeout(1000);
  r.push(['module SAV / Interventions ouvert', await fr.locator('#savModule:not([hidden])').count() === 1 && await fr.locator('#savModule [data-sv="new"]:not([hidden])').count() === 1]);
  await fr.click('#savModule [data-sv="new"]'); await p.waitForTimeout(500);
  await fr.selectOption('#svF_client', '1'); await p.waitForTimeout(300);
  const mid = await fr.evaluate(() => { const s = document.getElementById('svF_machine'); const o = [...s.options].find(o => /S-001/.test(o.textContent)); s.value = o.value; s.dispatchEvent(new Event('change', {bubbles: true})); return o.value; });
  await fr.selectOption('#svF_type', 'depannage'); await fr.fill('#svF_date', auj); await fr.fill('#svF_technicien', 'Ali'); await fr.fill('#svF_duree', '2,5');
  await fr.fill('#svF_demande', 'Presse ne chauffe plus'); await fr.fill('#svF_travaux', 'Résistance remplacée');
  await fr.click('[data-svm="save"]'); await p.waitForTimeout(2500);
  const c1 = await client('1'), iv = (c1.Interventions || [])[0];
  r.push(['intervention enregistrée dans la fiche client (base GTM)', !!iv && iv.type === 'depannage' && iv.machineId === mid && iv.technicien === 'Ali' && iv.duree === 2.5]);
  r.push(['identifiant de la machine enregistré dans la même écriture', (c1.Machines || []).some(m => m.id === mid && m.serial === 'S-001')]);
  r.push(['liste SAV : intervention affichée', /Presse ne chauffe plus|Dépannage/.test(await fr.locator('#savModule').textContent())]);
  if(process.env.CAPTURES){ await p.screenshot({path: process.env.CAPTURES + '/sav-liste.png'}); await fr.evaluate(() => openModule('machines')); await p.waitForTimeout(800); await p.screenshot({path: process.env.CAPTURES + '/parc.png'}); await fr.evaluate(() => openModule('sav')); await p.waitForTimeout(600); }
  // bon d'intervention PDF (moteur PDF chargé à la demande)
  await fr.evaluate((id) => MGT_SAV.openFiche('1', id), iv.id); await p.waitForTimeout(600);
  if(process.env.CAPTURES) await p.screenshot({path: process.env.CAPTURES + '/sav-fiche.png'});
  const dl = p.waitForEvent('download', {timeout: 20000}).catch(() => null);
  await fr.click('[data-svm="bonClient"]'); const f1 = await dl;
  r.push(['bon d\'intervention client en PDF', !!f1 && /\.pdf$/.test(f1.suggestedFilename())]);
  // historique de la machine
  const h = await fr.evaluate((m) => { const x = MGT_HIST.compute(m); return JSON.stringify(x).slice(0, 4000); }, mid);
  r.push(['historique de la machine : intervention dans la chronologie', /Presse ne chauffe plus|depannage|Dépannage/i.test(h)]);
  // ---------- Direction : consultation ----------
  const D = await session('direction');
  await D.fr.evaluate(() => openModule('sav')); await D.p.waitForTimeout(1200);
  r.push(['Direction : SAV en consultation (pas de « Nouvelle intervention »)', await D.fr.locator('#savModule:not([hidden])').count() === 1 && await D.fr.locator('#savModule [data-sv="new"]:not([hidden])').count() === 0 && /Presse ne chauffe plus|Dépannage/.test(await D.fr.locator('#savModule').textContent())]);
  r.push(['aucun message d\'erreur des nouveaux modules', !cons.some(x => !/dialogue/.test(x))]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err); if(cons.length) console.log(cons);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
