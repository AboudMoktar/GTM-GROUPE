#!/usr/bin/env node
// CRM MGT : recherche et vue en colonnes des tâches, rappels à l'heure, tâches répétées chaque jour, dates des relances de devis (repris du CRM de l'associé).
// Lancement (dans tests/) : npm run mgt-rappels
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
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10), il20 = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  const h = new Date(Date.now() - 2 * 60000), hh = String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0');
  await admin.database().ref('/groupe1').set({mgt: {
    mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1, Planning: [{id: 'E1', date: auj, type: 'appel', priority: 'Moyenne', status: 'En attente', objective: 'Appeler pour la commande', commercial: 'Ali'}, {id: 'E2', date: hier, type: 'appel', priority: 'Moyenne', status: 'Termine', objective: 'Point quotidien', repeat: 'daily', doneAt: auj}]}),
      '2': J({ID: '2', Societe: 'Autre client', _version: 1, Offres: [{id: 'O1', type: 'devis', sentDate: il20, status: 'En attente', amount: 1000}]})},
    mgt_crm_taches_internes: J([{id: 'I1', type: 'rapport', priority: 'Moyenne', status: 'En attente', date: auj, objective: 'Rapport mensuel', updated: '2026-11-01T08:00:00Z'},
      {id: 'I2', type: 'appel', priority: 'Haute', status: 'En attente', date: auj, startTime: hh, objective: 'Rappeler le fournisseur', remind: '0', updated: '2026-11-01T08:00:00Z'},
      {id: 'I3', type: 'rapport', priority: 'Faible', status: 'Termine', date: auj, dueDate: hier, objective: 'Sauvegarde du jour', repeat: 'daily', updated: '2026-11-01T08:00:00Z'}])},
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
  const client = async (id) => lire((await base()).mgt_crm_clients).find(x => String(x.ID) === id);
  await fr.evaluate(() => { try { localStorage.removeItem('mgt_tk_view'); localStorage.removeItem('mgt_t5_fired_v1'); } catch(e) {} openModule('tasks'); }); await p.waitForTimeout(1000);
  // 1. recherche
  r.push(['champ de recherche et bouton Colonnes', await fr.locator('#tkQ').count() === 1 && /Colonnes/.test(await fr.locator('#tkView').textContent())]);
  await fr.fill('#tkQ', 'rapport mensuel'); await p.waitForTimeout(600);
  r.push(['recherche : seules les tâches qui correspondent', await fr.locator('#taskReminderList .tkCard').count() === 1 && await fr.locator('[data-tk-open="int-I1"]').count() === 1]);
  await fr.fill('#tkQ', 'client essai'); await p.waitForTimeout(600);
  r.push(['recherche par nom de client', await fr.locator('[data-tk-open="E1"]').count() === 1 && await fr.locator('[data-tk-open="int-I1"]').count() === 0]);
  await fr.fill('#tkQ', ''); await p.waitForTimeout(600);
  // 2. vue en colonnes
  await fr.click('#tkView'); await p.waitForTimeout(400);
  r.push(['vue en colonnes : À faire, En cours, Terminé', await fr.locator('#taskReminderList.tkKan .tkCol').count() === 3 && await fr.locator('.tkCol[data-col="todo"] [data-tk-open="int-I1"]').count() === 1 && await fr.locator('.tkCol[data-col="done"] [data-tk-open="int-I3"]').count() === 1]);
  r.push(['carte déplaçable', await fr.locator('.tkCol[data-col="todo"] [data-tk-card="int-I1"][draggable="true"]').count() === 1]);
  await fr.locator('[data-tk-mv="int-I1|1"]').click(); await p.waitForTimeout(1500);
  r.push(['▶ : la tâche passe « En cours »', (await tache('I1')).status === 'En cours' && await fr.locator('.tkCol[data-col="doing"] [data-tk-open="int-I1"]').count() === 1]);
  await fr.locator('[data-tk-mv="E1|1"]').click(); await p.waitForTimeout(1500);
  r.push(['▶ sur une tâche client : enregistrée dans sa fiche', ((await client('1')).Planning.find(x => x.id === 'E1') || {}).status === 'En cours']);
  if(process.env.CAPTURES) await p.screenshot({path: process.env.CAPTURES + '/kanban.png'});
  r.push(['vue retenue sur l\'appareil', await fr.evaluate(() => localStorage.getItem('mgt_tk_view')) === 'kanban']);
  await fr.click('#tkView'); await p.waitForTimeout(400);
  r.push(['retour à la liste', await fr.locator('#taskReminderList.tkKan').count() === 0 && await fr.locator('#tkTabs button').count() === 6]);
  // 3. rappel à l'heure prévue
  r.push(['pastille ⏰ sur la carte', /⏰/.test(await fr.locator('[data-tk-open="int-I2"]').textContent())]);
  await fr.evaluate(() => window.__t5.scan()); await p.waitForTimeout(300);
  r.push(['rappel affiché (bandeau)', await fr.locator('#t5Banner .t5Row').count() === 1 && /Rappeler le fournisseur/.test(await fr.locator('#t5Banner').textContent())]);
  if(process.env.CAPTURES) await p.screenshot({path: process.env.CAPTURES + '/rappel.png'});
  await fr.click('#t5Banner [data-t5="snz"]'); await fr.evaluate(() => window.__t5.scan()); await p.waitForTimeout(200);
  r.push(['« Dans 10 min » : pas de nouveau rappel tout de suite', await fr.locator('#t5Banner .t5Row').count() === 0]);
  // 4. formulaire d'une tâche interne : rappel et répétition
  await fr.evaluate(() => window.__tkInt.edit(window.__tkInt.get('I1'))); await p.waitForTimeout(300);
  await fr.selectOption('#tkiRem', '30'); await fr.selectOption('#tkiRep', 'daily'); await fr.click('#tkiSave'); await p.waitForTimeout(1500);
  let t = await tache('I1'); r.push(['tâche interne : rappel et répétition enregistrés', t.remind === '30' && t.repeat === 'daily']);
  // 5. répétition chaque jour
  await fr.evaluate(() => window.__t5.recur()); await p.waitForTimeout(4000);
  const dem = await fr.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return dateToInput(d); });
  const l = lire((await base()).mgt_crm_taches_internes), n3 = l.find(x => x.id === 'RI3~' + dem);
  r.push(['tâche interne répétée : recréée pour demain', !!n3 && n3.status === 'En attente' && n3.date === dem && n3.repeat === 'daily' && (await tache('I3')).repeatDone === '1']);
  const c1 = await client('1'), n2 = c1.Planning.find(x => x.id === 'RE2~' + dem);
  r.push(['tâche client répétée : recréée dans la fiche', !!n2 && n2.status === 'En attente' && c1.Planning.find(x => x.id === 'E2').repeatDone === '1']);
  await fr.evaluate(() => window.__t5.recur()); await p.waitForTimeout(2500);
  r.push(['une seule fois', lire((await base()).mgt_crm_taches_internes).filter(x => /^RI3~/.test(x.id)).length === 1 && (await client('1')).Planning.filter(x => /^RE2~/.test(x.id)).length === 1]);
  // 6. détail d'une tâche client : réglage du rappel
  await fr.evaluate(() => { const a = allPlanningActions().find(x => String(x.eventId) === 'E1'); calendarActionMap[a.eventId] = a; openTaskDetail(a); }); await p.waitForTimeout(400);
  r.push(['détail d\'une tâche client : bloc Rappel et répétition', await fr.locator('#t5Box').count() === 1]);
  await fr.selectOption('#t5Rem', '60'); await fr.click('#t5Save'); await p.waitForTimeout(1800);
  r.push(['rappel d\'une tâche client enregistré', ((await client('1')).Planning.find(x => x.id === 'E1') || {}).remind === '60']);
  // 7. relance automatique d'un devis sans réponse : date fixe (envoi + 16 jours)
  const rel = await fr.evaluate((il20) => { const c = CLIENTS.find(x => String(x[fields.id]) === '2'); const a = quoteAutoActions(c).find(x => /sans reponse/.test(norm(x.objective || ''))); const att = new Date(il20 + 'T00:00:00'); att.setDate(att.getDate() + 16); return a ? [a.date, dateToInput(att)] : null; }, il20);
  r.push(['relance de devis : date fixe (envoi + 16 jours)', !!rel && rel[0] === rel[1]]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
