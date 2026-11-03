#!/usr/bin/env node
// CRM MGT : sous-tâches (tâche interne et tâche client) et modèles de tâches partagés (données d'essai).
// Lancement (dans tests/) : npm run mgt-sous-taches
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
  await admin.database().ref('/groupe1').set({mgt: {
    mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1}), '2': J({ID: '2', Societe: 'Autre client', _version: 1})},
    mgt_crm_taches_internes: J([{id: 'I1', type: 'rapport', priority: 'Moyenne', status: 'En attente', date: auj, objective: 'Rapport mensuel', updated: '2026-11-01T08:00:00Z'}])},
    users_v2: {[u.uid]: {nom: d.label, username: 'sysadmin', role: d.role, profil: 'sysadmin', groupe: true, societes: d.societes}}});
  await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-gtm-groupe', {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const s = serveur.demarrer(8790), b = await chromium.launch(), ctx = await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'fr-FR'});
  await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')}); return rt.abort(); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  let reponse = null; p.on('dialog', x => x.type() === 'prompt' ? x.accept(reponse || '') : x.accept());
  await p.goto('http://localhost:8790/index.html'); await p.waitForSelector('#login-user');
  await p.fill('#login-user', 'sysadmin'); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
  await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await p.waitForTimeout(2500);
  await p.evaluate(() => { try { kpiAller('mgt', 'mgt'); } catch(e) {} });
  let fr = null; for(let i = 0; i < 200 && !fr; i++){ fr = p.frames().find(f => /mgt-crm-app/.test(f.url())); if(!fr) await p.waitForTimeout(100); }
  await fr.waitForLoadState('load'); await p.waitForTimeout(5000);
  fr.page().on('pageerror', e => err.push('crm: ' + e.message));
  const r = [], base = async () => (await admin.database().ref('/groupe1/mgt').once('value')).val();
  const tache = async (id) => lire((await base()).mgt_crm_taches_internes).find(x => x.id === id);
  await fr.evaluate(() => openModule('tasks')); await p.waitForTimeout(1000);
  // 1. Tâche interne : bouton ☑ sur la carte, ajout de 3 étapes, cocher
  const bouton = fr.locator('[data-tk-subs="int-I1"]');
  r.push(['bouton sous-tâches sur la carte', await bouton.count() === 1 && (await bouton.textContent()).trim() === '☑']);
  await bouton.click(); await p.waitForTimeout(300);
  r.push(['fenêtre des sous-tâches ouverte', await fr.locator('#tkSubSheet').count() === 1]);
  await fr.fill('#tsNew', 'Collecter les chiffres\nRédiger\nEnvoyer'); await fr.click('#tsAdd'); await p.waitForTimeout(1500);
  let t = await tache('I1');
  r.push(['3 sous-tâches enregistrées dans la base', t && Array.isArray(t.subs) && t.subs.length === 3 && t.subs.every(x => x.done === false)]);
  await fr.locator('#tkSubSheet .tsChk').first().click(); await p.waitForTimeout(1200);
  t = await tache('I1'); r.push(['étape cochée enregistrée', t.subs[0].done === true && t.subs[1].done === false]);
  r.push(['progression affichée', /1 \/ 3/.test(await fr.locator('#tsInfo').textContent())]);
  // 2. Enregistrer comme modèle (partagé)
  reponse = 'Rapport équipe'; await fr.click('#tsSave'); await p.waitForTimeout(1500);
  const modeles = () => base().then(g => lire(g.mgt_crm_taches_internes).filter(x => x.kind === 'template'));
  let m = await modeles();
  r.push(['modèle enregistré pour l\'équipe', m.length === 1 && m[0].name === 'Rapport équipe' && m[0].items.length === 3]);
  // tout cocher => proposition de terminer
  for(const n of [1, 2]){ await fr.locator('#tkSubSheet .tsChk').nth(n).click(); await p.waitForTimeout(1200); }
  r.push(['tout coché : proposition de terminer', await fr.locator('#tsFinish').count() === 1]);
  await fr.click('#tsFinish'); await p.waitForTimeout(1500);
  t = await tache('I1'); r.push(['tâche marquée terminée', t.status === 'Termine']);
  // 3. Nouvelle tâche à partir d'un modèle
  await fr.evaluate(() => window.__tkInt.chooser()); await p.waitForTimeout(300);
  await fr.click('#tkMenu [data-k="tpl"]'); await p.waitForTimeout(300);
  const choix = fr.locator('#tkTplPick .tsPick');
  r.push(['modèles intégrés et modèle de l\'équipe proposés', await choix.count() === 5 && await fr.locator('#tkTplPick', {hasText: 'Rapport équipe'}).count() === 1]);
  await fr.locator('#tkTplPick .tsPick', {hasText: 'Offre client'}).click(); await p.waitForTimeout(300);
  r.push(['formulaire prérempli depuis le modèle', (await fr.inputValue('#tkiObj')) === 'Offre client' && (await fr.inputValue('#tkiType')) === 'offre']);
  await fr.click('#tkiSave'); await p.waitForTimeout(1500);
  const nouv = lire((await base()).mgt_crm_taches_internes).find(x => x.objective === 'Offre client' && !x.kind);
  r.push(['tâche créée avec les étapes du modèle', !!nouv && Array.isArray(nouv.subs) && nouv.subs.length === 5]);
  r.push(['le modèle n\'apparaît pas comme une tâche', await fr.evaluate(() => !window.__tkIntActions().some(a => a._int.kind === 'template'))]);
  // 4. Supprimer le modèle de l'équipe
  await fr.evaluate(() => window.__tkSubs.pickTemplate(function(){})); await p.waitForTimeout(300);
  await fr.locator('#tkTplPick [data-del]').first().click(); await p.waitForTimeout(1500);
  m = await modeles(); r.push(['modèle supprimé', m.length === 0]);
  await fr.evaluate(() => { const x = document.getElementById('tkTplPick'); if(x) x.remove(); });
  // 5. Tâche d'un client : sous-tâches rangées dans la fiche du client (TaskSubs)
  await fr.evaluate(async () => { const c = CLIENTS.find(x => String(x[fields.id]) === '1'); window.__tkSubs.open({client: c, eventId: 'EV1', type: 'visite', status: 'En attente'}); });
  await p.waitForTimeout(300);
  await fr.fill('#tsNew', 'Préparer le catalogue; Appeler avant'); await fr.click('#tsAdd'); await p.waitForTimeout(2000);
  let g = await base(), cl = lire(g.mgt_crm_clients), c1 = cl.find(x => String(x.ID) === '1'), c2 = cl.find(x => String(x.ID) === '2');
  r.push(['sous-tâches du client dans sa fiche', c1 && c1.TaskSubs && c1.TaskSubs.EV1 && c1.TaskSubs.EV1.length === 2]);
  r.push(['fiche client conservée', c1.Societe === 'Client Essai' && c2 && c2.Societe === 'Autre client' && !c2.TaskSubs]);
  await fr.locator('#tkSubSheet [data-r]').first().click(); await fr.locator('#tkSubSheet [data-r]').first().waitFor({state: 'attached'}).catch(() => {}); await p.waitForTimeout(1500);
  await fr.locator('#tkSubSheet [data-r]').first().click(); await p.waitForTimeout(1500);
  g = await base(); c1 = lire(g.mgt_crm_clients).find(x => String(x.ID) === '1');
  r.push(['dernière sous-tâche retirée : plus rien dans la fiche', !c1.TaskSubs || !c1.TaskSubs.EV1]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
