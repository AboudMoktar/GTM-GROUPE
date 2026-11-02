#!/usr/bin/env node
// ============================================================
// Essai de la politique de sécurité (Content-Security-Policy) SANS la publier :
// la politique est envoyée en en-tête « Content-Security-Policy-Report-Only » sur index.html,
// mgt-crm-app.html et suivi-commandes.html, et chaque violation est relevée (rien n'est bloqué).
// Lancement (dans tests/) : npm run csp        (émulateurs ; le script sert lui-même l'application sur le port 8792)
//   CSP_MODE=meta : vérifie au contraire la balise <meta> réellement présente dans les pages (politique active).
// Parcours : connexion de chaque rôle (navigateur Android), CRM MGT, suivi PERCKO (TEK et GADH),
// impression, export Excel et téléchargement, mode hors ligne, Firebase en « long polling » (WebSocket bloqué).
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const fs = require('fs'), path = require('path');
const serveur = require('./serveur.js');
const admin = require('./admin.js');
const {chromium} = require('playwright');
const C = require('../roles-config.js');
const {donneesInitiales} = require('./scenarios.js');

const PROJET = 'demo-gtm-groupe', DOM = '@tek-trend.app', MDP = 'Test2026ok', PORT = 8792, ORIGINE = `http://localhost:${PORT}`, SITE = ORIGINE + '/index.html', RACINE = path.join(__dirname, '..');
const SDK = path.join(__dirname, 'node_modules', 'firebase'), XLSX_LOCAL = path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');
const MODE = process.env.CSP_MODE === 'meta' ? 'meta' : 'essai';
// La politique est lue dans tests/csp-politique.txt (même texte que la balise <meta> des 3 pages).
const POLITIQUE = serveur.POLITIQUE;
// Remplace apis.google.com/js/api.js (inaccessible ici) : ouvre le cadre de connexion Firebase comme le vrai chargeur gapi.
const GAPI_SIMULE = `(function(){var ifr={register:function(){},ping:function(){return Promise.resolve()},restyle:function(){},send:function(a,b,c){c&&c([])}};window.gapi={load:function(n,o){var cb=typeof o==='function'?o:(o&&o.callback);setTimeout(function(){cb&&cb();},0);},iframes:{CROSS_ORIGIN_IFRAMES_FILTER:{},getContext:function(){return{open:function(o,cb){var f=document.createElement('iframe');f.src=o.url;(o.where||document.body).appendChild(f);cb&&cb(ifr);return ifr;}};}}};var m=/onload=([^&]+)/.exec(document.currentScript&&document.currentScript.src||'');if(m&&window[m[1]])window[m[1]]();})();`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Redmi Note 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

const violations = [], cadresAuth = new Set();
function noter(ou, v){ violations.push(Object.assign({ou}, v)); }
async function contexte(b, opts){
  const android = !!(opts && opts.android);
  const ctx = await b.newContext(Object.assign({viewport:{width:412, height:900}, acceptDownloads:true}, android ? {userAgent:ANDROID, isMobile:true, hasTouch:true} : {}));
  await ctx.addInitScript(() => { try { delete window.showSaveFilePicker; } catch(e) {} window.showSaveFilePicker = undefined; });
  await ctx.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => { try { (window.__csp = window.__csp || []).push({d:e.effectiveDirective || e.violatedDirective, u:e.blockedURI, s:(e.sourceFile || '').split('/').pop() + ':' + e.lineNumber}); console.log('[CSP] ' + JSON.stringify({d:e.effectiveDirective || e.violatedDirective, u:e.blockedURI, s:(e.sourceFile || '').split('/').pop() + ':' + e.lineNumber, p:location.pathname})); } catch(x) {} }, true);
  });
  if(opts && opts.sansWebSocket) await ctx.addInitScript(() => { try { Object.defineProperty(window, 'WebSocket', {value:undefined, configurable:true}); Object.defineProperty(window, 'MozWebSocket', {value:undefined, configurable:true}); } catch(e) {} });
  await ctx.route(u => { const s = String(u); return !(s.startsWith('http://localhost') || s.startsWith('http://127.0.0.1')); }, rt => {
    const url = rt.request().url(), m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(url);
    if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType:'application/javascript', body:fs.readFileSync(path.join(SDK, m[1]), 'utf8')});
    if(/apis\.google\.com\/js\/api\.js/.test(url)) return rt.fulfill({contentType:'application/javascript', body:GAPI_SIMULE});
    if(/xlsx\.full\.min\.js$/.test(url) && fs.existsSync(XLSX_LOCAL)) return rt.fulfill({contentType:'application/javascript', body:fs.readFileSync(XLSX_LOCAL, 'utf8')});
    return rt.abort();
  });
  ctx.on('page', p => {
    p.on('console', m => { const t = m.text(); if(t.startsWith('[CSP] ')) noter(p.__ou || 'fenêtre', JSON.parse(t.slice(6))); else if(/Content Security Policy/i.test(t)) noter(p.__ou || 'fenêtre', {d:'console', u:t.slice(0, 160)}); });
    p.on('frameattached', f => setTimeout(() => { try { const u = f.url(); if(/__\/auth\/iframe|emulator\/auth\/iframe|firebaseapp\.com/.test(u)) cadresAuth.add(u.split('?')[0]); } catch(e) {} }, 1500));
    p.on('framenavigated', f => { const u = f.url(); if(/__\/auth\/iframe|emulator\/auth\/iframe|firebaseapp\.com/.test(u)) cadresAuth.add(u.split('?')[0]); });
  });
  return ctx;
}
async function connecter(p, role){
  await p.goto(SITE); await p.waitForSelector('#login-user', {timeout:30000});
  await p.fill('#login-user', role.replace(/_/g, '')); await p.fill('#login-pass', MDP);
  await p.click('#login-form button[type=submit]');
  await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout:30000});
  await p.waitForTimeout(2500);
}
async function cadre(p, js, motif){
  await p.evaluate(js); let fr = null;
  for(let i = 0; i < 100 && !fr; i++){ fr = p.frames().find(f => motif.test(f.url())); if(!fr) await p.waitForTimeout(100); }
  if(fr){ await fr.waitForLoadState('load').catch(() => {}); await p.waitForTimeout(2500); }
  return !!fr;
}

(async () => {
  admin.initializeApp({projectId:PROJET, databaseURL:`http://127.0.0.1:9000?ns=${PROJET}`});
  const comptes = {};
  for(const r of C.ORDRE){
    const u = await admin.auth().createUser({email:r.replace(/_/g, '') + DOM, password:MDP});
    const d = C.ROLES[r]; comptes[u.uid] = {nom:d.label, username:r.replace(/_/g, ''), role:d.role, profil:r, groupe:!!d.groupe, societes:d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  await admin.database().ref('/').set(base);
  await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method:'PUT', headers:{Authorization:'Bearer owner'}, body:fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  if(MODE === 'meta'){ // la balise des 3 pages doit être exactement la politique de tests/csp-politique.txt
    for(const f of ['index.html', 'mgt-crm-app.html', 'suivi-commandes.html']){
      const m = serveur.META.exec(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
      if(!m || m[2] !== POLITIQUE){ console.log('Balise CSP absente ou différente de csp-politique.txt dans ' + f); process.exit(1); }
    }
  }
  const srv = serveur.demarrer(PORT, {essai: MODE === 'essai'}), b = await chromium.launch(), etapes = [];
  const etape = async (nom, fn) => { const avant = violations.length; let err = ''; try { await fn(); } catch(e) { err = e.message.split('\n')[0].slice(0, 120); } etapes.push({nom, err, v:violations.length - avant}); };
  try {
    // 1) Chaque rôle
    for(const r of C.ORDRE) await etape('Connexion ' + r, async () => { const ctx = await contexte(b), p = await ctx.newPage(); p.__ou = r; await connecter(p, r); await ctx.close(); });
    // 1 bis) Téléphone Android : Firebase charge apis.google.com et ouvre son cadre de connexion
    await etape('Connexion sur Android (cadre de connexion Firebase)', async () => { const ctx = await contexte(b, {android:true}), p = await ctx.newPage(); p.__ou = 'Android'; await connecter(p, 'agent_chaine'); await p.waitForTimeout(2000); await ctx.close(); if(!cadresAuth.size) throw new Error('aucun cadre de connexion ouvert'); });
    // 2) Administrateur : CRM, suivi TEK et GADH, impression, Excel, téléchargement, puis hors ligne
    const ctx = await contexte(b), p = await ctx.newPage(); p.__ou = 'sysadmin (parcours)';
    await etape('Connexion administrateur', () => connecter(p, 'sysadmin'));
    await etape('CRM MGT', async () => { if(!await cadre(p, () => kpiAller('mgt', 'mgt'), /mgt-crm-app\.html/)) throw new Error('CRM non ouvert'); });
    await etape('Suivi PERCKO (TEK-TREND)', async () => { await p.evaluate(() => { location.hash = ''; switchSociete(); }); await p.waitForTimeout(800); if(!await cadre(p, () => kpiAller('tek', 'commandes', 'commandes-home'), /suivi-commandes\.html\?vue=tek/)) throw new Error('suivi non ouvert'); });
    await etape('Suivi PERCKO (GADH)', async () => { await p.evaluate(() => switchSociete()); await p.waitForTimeout(800); if(!await cadre(p, () => kpiAller('gadh', 'gadh', 'commandes-home'), /suivi-commandes\.html\?vue=gadh/)) throw new Error('suivi GADH non ouvert'); });
    await etape('Impression (fiche PDF)', async () => { await p.evaluate(() => switchSociete()); const pop = p.waitForEvent('popup', {timeout:10000}); await p.evaluate(() => rpTekJourPdf(getTodayISO())); const w = await pop; w.__ou = 'fenêtre d\'impression'; await w.waitForLoadState('load'); await p.waitForTimeout(1500); await w.close().catch(() => {}); });
    await etape('Export Excel + téléchargement blob:', async () => { const dl = p.waitForEvent('download', {timeout:20000}); await p.evaluate(() => rpTekJourExcel(getTodayISO())); await dl; });
    await etape('Rapport PERCKO (suivi : PDF + Excel)', async () => { await p.evaluate(() => kpiAller('tek', 'commandes', 'commandes-home')); await p.waitForTimeout(2500); const fr = p.frames().find(f => /suivi-commandes/.test(f.url())); if(!fr) throw new Error('suivi absent'); await fr.evaluate(() => { const lot = Object.keys(S.lots || {})[0] || ''; try { pdfBuild(fluxSheets(lot).map(x => x.grid)); xlsxBuild(fluxSheets(lot)); } catch(e) {} }); });
    await etape('Hors ligne (service worker)', async () => { await p.waitForTimeout(4000); await ctx.setOffline(true); const q = await ctx.newPage(); q.__ou = 'hors ligne'; await q.goto(SITE); await q.waitForSelector('#app', {timeout:20000}); await q.waitForTimeout(2500); const s = await ctx.newPage(); s.__ou = 'hors ligne (suivi)'; await s.goto(ORIGINE + '/suivi-commandes.html?vue=tek'); await s.waitForTimeout(2500); await ctx.setOffline(false); });
    await ctx.close();
    // 3) Firebase en « long polling » (WebSocket indisponible, comme sur certains réseaux mobiles)
    await etape('Long polling (WebSocket bloqué)', async () => { const c2 = await contexte(b, {sansWebSocket:true}), q = await c2.newPage(); q.__ou = 'long polling'; let lp = 0; q.on('request', r => { if(/\/\.lp\?/.test(r.url())) lp++; }); await connecter(q, 'responsable'); if(!lp) throw new Error('long polling non utilisé'); await c2.close(); });
  } finally { await b.close(); srv.close(); }
  const uniques = {}; violations.forEach(v => { const k = v.d + ' ' + (v.u || ''); (uniques[k] = uniques[k] || {n:0, ou:new Set(), s:v.s}).n++; uniques[k].ou.add(v.ou); });
  console.log(`CSP (${MODE === 'meta' ? 'balise <meta> active' : 'essai en Report-Only'}) — parcours :`);
  etapes.forEach(e => console.log(`  ${e.err ? 'ÉCHEC' : 'ok   '} ${e.nom}${e.v ? ' · ' + e.v + ' violation(s)' : ''}${e.err ? ' — ' + e.err : ''}`));
  console.log('Cadres de connexion Firebase ouverts :', cadresAuth.size ? Array.from(cadresAuth).join(' · ') : 'aucun');
  const liste = Object.entries(uniques);
  console.log(`Violations distinctes : ${liste.length}`);
  liste.forEach(([k, v]) => console.log(`  - ${k} (×${v.n}, ${Array.from(v.ou).slice(0, 3).join(', ')}${v.s ? ', ' + v.s : ''})`));
  process.exit(liste.length || etapes.some(e => e.err) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
