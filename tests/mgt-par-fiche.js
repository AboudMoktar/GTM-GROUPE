#!/usr/bin/env node
// CRM MGT rangé fiche par fiche : conversion de l'ancien bloc, écritures partielles, deux appareils,
// suppressions, hors ligne avec renvoi au redémarrage, trafic mesuré. Données d'essai, émulateurs.
// Lancement (dans tests/) : npm run mgt-par-fiche
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const path = require('path'), fs = require('fs');
const {chromium} = require('playwright'); const admin = require('./admin.js'); const C = require(path.join(__dirname, '..', 'roles-config.js')); const serveur = require('./serveur.js');
const SDK = path.join(__dirname, 'node_modules', 'firebase'), MDP = 'Test2026ok', PROJET = 'demo-gtm-groupe';
const J = (v) => '__gtm_json_v1:' + JSON.stringify(v);
const decoder = (v) => typeof v === 'string' ? JSON.parse(v.slice(14)) : Object.keys(v || {}).filter(k => v[k]).map(k => JSON.parse(v[k].slice(14)));
const nbFiches = (v) => Object.keys(v || {}).filter(k => v[k]).length;
const N = 300;
const clients = Array.from({length: N}, (_, i) => ({ID: String(i + 1), Societe: 'Société ' + (i + 1), 'Gouvernorat / Zone': 'Tunis', Offres: i % 3 ? [] : [{offerId: 'O' + i, amount: 1000 + i, note: 'x'.repeat(400)}], Planning: [], Notes: 'n'.repeat(600)}));
const histo = Array.from({length: 120}, (_, i) => ({id: 'H' + i, entity_type: 'CLIENT', entity_id: String(i + 1), event_type: 'VISITE_COMMERCIALE', subject: 'Visite ' + i, _updated_at: '2026-11-01T10:00:00Z'}));
(async () => {
  admin.initializeApp({projectId: PROJET, databaseURL: `http://127.0.0.1:9000?ns=${PROJET}`});
  const users = {};
  for(const r of ['technico_mgt', 'secretaire_mgt']){ const u = await admin.auth().createUser({email: r.replace(/_/g, '') + '@tek-trend.app', password: MDP}), d = C.ROLES[r]; users[u.uid] = {nom: d.label, username: r.replace(/_/g, ''), role: d.role, profil: r, groupe: !!d.groupe, societes: d.societes}; }
  await admin.database().ref('/groupe1').set({mgt: {mgt_crm_clients: J(clients), mgt_crm_history: J(histo), mgt_crm_settings: J([{key: 'x', value: '1'}])}, users_v2: users});
  await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const srv = serveur.demarrer(8790), b = await chromium.launch(), r = [], err = [];
  const base = async (k) => (await admin.database().ref('/groupe1/mgt/' + k).once('value')).val();
  async function appareil(login){
    const ctx = await b.newContext({serviceWorkers: 'block'});
    await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')}); return rt.abort(); });
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable');
    p.ws = {recu: 0, envoye: 0}; cdp.on('Network.webSocketFrameReceived', e => { p.ws.recu += Buffer.byteLength(e.response.payloadData || ''); }); cdp.on('Network.webSocketFrameSent', e => { p.ws.envoye += Buffer.byteLength(e.response.payloadData || ''); });
    p.on('pageerror', e => err.push(login + ' : ' + e.message));
    await p.goto('http://localhost:8790/index.html'); await p.waitForSelector('#login-user');
    await p.fill('#login-user', login); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && typeof gtmDonneesPretes === 'function' && gtmDonneesPretes('mgt_crm_clients') && gtmDonneesPretes('mgt_crm_history'), null, {timeout: 60000});
    await p.waitForTimeout(1500); p.ctx = ctx; return p;
  }
  const modifier = (p, id, champ, val) => p.evaluate(([id, champ, val]) => { const l = getJSON('mgt_crm_clients', []); const i = l.findIndex(c => c.ID === id); l[i] = Object.assign({}, l[i], {[champ]: val}); return setJSON('mgt_crm_clients', l); }, [id, champ, val]);
  const lireLocal = (p, id) => p.evaluate((id) => (getJSON('mgt_crm_clients', []).find(c => c.ID === id) || {}), id);
  const A = await appareil('technicomgt'), B = await appareil('secretairemgt');
  r.push(['ancien bloc lu correctement', (await A.evaluate(() => getJSON('mgt_crm_clients', []).length)) === N && (await lireLocal(B, '7')).Societe === 'Société 7']);
  // 1re écriture : conversion au rangement fiche par fiche
  await modifier(A, '1', 'Societe', 'Société 1 modifiée'); await A.waitForTimeout(3000);
  let v = await base('mgt_crm_clients');
  r.push(['converti fiche par fiche à la 1re écriture', v && typeof v === 'object' && nbFiches(v) === N]);
  r.push(['contenu identique après conversion (listes vides, champs « / »)', JSON.stringify(decoder(v).sort((a, b) => +a.ID - +b.ID)) === JSON.stringify(clients.map(c => c.ID === '1' ? Object.assign({}, c, {Societe: 'Société 1 modifiée'}) : c))]);
  r.push(['l\'autre appareil voit la modification', (await lireLocal(B, '1')).Societe === 'Société 1 modifiée']);
  // écriture d'une seule fiche : trafic
  A.ws = {recu: 0, envoye: 0}; B.ws = {recu: 0, envoye: 0};
  await modifier(A, '2', 'Notes', 'Nouvelle note'); await A.waitForTimeout(3000);
  r.push(['1 fiche modifiée : envoi < 10 Ko', A.ws.envoye < 10240]); r.push(['1 fiche modifiée : réception par l\'autre appareil < 10 Ko', B.ws.recu < 10240]);
  console.log('   trafic d\'une fiche :', Math.round(A.ws.envoye / 1024 * 10) / 10, 'Ko envoyés,', Math.round(B.ws.recu / 1024 * 10) / 10, 'Ko reçus');
  r.push(['modification reçue', (await lireLocal(B, '2')).Notes === 'Nouvelle note']);
  // deux appareils, deux fiches différentes, en même temps
  await Promise.all([modifier(A, '10', 'Notes', 'par A'), modifier(B, '11', 'Notes', 'par B')]); await A.waitForTimeout(3000);
  v = decoder(await base('mgt_crm_clients'));
  r.push(['modifications simultanées de 2 fiches : les deux gardées', v.find(c => c.ID === '10').Notes === 'par A' && v.find(c => c.ID === '11').Notes === 'par B']);
  // un appareil en retard ne défait pas la modification d'un autre
  await B.ctx.setOffline(true); await modifier(A, '20', 'Notes', 'récente par A'); await A.waitForTimeout(1500);
  await modifier(B, '21', 'Notes', 'par B hors ligne'); await B.ctx.setOffline(false); await B.waitForTimeout(5000);
  v = decoder(await base('mgt_crm_clients'));
  r.push(['appareil en retard : la fiche modifiée ailleurs n\'est pas écrasée', v.find(c => c.ID === '20').Notes === 'récente par A' && v.find(c => c.ID === '21').Notes === 'par B hors ligne']);
  // ajout et suppression
  await A.evaluate(() => { const l = getJSON('mgt_crm_clients', []).filter(c => c.ID !== '3'); l.push({ID: 'N999', Societe: 'Nouveau', Offres: []}); setJSON('mgt_crm_clients', l); }); await A.waitForTimeout(3000);
  v = await base('mgt_crm_clients');
  r.push(['ajout d\'une fiche', !!v.N999 && JSON.parse(v.N999.slice(14)).Societe === 'Nouveau']);
  r.push(['suppression d\'une fiche', !v['3'] && nbFiches(v) === N]);
  r.push(['suppression reçue par l\'autre appareil', (await B.evaluate(() => getJSON('mgt_crm_clients', []).some(c => c.ID === '3'))) === false]);
  // hors ligne puis fermeture : renvoi au redémarrage
  await B.ctx.setOffline(true); await modifier(B, '30', 'Notes', 'saisie hors ligne'); await B.waitForTimeout(500);
  const q = await B.ctx.newPage(); await B.close(); await B.ctx.setOffline(false);
  q.on('pageerror', e => err.push('redémarrage : ' + e.message));
  await q.goto('http://localhost:8790/index.html'); await q.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && typeof gtmDonneesPretes === 'function' && gtmDonneesPretes('mgt_crm_clients'), null, {timeout: 60000}); await q.waitForTimeout(6000);
  v = decoder(await base('mgt_crm_clients'));
  r.push(['saisie hors ligne renvoyée au redémarrage', v.find(c => c.ID === '30').Notes === 'saisie hors ligne']);
  r.push(['renvoi sans écraser les autres fiches', v.find(c => c.ID === '20').Notes === 'récente par A' && v.length === N]);
  // historique aussi fiche par fiche
  await A.evaluate(() => { const h = getJSON('mgt_crm_history', []); h.push({id: 'H999', entity_id: '1', subject: 'Nouvelle visite'}); setJSON('mgt_crm_history', h); }); await A.waitForTimeout(3000);
  const hv = await base('mgt_crm_history');
  r.push(['historique rangé fiche par fiche', hv && typeof hv === 'object' && !!hv.H999 && nbFiches(hv) === 121]);
  // les autres données du CRM restent en un bloc
  r.push(['réglages inchangés (un bloc)', typeof (await base('mgt_crm_settings')) === 'string']);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); srv.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
