#!/usr/bin/env node
// Captures de tous les écrans (outil de travail de la refonte, non versionné). Données de test inventées.
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const fs = require('fs'), path = require('path');
const admin = require('./admin.js');
const {chromium} = require('playwright');
const C = require('../roles-config.js');
const {donneesInitiales} = require('./scenarios.js');
const PROJET = 'demo-gtm-groupe', DOM = '@tek-trend.app', MDP = 'Test2026ok';
const OUT = process.env.OUT || '/tmp/avant';
const PROFIL = process.env.PROFIL || 'sysadmin';
const LARG = (process.env.LARG || '1440x900,390x844').split(',').map(x => x.split('x').map(Number));
admin.initializeApp({projectId: PROJET, databaseURL: `http://127.0.0.1:9000?ns=${PROJET}`});
const SDK = path.join(__dirname, 'node_modules', 'firebase');
const CONFIG = `const firebaseConfig = {apiKey:'demo-cle', authDomain:'localhost', databaseURL:'http://127.0.0.1:9000?ns=${PROJET}', projectId:'${PROJET}'};
(function(){ const init = firebase.initializeApp.bind(firebase); firebase.initializeApp = function(c, n){ const app = init(c, n);
  try { app.auth().useEmulator('http://127.0.0.1:9099', {disableWarnings:true}); } catch(e) {} try { app.database().useEmulator('127.0.0.1', 9000); } catch(e) {} return app; }; })();`;
(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const comptes = {};
  for(const r of C.ORDRE){
    const u = await admin.auth().createUser({email: r.replace(/_/g, '') + DOM, password: MDP});
    const d = C.ROLES[r];
    comptes[u.uid] = {nom: d.label, username: r.replace(/_/g, ''), role: d.role, profil: r, groupe: !!d.groupe, societes: d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  const NOMS = ['Amal Trabelsi','Sami Gharbi','Nour Ben Salah','Ines Jaziri','Hela Mansour','Rim Chaabane','Olfa Dridi','Mouna Kefi','Salma Ayari','Wafa Hammami'];
  NOMS.forEach((n, i) => { base.groupe1.tek.employees['x' + i] = {nom:n, poste: i % 3 ? 'Opératrice' : 'Contrôleuse', matricule:String(100 + i)}; });
  const att = base.groupe1.tek[Object.keys(base.groupe1.tek).filter(k => /^attendance_/.test(k)).sort().pop()];
  if(att){ att.x0 = {status:'present', in:'08:00', out:'17:00'}; att.x1 = {status:'present', in:'08:25'}; att.x2 = {status:'absent'}; }
  await admin.database().ref('/').set(base);
  require('./serveur.js').demarrer(8790);
  const b = await chromium.launch(), erreurs = [];
  for(const [w, h] of LARG){
    const mob = w < 700, ctx = await b.newContext({viewport: {width: w, height: h}, isMobile: mob, hasTouch: mob}), p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(w + ' ' + e.message));
    await p.route(u => { const s = String(u); return !(s.startsWith('http://localhost') || s.startsWith('http://127.0.0.1')); }, rt => {
      const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url());
      if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')});
      return rt.abort();
    });
    await p.route('**/firebase-config.js', rt => rt.fulfill({contentType: 'application/javascript', body: CONFIG}));
    if(process.env.DARK) await p.addInitScript(() => { try { localStorage.setItem('gtm_theme', 'dark'); } catch(e){} });
    await p.goto('http://localhost:8790/index.html');
    await p.waitForSelector('#login-user', {timeout: 15000});
    const tag = mob ? 'm' : 'd';
    await p.screenshot({path: `${OUT}/${tag}-00-connexion.png`});
    await p.fill('#login-user', PROFIL.replace(/_/g, '')); await p.fill('#login-pass', MDP);
    await p.click('#login-form button[type=submit]');
    await p.waitForTimeout(4000);
    await p.screenshot({path: `${OUT}/${tag}-01-accueil.png`});
    const plan = await p.evaluate(() => {
      const out = [];
      Object.keys(SOCIETES).forEach(soc => modulesDeSociete(soc).forEach(mod => { if(mod !== 'mgt') out.push([soc, mod]); }));
      return out;
    });
    let n = 2;
    if(await p.evaluate(() => typeof renderDirection === 'function')){ await p.evaluate(() => { try { renderDirection(); } catch(e){} }); await p.waitForTimeout(800); await p.screenshot({path: `${OUT}/${tag}-0${n++}-direction.png`, fullPage: !mob}); }
    for(const [soc, mod] of plan){
      await p.evaluate(([soc, mod]) => kpiAller(soc, mod), [soc, mod]); await p.waitForTimeout(700);
      const tabs = await p.evaluate(() => (typeof navItems === 'function' ? navItems() : []).map(i => i.tab).filter(Boolean));
      for(const t of tabs.slice(0, 8)){
        if(process.env.SEL && process.env.SEL.split(',').indexOf(t) < 0) continue;
        try { await p.evaluate((t) => nav(t), t); } catch(e) { continue; }
        await p.waitForTimeout(t === 'suivi' || /commandes/.test(t) ? 2500 : 600);
        await p.screenshot({path: `${OUT}/${tag}-${String(n++).padStart(2, '0')}-${soc}-${mod}-${t}.png`, fullPage: false});
      }
    }
    await ctx.close();
  }
  fs.writeFileSync(OUT + '/erreurs.txt', erreurs.join('\n'));
  console.log('captures :', fs.readdirSync(OUT).length, 'erreurs JS :', erreurs.length);
  await b.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
