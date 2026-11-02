#!/usr/bin/env node
// ============================================================
// Mesures de vitesse sur un téléphone lent simulé (processeur ralenti 4 fois, réseau « Slow 4G »).
// Lancement (dans tests/) : npm run mesures      (émulateurs Auth + Database, aucun accès à la vraie base)
//   - les fichiers de l'application sont servis COMPRESSÉS (gzip), comme par GitHub Pages ;
//   - le SDK Firebase est servi depuis tests/node_modules/firebase (gstatic.com peut être inaccessible) :
//     ces fichiers-là ne passent pas par la limitation du réseau ;
//   - GTM_SAUVEGARDE=chemin/vers/export.json : mesurer avec de vraies données (sinon données d'essai).
// Résultat : tableau en millisecondes (et mesures.json à côté de ce script).
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const admin = require('./admin.js');
const {chromium} = require('playwright');
const C = require(path.join(__dirname, '..', 'roles-config.js'));
const {donneesInitiales} = require(path.join(__dirname, 'scenarios.js'));

const RACINE = path.join(__dirname, '..'), PORT = 8791, PROJET = 'demo-gtm-groupe', DOM = '@tek-trend.app', MDP = 'Test2026ok';
const SITE = `http://localhost:${PORT}/index.html`, SDK = path.join(__dirname, 'node_modules', 'firebase');
const RESEAU = {offline:false, latency:150, downloadThroughput:1.6 * 1024 * 1024 / 8, uploadThroughput:750 * 1024 / 8}; // « Slow 4G »
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'application/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json'};
const CONFIG = `const firebaseConfig = {apiKey:'demo-cle', authDomain:'localhost', databaseURL:'http://127.0.0.1:9000?ns=${PROJET}', projectId:'${PROJET}'};
(function(){ const init = firebase.initializeApp.bind(firebase); firebase.initializeApp = function(c, n){ const app = init(c, n);
  try { app.auth().useEmulator('http://127.0.0.1:9099', {disableWarnings:true}); } catch(e) {} try { app.database().useEmulator('127.0.0.1', 9000); } catch(e) {} return app; }; })();`;

// Serveur statique avec compression gzip (comme GitHub Pages), cache 10 minutes.
function serveur(){
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if(p.endsWith('/')) p += 'index.html';
    if(p === '/firebase-config.js'){ res.writeHead(200, {'Content-Type':'application/javascript'}); return res.end(CONFIG); }
    const f = path.join(RACINE, path.normalize(p));
    if(!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end(); }
    const corps = fs.readFileSync(f), gz = /gzip/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, Object.assign({'Content-Type':TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control':'max-age=600'}, gz ? {'Content-Encoding':'gzip'} : {}));
    res.end(gz ? zlib.gzipSync(corps) : corps);
  }).listen(PORT);
}
async function contexte(b){
  const ctx = await b.newContext({viewport:{width:412, height:900}, userAgent:'Mozilla/5.0 (Linux; Android 14; Redmi Note 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', isMobile:true, hasTouch:true});
  await ctx.route(u => { const s = String(u); return !(s.startsWith('http://localhost') || s.startsWith('http://127.0.0.1')); }, rt => {
    const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url());
    if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType:'application/javascript', body:fs.readFileSync(path.join(SDK, m[1]), 'utf8')});
    return rt.abort();
  });
  return ctx;
}
async function page(ctx){
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', RESEAU);
  p.erreurs = []; p.on('pageerror', e => p.erreurs.push(e.message));
  if(process.env.MESURES_DEBUG){ p.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 160))); p.on('requestfailed', r => console.log('[échec]', r.url().slice(0, 120), r.failure() && r.failure().errorText)); }
  return p;
}
async function ecranConnexion(p){
  const t = Date.now(); await p.goto(SITE, {waitUntil:'commit'}); await p.waitForSelector('#login-user', {timeout:120000}); return Date.now() - t;
}
async function connexion(p, role){
  await p.fill('#login-user', role.replace(/_/g, '')); await p.fill('#login-pass', MDP);
  const t = Date.now(); await p.click('#login-form button[type=submit]');
  await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user')
    && typeof firebaseDossiersLisibles === 'function' && typeof hlDossiersCharges !== 'undefined' && firebaseDossiersLisibles().every(s => hlDossiersCharges.has(s))
    && document.getElementById('app') && (document.getElementById('app').innerText.trim().length > 20 || !!document.getElementById('mgt-crm-frame')), null, {timeout:120000, polling:100});
  return Date.now() - t;
}
async function ouvrirCadre(p, js, motif, pret){
  const t = Date.now(); await p.evaluate(js);
  let fr = null; for(let i = 0; i < 1200 && !fr; i++){ fr = p.frames().find(f => motif.test(f.url())); if(!fr) await p.waitForTimeout(100); }
  if(!fr) throw new Error('cadre introuvable ' + motif);
  await fr.waitForLoadState('load', {timeout:120000}); await fr.waitForFunction(pret, null, {timeout:120000, polling:100});
  return Date.now() - t;
}

(async () => {
  admin.initializeApp({projectId:PROJET, databaseURL:`http://127.0.0.1:9000?ns=${PROJET}`});
  const comptes = {};
  for(const r of C.ORDRE){
    const u = await admin.auth().createUser({email:r.replace(/_/g, '') + DOM, password:MDP});
    const d = C.ROLES[r]; comptes[u.uid] = {nom:d.label, username:r.replace(/_/g, ''), role:d.role, profil:r, groupe:!!d.groupe, societes:d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  const svf = process.env.GTM_SAUVEGARDE, reelles = !!(svf && fs.existsSync(svf));
  if(reelles){ const sv = JSON.parse(fs.readFileSync(svf, 'utf8')), g1 = sv.groupe1 || sv; ['tek', 'liaison', 'gadh', 'mgt'].forEach(k => { if(g1[k]) base.groupe1[k] = g1[k]; }); }
  await admin.database().ref('/').set(base);
  const regles = fs.readFileSync(path.join(RACINE, 'database.rules.v2.json'), 'utf8');
  await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method:'PUT', headers:{Authorization:'Bearer owner'}, body:regles});

  const srv = serveur(), b = await chromium.launch(), M = {donnees:reelles ? 'réelles (sauvegarde)' : 'données d\'essai', roles:{}};
  try {
    // 1) Écran de connexion : premier chargement (rien en cache) puis rechargement (cache + service worker)
    const ctx = await contexte(b), p = await page(ctx);
    M.connexionPremier = await ecranConnexion(p);
    await p.waitForTimeout(6000); // laisse le service worker s'installer et remplir le cache
    M.connexionCache = await ecranConnexion(p);
    // 2) Accueil de chaque rôle (cache chaud, comme un téléphone qui a déjà ouvert l'application)
    for(const r of C.ORDRE){
      const q = await page(ctx); await ecranConnexion(q);
      try { M.roles[r] = await connexion(q, r); } catch(e) { M.roles[r] = 'échec : ' + e.message.slice(0, 60); }
      if(r === 'sysadmin' && typeof M.roles[r] === 'number'){
        M.crmPremier = await ouvrirCadre(q, () => kpiAller('mgt', 'mgt'), /mgt-crm-app\.html/, () => !!document.querySelector('.pilotagePanel') && document.body.innerText.length > 300);
        await q.evaluate(() => { location.reload(); }); await q.waitForSelector('#app', {timeout:120000}); await q.waitForTimeout(3000);
        await q.evaluate(() => { try { switchSociete(); } catch(e) {} });
        M.suiviPremier = await ouvrirCadre(q, () => kpiAller('tek', 'commandes', 'commandes-home'), /suivi-commandes\.html/, () => typeof S !== 'undefined' && document.body.innerText.length > 200);
        await q.evaluate(() => { try { switchSociete(); } catch(e) {} }); await q.waitForTimeout(500);
        M.crmCache = await ouvrirCadre(q, () => kpiAller('mgt', 'mgt'), /mgt-crm-app\.html/, () => !!document.querySelector('.pilotagePanel') && document.body.innerText.length > 300);
      }
      if(q.erreurs.length) M.roles[r + ' (erreurs)'] = q.erreurs.join(' | ').slice(0, 200);
      await q.evaluate(() => { try { logout(); } catch(e) {} }).catch(() => {}); await q.waitForTimeout(800);
      await q.close();
    }
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(__dirname, 'mesures.json'), JSON.stringify(M, null, 2));
  const s = (v) => typeof v === 'number' ? (v / 1000).toFixed(1) + ' s' : v;
  console.log(`Mesures (téléphone lent simulé, ${M.donnees}) :`);
  console.log('  Écran de connexion, premier chargement :', s(M.connexionPremier));
  console.log('  Écran de connexion, avec cache        :', s(M.connexionCache));
  Object.entries(M.roles).forEach(([r, v]) => console.log('  Accueil après connexion, ' + r.padEnd(16) + ':', s(v)));
  console.log('  CRM MGT, première ouverture           :', s(M.crmPremier));
  console.log('  CRM MGT, ouverture avec cache         :', s(M.crmCache));
  console.log('  Suivi PERCKO, première ouverture      :', s(M.suiviPremier));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
