#!/usr/bin/env node
// Employés TEK-TREND : liste, téléphone, contrôles du formulaire, import, désactiver / réactiver (données d'essai).
// Lancement (dans tests/) : npm run e2e-employes
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const path = require('path'), fs = require('fs');
const TESTS = __dirname, req = require;
const {chromium} = req('playwright'); const admin = require(TESTS + '/admin.js'); const C = require(path.join(__dirname, '..', 'roles-config.js')); const serveur = require(TESTS + '/serveur.js');
const SDK = path.join(TESTS, 'node_modules', 'firebase'), MDP = 'Test2026ok';
(async () => {
  admin.initializeApp({projectId: 'demo-gtm-groupe', databaseURL: 'http://127.0.0.1:9000?ns=demo-gtm-groupe'});
  const u = await admin.auth().createUser({email: 'sysadmin@tek-trend.app', password: MDP}), d = C.ROLES.sysadmin;
  const emps = {}; ['Alpha Une', 'Bravo Deux', 'Charlie Trois', 'Delta Quatre', 'Echo Cinq'].forEach((n, i) => { emps['e' + (i + 1)] = {nom: n, matricule: String(1001 + i), poste: i % 2 ? 'Couture' : '', statut: 'actif'}; });
  const ids = Object.keys(emps).sort((a, b) => (emps[a].nom || '').localeCompare(emps[b].nom || ''));
  emps[ids[0]].tel = '98123456'; emps[ids[1]].tel = '+21655111222';
  const premier = emps[ids[0]], deuxieme = emps[ids[2]];
  await admin.database().ref('/groupe1').set({tek: {employees: emps}, users_v2: {[u.uid]: {nom: d.label, username: 'sysadmin', role: d.role, profil: 'sysadmin', groupe: true, societes: d.societes}}});
  await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-gtm-groupe', {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const s = serveur.demarrer(8790), b = await chromium.launch(), ctx = await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'fr-FR'});
  await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')}); return rt.abort(); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', x => x.accept());
  await p.goto('http://localhost:8790/index.html'); await p.waitForSelector('#login-user');
  await p.fill('#login-user', 'sysadmin'); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
  await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await p.waitForTimeout(3000);
  await p.evaluate(() => { kpiAller('tek', 'rh'); nav('rh-personnel'); window.scrollTo(0, 0); }); await p.waitForTimeout(1500);
  const r = [], base = async () => (await admin.database().ref('/groupe1/tek/employees').once('value')).val();
  r.push(['téléphone affiché dans la liste', (await p.locator('.rem-tel').first().textContent()).includes('98 123 456')]);
  r.push(['format international', await p.locator('.rem-tel', {hasText: '+216 55 111 222'}).count() === 1]);
  // recherche par téléphone
  await p.fill('#rh-p-search', '98123'); await p.waitForTimeout(300);
  r.push(['recherche par téléphone', await p.locator('.rh-row:visible').count() === 1]);
  await p.fill('#rh-p-search', ''); await p.evaluate(() => rhFilterPersonnelRows(''));
  // ajout : matricule en double refusé
  await p.click('.rem-ajout'); await p.waitForTimeout(300);
  await p.fill('#ef-nom', 'Essai Nouvelle'); await p.fill('#ef-matricule', String(premier.matricule)); await p.fill('#ef-tel', '98 765 432');
  await p.click('.rem-actions .btn-primary'); await p.waitForTimeout(300);
  r.push(['matricule en double refusé', /déjà utilisé/.test(await p.locator('#rem-erreur').textContent())]);
  await p.fill('#ef-matricule', '99999'); await p.fill('#ef-tel', '12'); await p.click('.rem-actions .btn-primary'); await p.waitForTimeout(300);
  r.push(['téléphone invalide refusé', /non valide/.test(await p.locator('#rem-erreur').textContent())]);
  await p.fill('#ef-tel', '98 765 432'); await p.click('.rem-actions .btn-primary'); await p.waitForTimeout(1500);
  let e = await base(), nouv = Object.values(e).find(x => x.matricule === '99999');
  r.push(['employé ajouté avec téléphone', !!nouv && nouv.tel === '98765432' && nouv.statut === 'actif']);
  r.push(['les autres fiches intactes', Object.keys(e).length === ids.length + 1]);
  // modification depuis la liste
  const idDeux = ids[2];
  await p.evaluate((id) => rhEmpForm(id), idDeux); await p.waitForTimeout(300);
  await p.fill('#ef-tel', '20300400'); await p.click('.rem-actions .btn-primary'); await p.waitForTimeout(1500);
  e = await base(); r.push(['téléphone ajouté à un employé existant, reste inchangé', e[idDeux].tel === '20300400' && e[idDeux].nom === deuxieme.nom && e[idDeux].matricule === deuxieme.matricule]);
  // import : nouvelle ligne + mise à jour du téléphone d'un existant
  await p.evaluate(() => rhEmpImport()); await p.waitForTimeout(300);
  await p.fill('#rh-import-text', `88888 ben salah amira 97 111 222\n${premier.matricule} ${premier.nom} 55 000 111\nligne`);
  await p.click('.rem-actions .btn-primary'); await p.waitForTimeout(1500);
  e = await base(); const am = Object.values(e).find(x => x.matricule === '88888');
  r.push(['import : nouvel employé avec téléphone', !!am && am.nom === 'Ben Salah Amira' && am.tel === '97111222']);
  r.push(['import : téléphone mis à jour sans doublon', e[ids[0]].tel === '55000111' && Object.values(e).filter(x => x.matricule === String(premier.matricule)).length === 1]);
  // fiche : téléphone visible
  await p.evaluate((id) => { rhFicheEmpId = id; nav('rh-fiche'); }, idDeux); await p.waitForTimeout(800);
  r.push(['fiche : téléphone affiché', (await p.locator('#main .rem-tel').first().textContent()).includes('20 300 400')]);
  await p.evaluate(() => nav('rh-personnel')); await p.waitForTimeout(800);
  await p.evaluate((id) => rhEditFromFiche(id), idDeux); await p.waitForTimeout(300);
  r.push(['fiche : bouton Désactiver, pas de Supprimer', await p.locator('#rh-modal-zone button', {hasText: 'Désactiver'}).count() === 1 && await p.locator('#rh-modal-zone button', {hasText: 'Supprimer'}).count() === 0]);
  await p.locator('#rh-modal-zone button', {hasText: 'Désactiver'}).click(); await p.waitForTimeout(1500);
  e = await base(); r.push(['désactivé, fiche conservée', e[idDeux] && e[idDeux].statut === 'inactif' && e[idDeux].tel === '20300400']);
  r.push(['absent du pointage', await p.evaluate((id) => !activeEmployees().some(([k]) => k === id), idDeux)]);
  await p.evaluate((id) => rhReactiverEmploye(id), idDeux); await p.waitForTimeout(1500);
  e = await base(); r.push(['réactivé', e[idDeux].statut === 'actif' && !e[idDeux].desactiveLe]);
  r.push(['aucune donnée d\'employé dans le code', !/65447|Khairedine|dalel/i.test(fs.readFileSync(path.join(__dirname, '..', 'rh-module.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'rh-employes-module.js'), 'utf8'))]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
