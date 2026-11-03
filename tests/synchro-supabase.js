#!/usr/bin/env node
// Synchronisation CRM Supabase (associé) -> CRM MGT de GTM : faux Supabase (aucun accès réseau), émulateurs Firebase.
// Lancement (dans tests/) : npm run synchro
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const path = require('path'), fs = require('fs');
const TESTS = __dirname, req = require;
const {chromium} = req('playwright'); const admin = require(TESTS + '/admin.js'); const C = require(path.join(__dirname, '..', 'roles-config.js')); const serveur = require(TESTS + '/serveur.js');
const SDK = path.join(TESTS, 'node_modules', 'firebase'), MDP = 'Test2026ok';
const J = (v) => '__gtm_json_v1:' + JSON.stringify(v);
const lireArr = (v) => typeof v === 'string' && v.startsWith('__gtm_json_v1:') ? JSON.parse(v.slice(14)) : (v || []);
// ----- faux Supabase -----
const SB = {
  mgt_clients: [
    {id:'1', data:{ID:'1', Societe:'Alpha modifié chez l\'associé'}, updated_at:'2026-11-02T10:00:00.123456+00:00', deleted_at:null},
    {id:'2', data:{ID:'2', Societe:'Beta ancienne version'}, updated_at:'2026-11-02T09:00:00+00:00', deleted_at:null},
    {id:'4', data:{ID:'4', Societe:'Delta (nouveau)', Offres:[{offerId:'O1', amount:1000}]}, updated_at:'2026-11-02T12:00:00+00:00', deleted_at:null},
    {id:'3', data:{ID:'3', Societe:'Gamma'}, updated_at:'2026-11-02T11:00:00+00:00', deleted_at:'2026-11-02T11:00:00+00:00'}],
  crm_history: [{id:'H1', entity_type:'CLIENT', entity_id:'4', event_type:'VISITE_COMMERCIALE', subject:'Visite Delta', _updated_at:'2026-11-02T12:05:00+00:00', _deleted_at:null}],
  crm_settings: [{key:'clients_last_sync', value:'x', updated_at:'2026-11-02T12:00:00+00:00'}, {key:'objectif_visites', value:'12', updated_at:'2026-11-02T12:00:00+00:00'}],
  crm_tags: [{id:'T1', name:'VIP', color:'#f00'}], crm_history_tags: [{history_id:'H1', tag_id:'T1'}]
};
const appels = [];
async function fauxSupabase(rt){
  const u = new URL(rt.request().url()); appels.push(u.pathname + u.search);
  if(u.pathname === '/auth/v1/token'){ const b = JSON.parse(rt.request().postData() || '{}'); return b.email === 'gtm@mgt.local' && b.password === 'Secret123' ? rt.fulfill({status:200, contentType:'application/json', body:JSON.stringify({access_token:'jeton', expires_in:3600})}) : rt.fulfill({status:400, contentType:'application/json', body:'{"error":"invalid_grant"}'}); }
  if(rt.request().headers()['authorization'] !== 'Bearer jeton') return rt.fulfill({status:401, body:'{}'});
  const table = u.pathname.replace('/rest/v1/', ''); let rows = (SB[table] || []).slice();
  for(const [k, v] of u.searchParams){ if(v.startsWith('gt.')){ const x = Date.parse(decodeURIComponent(v.slice(3))); rows = rows.filter(r => Date.parse(r[k]) > x); } }
  const off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || 1000);
  return rt.fulfill({status:200, contentType:'application/json', body:JSON.stringify(rows.slice(off, off + lim))});
}
(async () => {
  admin.initializeApp({projectId: 'demo-gtm-groupe', databaseURL: 'http://127.0.0.1:9000?ns=demo-gtm-groupe'});
  const u = await admin.auth().createUser({email: 'sysadmin@tek-trend.app', password: MDP}), d = C.ROLES.sysadmin;
  const u2 = await admin.auth().createUser({email: 'technicomgt@tek-trend.app', password: MDP}), d2 = C.ROLES.technico_mgt;
  const locaux = [{ID:'1', Societe:'Alpha', _updated_at:'2026-11-01T10:00:00.000Z'}, {ID:'2', Societe:'Beta modifié dans GTM', _updated_at:'2026-11-03T12:00:00.000Z'}, {ID:'3', Societe:'Gamma'}];
  await admin.database().ref('/groupe1').set({mgt: {mgt_crm_clients: J(locaux), mgt_crm_settings: J([{key:'objectif_visites', value:'5', updated_at:'2026-10-01T00:00:00Z'}, {key:'gtm_sb_config', value:JSON.stringify({url:'https://ancien.supabase.co', key:'sb_publishable_ancien', login:'ancien', pw:'ancien'}), updated_at:'2026-10-01T00:00:00Z'}])}, users_v2: {[u.uid]: {nom: d.label, username: 'sysadmin', role: d.role, profil: 'sysadmin', groupe: true, societes: d.societes}, [u2.uid]: {nom: d2.label, username: 'technicomgt', role: d2.role, profil: 'technico_mgt', groupe: false, societes: d2.societes}}});
  await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-gtm-groupe', {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const s = serveur.demarrer(8790), b = await chromium.launch(), ctx = await b.newContext({serviceWorkers: 'block', viewport:{width:1280, height:900}});
  await ctx.route('https://test.supabase.co/**', fauxSupabase);
  await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1') || t.startsWith('https://test.supabase.co')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')}); return rt.abort(); });
  const p = await ctx.newPage(); const err = [], csp = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', x => x.accept());
  p.on('console', m => { if(/Content Security Policy|Refused to connect/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
  await p.goto('http://localhost:8790/index.html'); await p.waitForSelector('#login-user');
  await p.fill('#login-user', 'sysadmin'); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
  await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await p.waitForTimeout(2500);
  await p.evaluate(() => { try { kpiAller('mgt', 'mgt'); } catch(e) {} });
  let fr = null; for(let i = 0; i < 200 && !fr; i++){ fr = p.frames().find(f => /mgt-crm-app/.test(f.url())); if(!fr) await p.waitForTimeout(100); }
  fr.on && 0; await fr.waitForLoadState('load'); await p.waitForTimeout(5000);
  fr.page().on('pageerror', e => err.push('crm: ' + e.message));
  const r = [];
  await fr.evaluate(() => openModule('settings')); await p.waitForTimeout(800);
  r.push(['carte de réglage affichée pour l\'administrateur', await fr.locator('#gtmSbCarte').count() === 1]);
  await p.waitForTimeout(1500);
  { const g0 = (await admin.database().ref('/groupe1/mgt').once('value')).val(); r.push(['ancien réglage partagé retiré de Firebase', !lireArr(g0.mgt_crm_settings).some(x => x.key === 'gtm_sb_config')]); }
  r.push(['ancien réglage repris sur l\'appareil', await fr.evaluate(() => { try { return JSON.parse(localStorage.getItem('gtm_sb_config_v1')).login === 'ancien'; } catch(e) { return false; } })]);
  // mauvais mot de passe
  await fr.fill('#gtmSbUrl', 'https://test.supabase.co'); await fr.fill('#gtmSbKey', 'sb_publishable_test'); await fr.fill('#gtmSbLogin', 'gtm'); await fr.fill('#gtmSbPw', 'faux');
  await fr.click('#gtmSbEnr'); await p.waitForTimeout(2500);
  r.push(['mauvais mot de passe signalé', /refusé/.test(await fr.locator('#gtmSbEtat').textContent())]);
  // clé secrète refusée
  await fr.fill('#gtmSbKey', 'sb_secret_xxx'); await fr.fill('#gtmSbPw', 'Secret123'); await fr.click('#gtmSbEnr'); await p.waitForTimeout(500);
  r.push(['clé secrète refusée', /refusée/.test(await fr.locator('#gtmSbEtat').textContent())]);
  await fr.fill('#gtmSbKey', 'sb_publishable_test'); await fr.fill('#gtmSbPw', 'Secret123'); await fr.click('#gtmSbEnr'); await p.waitForTimeout(4000);
  const etat1 = await fr.locator('#gtmSbEtat').textContent(); console.log('état :', etat1);
  let g = (await admin.database().ref('/groupe1/mgt').once('value')).val(), cl = lireArr(g.mgt_crm_clients), parId = Object.fromEntries(cl.map(c => [c.ID, c]));
  r.push(['client modifié chez l\'associé repris', parId['1'] && parId['1'].Societe === 'Alpha modifié chez l\'associé']);
  r.push(['modification plus récente de GTM conservée', parId['2'] && parId['2'].Societe === 'Beta modifié dans GTM']);
  r.push(['nouveau client ajouté avec ses offres', parId['4'] && parId['4'].Offres && parId['4'].Offres.length === 1]);
  r.push(['client supprimé chez l\'associé marqué supprimé', parId['3'] && !!parId['3']._deleted_at]);
  const hist = lireArr(g.mgt_crm_history), tags = lireArr(g.mgt_crm_tags), liens = lireArr(g.mgt_crm_history_tags), regl = lireArr(g.mgt_crm_settings);
  r.push(['historique repris', hist.some(h => h.id === 'H1')]);
  r.push(['étiquettes et liens repris', tags.some(t => t.id === 'T1') && liens.some(l => l.history_id === 'H1')]);
  r.push(['réglage repris', regl.some(x => x.key === 'objectif_visites' && x.value === '12')]);
  r.push(['réglage de synchronisation de l\'associé ignoré', !regl.some(x => x.key === 'clients_last_sync')]);
  r.push(['mot de passe absent du code de la page', !(await fr.content()).includes('Secret123')]);
  r.push(['compte Supabase absent de Firebase', !JSON.stringify((await admin.database().ref('/groupe1').once('value')).val()).includes('Secret123')]);
  // 2e synchronisation : seulement le nouveau
  appels.length = 0;
  SB.mgt_clients.push({id:'5', data:{ID:'5', Societe:'Epsilon'}, updated_at:'2026-11-03T15:00:00+00:00', deleted_at:null});
  const res2 = await fr.evaluate(() => window.gtmSbSynchroniser({manuel:true})); await p.waitForTimeout(1500);
  const appelClients = appels.find(a => a.startsWith('/rest/v1/mgt_clients')) || '';
  r.push(['2e synchro incrémentale (date dans la demande)', /updated_at=gt\./.test(appelClients)]);
  r.push(['2e synchro : 1 seule fiche', res2.ok && res2.res.clients === 1]);
  g = (await admin.database().ref('/groupe1/mgt').once('value')).val(); cl = lireArr(g.mgt_crm_clients);
  r.push(['nouveau client visible', cl.some(c => c.ID === '5')]);
  // 3e : rien de nouveau => aucune écriture
  const avant = JSON.stringify(g.mgt_crm_clients); const res3 = await fr.evaluate(() => window.gtmSbSynchroniser({})); await p.waitForTimeout(1000);
  g = (await admin.database().ref('/groupe1/mgt').once('value')).val();
  r.push(['rien de nouveau : base non réécrite', res3.ok && JSON.stringify(g.mgt_crm_clients) === avant && /rien de nouveau/.test(res3.msg)]);
  r.push(['liste à l\'écran à jour', await fr.evaluate(() => (typeof CLIENTS !== 'undefined' ? CLIENTS : []).some(c => String(c.ID) === '5'))]);
  // Un autre compte MGT : ni réglage ni synchronisation
  { const ctx2 = await b.newContext({serviceWorkers: 'block', viewport:{width:1280, height:900}}); let appelsT = 0;
    await ctx2.route('https://test.supabase.co/**', rt => { appelsT++; return fauxSupabase(rt); });
    await ctx2.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1') || t.startsWith('https://test.supabase.co')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')}); return rt.abort(); });
    const q = await ctx2.newPage(); q.on('pageerror', e => err.push('technico: ' + e.message));
    await q.goto('http://localhost:8790/index.html'); await q.waitForSelector('#login-user');
    await q.fill('#login-user', 'technicomgt'); await q.fill('#login-pass', MDP); await q.click('#login-form button[type=submit]');
    await q.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await q.waitForTimeout(2500);
    await q.evaluate(() => { try { kpiAller('mgt', 'mgt'); } catch(e) {} });
    let f2 = null; for(let i = 0; i < 200 && !f2; i++){ f2 = q.frames().find(f => /mgt-crm-app/.test(f.url())); if(!f2) await q.waitForTimeout(100); }
    await f2.waitForLoadState('load'); await q.waitForTimeout(5000);
    await f2.evaluate(() => openModule('settings')); await q.waitForTimeout(800);
    r.push(['autre compte : pas de réglage de synchronisation', await f2.locator('#gtmSbCarte').count() === 0]);
    const rt = await f2.evaluate(() => window.gtmSbSynchroniser({manuel:true}));
    r.push(['autre compte : aucune synchronisation', !rt.ok && appelsT === 0]);
    await ctx2.close(); }
  r.push(['aucune violation CSP', csp.length === 0]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err); if(csp.length) console.log(csp);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
