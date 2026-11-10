#!/usr/bin/env node
// CRM MGT : nouveautés V4.6.9J du CRM de l'associé — calendrier (moteur, vues Jour / Semaine / Mois / Année, catégories,
// impression et PDF, droits), prix de vente standard = prix catalogue (une seule écriture), export des offres
// (offre client sans prix d'achat, document interne avec marges) (données d'essai, émulateur).
// Lancement (dans tests/) : npm run mgt-v469
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
  const iso = (n) => { const x = new Date(Date.now() + n * 86400000); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const auj = iso(0), dem = iso(1);
  const art = (o) => J(Object.assign({famille: 'MACHINE', sousFamille: 'Général', dateMaj: '2026-02-20', _created_at: '2026-11-08T10:00:00Z', _updated_at: '2026-11-08T10:00:00Z', _origin: 'IMPORT_EXCEL'}, o));
  const ligne = {reference: 'M-100', designation: 'MACHINE ESSAI A', quantite: 2, prixVente: 1100, remise: 10, prixAchat: 600, articleId: 'ART-0001'};
  await admin.database().ref('/groupe1').set({mgt: {
    mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1,
      Planning: [{id: 'E1', date: auj, startTime: '09:00', endTime: '10:30', type: 'visite', priority: 'Moyenne', status: 'En attente', objective: 'Visite atelier', commercial: 'Ali'},
                 {id: 'E2', date: auj, type: 'sav', priority: 'Haute', status: 'En attente', objective: 'Dépannage presse', commercial: 'Ali'},
                 {id: 'E3', date: dem, startTime: '14:00', type: 'rapport', priority: 'Faible', status: 'En attente', objective: 'Rapport client', commercial: 'Ali'}],
      Offres: [{id: 'OF-1', number: 'OF026-001', type: 'devis', sentDate: auj, status: 'En attente', amount: 1980, lignes: [ligne]}]})},
    mgt_crm_listing: {'ART-0001': art({id: 'ART-0001', groupe: 'MACPI', marque: 'MACPI', categorie: 'MACHINES', reference: 'M-100', designation: 'MACHINE ESSAI A', prixCatalogue: 1000, remise: 0.4, prixAchat: 600, prixVente: 1200}),
      'ART-0002': art({id: 'ART-0002', groupe: 'MORGAN', marque: 'MORGAN', categorie: 'PIECES', reference: 'B-75-631', designation: 'ENCODER ESSAI', prixCatalogue: 200, prixAchat: 150, prixVente: 250}),
      'ART-0003': art({id: 'ART-0003', groupe: 'AUTRES', marque: 'LOTUS', categorie: 'MACHINES', reference: 'LTS 500', designation: 'PRESSE ESSAI', prixCatalogue: null, prixAchat: 5035, prixVente: 6000}),
      'ART-0004': art({id: 'ART-0004', groupe: 'MACPI', marque: 'MACPI', categorie: 'MACHINES', reference: 'M-200', designation: 'MACHINE ESSAI B', prixCatalogue: 700, prixAchat: 420, prixVente: 700})}},
    users_v2: {[u.uid]: {nom: d.label, username: 'sysadmin', role: d.role, profil: 'sysadmin', groupe: true, societes: d.societes},
      [u2.uid]: {nom: d2.label, username: 'direction', role: d2.role, profil: 'direction', groupe: !!d2.groupe, societes: d2.societes}}});
  await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-gtm-groupe', {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const s = serveur.demarrer(8790), b = await chromium.launch(), err = [], cons = [];
  async function session(login){
    const ctx = await b.newContext({viewport: {width: 1366, height: 900}, serviceWorkers: 'block', locale: 'fr-FR', acceptDownloads: true});
    await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]))}); return rt.abort(); });
    const p = await ctx.newPage(); p.on('pageerror', e => err.push(login + ': ' + e.message)); p.on('dialog', x => { cons.push(login + ' (dialogue) : ' + x.message()); x.accept(); });
    p.on('console', m => { if(m.type() === 'error' && /CALENDRIER|LISTING|EXPORT OFFRES|introuvable/.test(m.text())) cons.push(login + ': ' + m.text()); });
    await p.goto('http://localhost:8790/index.html'); await p.waitForSelector('#login-user');
    await p.fill('#login-user', login); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await p.waitForTimeout(2500);
    await p.evaluate(() => { try { kpiAller('mgt', 'mgt'); } catch(e) {} });
    let fr = null; for(let i = 0; i < 200 && !fr; i++){ fr = p.frames().find(f => /mgt-crm-app/.test(f.url())); if(!fr) await p.waitForTimeout(100); }
    await fr.waitForLoadState('load'); await p.waitForTimeout(6000);
    return {p, fr};
  }
  const r = [], base = async () => (await admin.database().ref('/groupe1/mgt').once('value')).val();
  // compte les écritures du Listing (une seule attendue pour la mise au prix standard)
  let ecrituresListing = 0; admin.database().ref('/groupe1/mgt/mgt_crm_listing').on('child_changed', () => { ecrituresListing++; });
  const {p, fr} = await session('sysadmin');
  r.push(['modules V4.6.9J chargés (calendrier, prix standard, export des offres)', await fr.evaluate(() => !!(window.MGT_CAL && window.MGT_CAL_VIEWS && window.MGT_CAL_MONTH && window.MGT_CAL_UX && window.MGT_CAL_FINAL && window.MGT_LISTING_STD && window.MGT_OFFER_EXPORTS && window.MGT_V469))]);
  // ---------- prix de vente standard = prix catalogue ----------
  await fr.evaluate(() => MGT_LISTING_STD.ready); await p.waitForTimeout(2500);
  const Lg = (await base()).mgt_crm_listing, A1 = lire(Lg['ART-0001']), A3 = lire(Lg['ART-0003']), A4 = lire(Lg['ART-0004']);
  r.push(['Listing : prix de vente = prix catalogue (1 200 → 1 000)', A1.prixVente === 1000 && lire(Lg['ART-0002']).prixVente === 200]);
  r.push(['ancien prix gardé dans l\'historique, date du tarif gardée', (A1.historiquePrix || []).some(h => h.source === 'STANDARDISATION' && h.precedent.prixVente === 1200) && A1.dateMaj === '2026-02-20']);
  r.push(['sans prix catalogue : plus de prix de vente', A3.prixVente == null && A3.prixAchat === 5035]);
  r.push(['article déjà au prix standard : inchangé', A4.prixVente === 700 && !A4.historiquePrix]);
  r.push(['mise au prix standard : 3 articles en une seule fois', (await fr.evaluate(() => MGT_LISTING_STD.state().changed)) === 3 && ecrituresListing === 3]);
  // ---------- calendrier ----------
  await fr.evaluate(() => openModule('calendar')); await p.waitForTimeout(1200);
  r.push(['calendrier : moteur (actions du jour)', (await fr.evaluate((d) => MGT_CAL.forDay(d).length, auj)) === 2 && (await fr.evaluate(() => MGT_CAL.all().length)) >= 3]);
  r.push(['calendrier : catégories Terrain / SAV / Bureau / Relances', (await fr.evaluate(() => { const a = MGT_CAL.all(); const c = (t) => MGT_CAL_CAT.of(a.find(x => x.type === t)); return [c('visite'), c('sav'), c('rapport'), c('offre')].join(); })) === 'terrain,sav,bureau,relance']);
  const vues = await fr.locator('#mgtCalSeg [data-mc-view]').allTextContents();
  r.push(['barre : vues Jour, Semaine, Mois, Année', vues.length === 4 && /Jour/.test(vues.join()) && /Ann/.test(vues.join())]);
  for (const [v, txt] of [['day', 'Visite'], ['week', 'Client Essai'], ['month', 'Client Essai']]){
    await fr.click('#mgtCalSeg [data-mc-view="' + v + '"]'); await p.waitForTimeout(700);
    r.push(['vue ' + v + ' : actions affichées', new RegExp(txt, 'i').test(await fr.locator('#planningCalendar').textContent())]);
  }
  await fr.click('#mgtCalSeg [data-mc-view="day"]'); await p.waitForTimeout(500);
  if(process.env.CAPTURES){ for (const v of ['day', 'week', 'month']){ await fr.click('#mgtCalSeg [data-mc-view="' + v + '"]'); await p.waitForTimeout(600); await p.screenshot({path: process.env.CAPTURES + '/cal-' + v + '.png'}); } await fr.click('#mgtCalSeg [data-mc-view="day"]'); await p.waitForTimeout(400); }
  r.push(['vue Jour : action horaire placée (09:00)', /09:00/.test(await fr.locator('#planningCalendar').textContent())]);
  const dl = p.waitForEvent('download', {timeout: 20000}).catch(() => null);
  await fr.evaluate(() => MGT_CAL_UX.pdf()); const f1 = await dl;
  r.push(['calendrier : PDF de la période (moteur PDF chargé à la demande)', !!f1 && /\.pdf$/.test(f1.suggestedFilename()) && await fr.evaluate(() => !!(window.jspdf && window.jspdf.jsPDF))]);
  // ---------- export des offres ----------
  await fr.evaluate(() => openModule('offres')); await p.waitForTimeout(1500);
  const cli = await fr.evaluate(() => { const m = MGT_OFFER_EXPORTS.modelFor('1', 0); return JSON.stringify(m); });
  r.push(['offre : modèle d\'export (client, lignes, total, marge)', /Client Essai/.test(cli) && /MACHINE ESSAI A/.test(cli) && JSON.parse(cli).totals.totalHT === 1980 && JSON.parse(cli).totals.marge === 780]);
  const xl = await fr.evaluate(async () => { const m = MGT_OFFER_EXPORTS.modelFor('1', 0), t = async (k) => { const bb = MGT_OFFER_EXPORTS.xlsxBlob(m, k); const u8 = new Uint8Array(await bb.arrayBuffer()); return Array.from(u8).map(c => String.fromCharCode(c)).join(''); }; return {c: await t('client'), i: await t('interne')}; });
  r.push(['offre client : ni prix d\'achat ni marge', !/achat|marge/i.test(xl.c) && /1\s?980|1980/.test(xl.c)]);
  r.push(['document interne : prix d\'achat, marges, mention DOCUMENT INTERNE', /achat/i.test(xl.i) && /marge/i.test(xl.i) && /DOCUMENT INTERNE/.test(xl.i)]);
  r.push(['bouton « Exporter » sur la carte de l\'offre', await fr.locator('[data-ofx-open]').count() >= 1]);
  if(process.env.CAPTURES){ await fr.locator('text=Autres offres').first().click().catch(() => {}); await p.waitForTimeout(600); await fr.locator('[data-ofx-open]').first().click({force: true, timeout: 5000}).catch(() => {}); await p.waitForTimeout(500); await p.screenshot({path: process.env.CAPTURES + '/offre-export.png'}); await fr.evaluate(() => { const m = document.getElementById('ofxMenu'); if (m) m.hidden = true; }); }
  const dl2 = p.waitForEvent('download', {timeout: 20000}).catch(() => null);
  await fr.evaluate(() => MGT_OFFER_EXPORTS.run('client', 'pdf', '1', 0)); const f2 = await dl2;
  r.push(['offre client en PDF', !!f2 && /\.pdf$/.test(f2.suggestedFilename())]);
  // ---------- droits : Direction (consultation) ----------
  const D = await session('direction');
  await D.fr.evaluate(() => openModule('calendar')); await D.p.waitForTimeout(1200);
  r.push(['Direction : ajout d\'action masqué (droits GTM)', /display:none/.test(await D.fr.evaluate(() => (document.getElementById('mgt-v469g-rights-style') || {}).textContent || ''))]);
  const avant = JSON.stringify(lire((await base()).mgt_crm_clients['1']).Planning);
  await D.fr.evaluate(async () => { const a = MGT_CAL.all().find(x => String(x.id) === 'E3'); try { await deleteCalendarAction(a); } catch(e) {} }); await D.p.waitForTimeout(1200);
  r.push(['Direction : suppression refusée sans confirmation', JSON.stringify(lire((await base()).mgt_crm_clients['1']).Planning) === avant && !cons.some(x => /direction \(dialogue\).*(Supprimer|supprimer l)/.test(x) && !/Droit insuffisant/.test(x))]);
  r.push(['Direction : la mise au prix standard ne s\'exécute pas (consultation)', (await D.fr.evaluate(() => MGT_LISTING_STD.state().changed)) === 0]);
  r.push(['aucun message « introuvable » des nouveaux modules', !cons.some(x => /introuvable|CALENDRIER|EXPORT OFFRES/.test(x) && !/dialogue/.test(x))]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err); if(cons.length) console.log(cons);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
