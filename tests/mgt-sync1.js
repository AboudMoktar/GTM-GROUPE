#!/usr/bin/env node
// CRM MGT : nouveautés V4.6.9_SYNC1 de l'associé — aperçus et exports (V8–V14), évaluation et statistiques des offres,
// import d'offres (OF1/OF2), proforma V14, commandes fournisseurs (CF2–CF10) rangées dans GTM Groupe (Firebase)
// au lieu de Supabase : tables, droits, fichiers joints, lecture des PDF (données d'essai, émulateur).
// Lancement (dans tests/) : npm run mgt-sync1
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
  const comptes = {};
  for (const p of ['sysadmin', 'direction', 'secretaire_mgt']){ const u = await admin.auth().createUser({email: p + '@tek-trend.app', password: MDP}), d = C.ROLES[p];
    comptes[u.uid] = {nom: d.label, username: p, role: d.role, profil: p, groupe: !!d.groupe, societes: d.societes}; }
  const ligne = {reference: 'M-100', designation: 'MACHINE ESSAI A', quantite: 2, prixVente: 1100, remise: 10, prixAchat: 600, articleId: 'ART-0001'};
  await admin.database().ref('/groupe1').set({mgt: {
    mgt_crm_clients: {'1': J({ID: '1', Societe: 'Client Essai', _version: 1, Planning: [],
      Offres: [{id: 'OF-1', number: 'OF026-001', type: 'devis', groupe: 'MACPI', marque: 'MACPI', probabilite: 60, sentDate: '2026-11-20', status: 'En attente', amount: 1980, lignes: [ligne]}]})},
    mgt_crm_listing: {'ART-0001': J({id: 'ART-0001', groupe: 'MACPI', marque: 'MACPI', categorie: 'MACHINES', reference: 'M-100', designation: 'MACHINE ESSAI A', prixCatalogue: 1000, prixAchat: 600, prixVente: 1000, _created_at: '2026-11-08T10:00:00Z', _updated_at: '2026-11-08T10:00:00Z'}),
      'ART-0002': J({id: 'ART-0002', groupe: 'AUTRES', marque: 'ESSAI', categorie: 'SERVICES', reference: 'SERVM02', designation: 'SERVICE ESSAI', prixVente: 900, prixAchat: 0, prixCatalogue: 900, _created_at: '2026-11-08T10:00:00Z', _updated_at: '2026-11-08T10:00:00Z'}),
      'ART-0003': J({id: 'ART-0003', groupe: 'AUTRES', marque: 'ESSAI', categorie: 'SERVICES', reference: 'servm02', designation: 'SERVICE ESSAI', prixVente: 750, prixAchat: 0, prixCatalogue: 750, _created_at: '2026-11-08T10:00:00Z', _updated_at: '2026-11-08T10:00:00Z'})}},
    users_v2: comptes});
  await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=demo-gtm-groupe', {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8')});
  const s = serveur.demarrer(8791), b = await chromium.launch(), err = [], cons = [], reseau = [];
  async function session(login){
    const ctx = await b.newContext({viewport: {width: 1366, height: 900}, serviceWorkers: 'block', locale: 'fr-FR', acceptDownloads: true});
    await ctx.route(x => { const t = String(x); return !(t.startsWith('http://localhost') || t.startsWith('http://127.0.0.1')); }, rt => { const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url()); if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]))}); reseau.push(rt.request().url()); return rt.abort(); });
    const p = await ctx.newPage(); p.on('pageerror', e => err.push(login + ': ' + e.message)); p.on('dialog', x => { cons.push(login + ' (dialogue) : ' + x.message()); x.accept(); });
    p.on('console', m => { if(m.type() === 'error' && /CF|OFFRES|APERCU|PROFORMA|introuvable|Supabase|dépendances/.test(m.text())) cons.push(login + ': ' + m.text()); });
    await p.goto('http://localhost:8791/index.html'); await p.waitForSelector('#login-user');
    await p.fill('#login-user', login); await p.fill('#login-pass', MDP); await p.click('#login-form button[type=submit]');
    await p.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && !document.getElementById('login-user'), null, {timeout: 30000}); await p.waitForTimeout(2500);
    await p.evaluate(() => { try { kpiAller('mgt', 'mgt'); } catch(e) {} });
    let fr = null; for(let i = 0; i < 200 && !fr; i++){ fr = p.frames().find(f => /mgt-crm-app/.test(f.url())); if(!fr) await p.waitForTimeout(100); }
    await fr.waitForLoadState('load'); await p.waitForTimeout(6000);
    return {p, fr};
  }
  const r = [], base = async () => (await admin.database().ref('/groupe1/mgt').once('value')).val();
  const {p, fr} = await session('sysadmin');
  r.push(['modules V4.6.9_SYNC1 chargés (aperçus, évaluation, statistiques, import d\'offres, commandes fournisseurs)', await fr.evaluate(() => !!(window.MGT_DOCS && window.MGT_OFFRES_EVAL && window.MGT_OFFRES_STATS && window.MGT_OFFRES_IMPORT && window.MGT_OF_PARSE && window.MGT_CF && window.MGT_LP_PARSE && window.GTM_CF_SB && /CL1/.test(MGT_V469.version)))]);
  r.push(['proforma V14 : ni coordonnées ni cachet de MGT dans le code', await fr.evaluate(() => { const t = document.getElementById('mgt-v469v7-proforma').textContent; return MGT_PROFORMA.version === 'V4.6.9V14' && !/BIAT|0708048Y|orange\.tn|iVBORw0KGgo/.test(t) && MGT_PROFORMA.DEFAULT.societe.rib === ''; })]);
  r.push(['aucune bibliothèque chargée depuis Internet (CDN) dans les nouveaux modules', await fr.evaluate(() => !/cdn\.jsdelivr|SyncManager\._client/.test(['cf2-commandes', 'mgt-of1-import'].map(i => document.getElementById(i).textContent.replace(/\/\*[\s\S]*?\*\//g, '')).join(' ')))]);
  await fr.evaluate(() => openModule('stock')).catch(() => {}); await p.waitForTimeout(4000);
  { const L = (await admin.database().ref('/groupe1/mgt/mgt_crm_listing').once('value')).val() || {}, a2 = lire(L['ART-0002']) || {}, a3 = lire(L['ART-0003']) || {};
    r.push(['LS1 : doublon « servm02 » mis à la corbeille (restaurable), « SERVM02 » 900 € gardé', !!a3._deleted_at && /Doublon/.test(JSON.stringify(a3.journal || [])) && !a2._deleted_at]); }
  // ---------- tuile et module Commandes fournisseurs ----------
  await fr.evaluate(() => openModule('dashboard')); await p.waitForTimeout(1200);
  r.push(['accueil : tuile « Commandes fournisseurs »', await fr.evaluate(() => { const t = document.querySelector('[data-cf-home]'); return !!t && !t.hidden; })]);
  // ---------- tables (client compatible, rangé dans Firebase) ----------
  const T = await fr.evaluate(async () => {
    const sb = GTM_CF_SB, q = async (x) => { const res = await x; if(res.error) throw res.error; return res.data; }, o = {};
    const f = (await q(sb.from('mgt_cf_fournisseurs').insert({nom: 'FOURNISSEUR ESSAI', code: 'FE', actif: true}).select('*')))[0];
    const c = (await q(sb.from('mgt_cf_commandes').insert({numero: 'CD026.001', fournisseur_id: f.id, date_commande: '2026-11-20', statut: 'brouillon', ajoute_par_nom: 'essai'}).select('*')))[0];
    o.version1 = c.version === 1 && c.deleted_at === null && !!c.id;
    const dbl = await sb.from('mgt_cf_commandes').insert({numero: 'CD026.001', fournisseur_id: f.id}).select('*'); o.doublon = dbl.error && dbl.error.code === '23505';
    const L = await q(sb.from('mgt_cf_lignes').insert([{commande_id: c.id, indice: 1, article: 'M-100', qte: 2}, {commande_id: c.id, indice: 2, article: 'B-75', qte: 5}]).select('*'));
    const liste = await q(sb.from('mgt_cf_commandes').select('id,numero,version,mgt_cf_lignes(count)').is('deleted_at', null).order('numero', {ascending: false}));
    o.compte = liste.length === 1 && liste[0].mgt_cf_lignes[0].count === 2 && liste[0].statut === undefined;
    const up = await q(sb.from('mgt_cf_commandes').update({statut: 'envoyee'}).eq('id', c.id).eq('version', 1).select('*'));
    const perime = await q(sb.from('mgt_cf_commandes').update({statut: 'annulee'}).eq('id', c.id).eq('version', 1).select('*'));
    o.versions = up.length === 1 && up[0].version === 2 && up[0].statut === 'envoyee' && perime.length === 0;
    await q(sb.rpc('mgt_cf_set_prix_achat', {p_ligne_id: L[0].id, p_pu_achat: 600, p_prix_catalogue: 1000, p_source: 'listing'}));
    const pa = await q(sb.from('mgt_cf_prix_achat').select('ligne_id,pu_achat').in('ligne_id', [L[0].id]));
    o.prix = pa.length === 1 && pa[0].pu_achat === 600;
    await q(sb.from('mgt_cf_lignes').delete().eq('id', L[0].id));
    o.cascade = (await q(sb.from('mgt_cf_prix_achat').select('*'))).length === 0 && (await q(sb.from('mgt_cf_lignes').select('id').eq('commande_id', c.id))).length === 1;
    await q(sb.from('mgt_cf_historique').insert({commande_id: c.id, numero: 'CD026.001', action: 'creation', user_nom: 'essai'}));
    const h = await q(sb.from('mgt_cf_historique').select('ts,action').eq('commande_id', c.id).order('ts', {ascending: false}).limit(50));
    o.histo = h.length === 1 && !!h[0].ts;
    const fichier = new File([new Uint8Array([37, 80, 68, 70, 45, 49])], 'bon.pdf', {type: 'application/pdf'});
    const up2 = await sb.storage.from('mgt-cf-pieces').upload(c.id + '/1_bon.pdf', fichier, {upsert: false});
    const dl = await sb.storage.from('mgt-cf-pieces').download(c.id + '/1_bon.pdf');
    o.fichier = !up2.error && !dl.error && (await dl.data.text()) === '%PDF-1';
    o.cid = c.id; return o;
  });
  await p.waitForTimeout(2500);
  const B = await base();
  r.push(['commande créée (version 1, non supprimée)', T.version1]);
  r.push(['n° de commande unique (doublon refusé, code 23505)', T.doublon]);
  r.push(['liste : nombre de lignes par commande (mgt_cf_lignes(count)), colonnes demandées seulement', T.compte]);
  r.push(['modification avec contrôle de version (version 2 ; ancienne version refusée)', T.versions]);
  r.push(['prix d\'achat par la fonction protégée (rpc)', T.prix]);
  r.push(['ligne supprimée : prix d\'achat supprimé avec elle', T.cascade]);
  r.push(['historique de la commande (horodaté)', T.histo]);
  r.push(['fichier joint : envoyé puis relu', T.fichier]);
  const cmds = lire(B.mgt_crm_cf_commandes) || [];
  r.push(['commandes enregistrées dans GTM Groupe (Firebase, mgt/mgt_crm_cf_commandes)', Array.isArray(cmds) && cmds.length === 1 && cmds[0].numero === 'CD026.001' && cmds[0].version === 2]);
  r.push(['fichier joint rangé à part (fichiers/…), pas dans la commande', Object.keys((await admin.database().ref('/groupe1/fichiers').once('value')).val() || {}).some(k => /^cf_/.test(k))]);
  await fr.evaluate(() => MGT_CF.ouvrir()); await p.waitForTimeout(2500);
  if(process.env.CAPTURES) await p.screenshot({path: process.env.CAPTURES + '/cf-commandes.png'});
  const st = await fr.evaluate(() => { const s = MGT_CF.state(); return {n: s.cmds.length, err: s.err, f: s.fours.length, txt: document.body.innerText}; });
  r.push(['module Commandes fournisseurs : liste chargée (1 commande, 1 fournisseur)', st.n === 1 && st.f === 1 && !st.err && /CD026\.001/.test(st.txt)]);
  r.push(['n° suivant proposé (CD026.002)', await fr.evaluate(() => MGT_CF.nextNumero(['CD026.001'])) === 'CD026.002']);
  await fr.evaluate(() => MGT_CF.fermer()); await p.waitForTimeout(500);
  // ---------- lecture d'un PDF (pdf.js du site, sans Internet) ----------
  const pdf = Array.from(fs.readFileSync(path.join(TESTS, 'fixtures', 'commande-essai-texte.pdf')));
  const txt = await fr.evaluate(async (a) => { const pj = await GTM_PDFJS(), d = await pj.getDocument({data: new Uint8Array(a), isEvalSupported: false}).promise, pg = await d.getPage(1), tc = await pg.getTextContent(); return tc.items.map(i => i.str).join(' '); }, pdf);
  r.push(['lecture du texte d\'un PDF (pdf.js du site)', txt.length > 50]);
  // ---------- offres : évaluation, statistiques, aperçu ----------
  await fr.evaluate(() => openModule('offres')); await p.waitForTimeout(1500);
  const ev = await fr.evaluate(() => { const c = CLIENTS.find(x => String(x.ID) === '1'), o = c.Offres[0]; return {res: MGT_OFFRES_EVAL.result(o), imp: MGT_OFFRES_EVAL.importance(c)}; });
  r.push(['V10 : évaluation de l\'offre (résultat) et importance du client', !!ev && ev.res != null]);
  await fr.locator('text=Offres Macpi').first().click().catch(() => {}); await p.waitForTimeout(900);
  await fr.evaluate(() => MGT_OFFRES_STATS.open()); await p.waitForTimeout(1200);
  if(process.env.CAPTURES) await p.screenshot({path: process.env.CAPTURES + '/offres-stats.png'});
  r.push(['CL1 : bloc « Classement des projets » en tête des statistiques', await fr.evaluate(() => { const b = document.querySelector('#ostBody .cl1Stats'); return !!b && b === document.querySelector('#ostBody').firstElementChild; })]);
  r.push(['V11 : fenêtre Statistiques des offres', await fr.evaluate(() => { const m = document.getElementById('ostModal'); return !!m && !m.hidden && /Statistiques/i.test(m.textContent); })]);
  const dlx = p.waitForEvent('download', {timeout: 20000}).catch(() => null);
  await fr.evaluate(() => Promise.resolve(MGT_OFFRES_STATS.exportX('xlsx')).catch(() => {})); const fx = await dlx;
  r.push(['V12 : statistiques exportées en Excel', !!fx && /\.xlsx$/i.test(fx.suggestedFilename())]);
  await fr.evaluate(() => MGT_OFFRES_STATS.close()); await p.waitForTimeout(400);
  const dlp = p.waitForEvent('download', {timeout: 20000}).catch(() => null);
  await fr.evaluate(() => MGT_DOCS.exportDoc(MGT_DOCS.listDoc('todo'), 'pdf').catch(e => console.error('APERCU ' + e.message))); const fp = await dlp;
  r.push(['V8 : liste exportée en PDF (moteur PDF chargé à la demande)', !!fp && /\.pdf$/i.test(fp.suggestedFilename())]);
  await fr.evaluate(() => MGT_OFFER_PREVIEW.openCard('1', 0)); await p.waitForTimeout(1500);
  await fr.click('#ofpModal [data-ofp-kind="proforma"]'); await p.waitForTimeout(2000);
  if(process.env.CAPTURES) await p.screenshot({path: process.env.CAPTURES + '/proforma-v14.png'});
  r.push(['V14 : proforma (mise en page d\'origine, section Disponibilité, sans cachet par défaut)', await fr.evaluate(() => !!document.getElementById('ofpDispoList') && /Aucun cachet/.test(document.body.textContent))]);
  const dl3 = p.waitForEvent('download', {timeout: 20000}).catch(() => null);
  await fr.click('#ofpModal [data-ofp="pdf"]').catch(() => {}); const f3 = await dl3;
  r.push(['V14 : proforma exportée en PDF', !!f3 && /\.pdf$/i.test(f3.suggestedFilename())]);
  await fr.click('#ofpModal [data-ofp="close"]').catch(() => {}); await p.waitForTimeout(400);
  await fr.evaluate(() => openModule('offres')); await p.waitForTimeout(1500);
  for(let i = 0; i < 2 && !(await fr.evaluate(() => !!document.querySelector('#offresCardsWrap article.offresCard'))); i++){ await fr.evaluate(() => { const b = [...document.querySelectorAll('[data-offres-family]')].find(x => /macpi/i.test(x.getAttribute('data-offres-family') + x.textContent)); if(b) b.click(); }); await p.waitForTimeout(1500); }
  if(process.env.CAPTURES) await p.screenshot({path: process.env.CAPTURES + '/cl1-cartes.png'});
  r.push(['CL1 : cartes classées (rang, probabilité) et résumé en tête', await fr.evaluate(() => !!window.MGT_CL1 && !!document.querySelector('#offresCardsWrap > .cl1Sum') && !!document.querySelector('#offresCardsWrap article.offresCard > .cl1Bar'))]);
  // ---------- TI1 : tâche interne non terminée = rappel au calendrier ; terminée = heure demandée, archivée au calendrier ----------
  const ti = await fr.evaluate(async () => { const hier = new Date(Date.now() - 86400000), iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const ok = await window.__tkInt.add({id: 'ti-essai-1', type: 'rapport', priority: 'Moyenne', status: 'En attente', date: iso(hier), objective: 'RAPPORT ESSAI TI1'});
    MGT_TI1.rafraichir(); const E = MGT_TI1.elements().filter(a => /RAPPORT ESSAI TI1/.test(a.objective));
    const t = (JSON.parse(JSON.stringify(parent.getJSON('mgt_crm_taches_internes', []))).find(x => x.objective === 'RAPPORT ESSAI TI1') || {});
    await window.__tkInt.patch({_int: {id: t.id}}, {status: 'Termine'}); const boite = !!document.getElementById('tiModal');
    document.getElementById('tiHeure').value = '09:30'; document.querySelector('#tiModal [data-ti="ok"]').click(); await new Promise(r => setTimeout(r, 2500));
    const t2 = parent.getJSON('mgt_crm_taches_internes', []).find(x => x.id === t.id) || {}, E2 = MGT_TI1.elements().filter(a => a._int && a._int.id === t.id);
    return {cree: ok !== false, rappels: E.filter(a => a._ti === 'rappel').length, boite, statut: t2.status, heure: t2.heureFin, fait: E2.length === 1 && E2[0]._ti === 'fait', horsTaches: !window.__tkIntActions().some(a => a._int && a._int.id === t.id)}; }).catch(e => ({err: e.message}));
  r.push(['TI1 : tâche interne en retard = rappels au calendrier (hier et aujourd\'hui)', ti.rappels >= 1 && ti.cree]);
  r.push(['TI1 : « Terminée » demande la date et l\'heure, enregistrée dans GTM (Termine, 09:30)', ti.boite && ti.statut === 'Termine' && ti.heure === '09:30']);
  r.push(['TI1 : tâche terminée une seule fois au calendrier et retirée du module Tâches', ti.fait && ti.horsTaches]);
  if(ti.err) console.log('TI1', ti.err);
  // ---------- liste des clients au toucher (« Importer des notes ») ----------
  await fr.evaluate(() => openModule('dashboard')); await p.waitForTimeout(800);
  await fr.click('[data-ni-home]'); await p.waitForTimeout(800);
  await fr.click('#niClient'); await p.waitForTimeout(500);
  const lc = await fr.evaluate(() => { const pan = document.querySelector('.lc-panneau'); return {vis: !!pan && !pan.hidden, txt: pan ? pan.textContent : '', list: document.getElementById('niClient').hasAttribute('list')}; });
  r.push(['« Importer des notes » : toucher le champ Client affiche la liste des clients', lc.vis && /Client Essai/.test(lc.txt) && !lc.list]);
  await fr.locator('.lc-panneau .lc-opt', {hasText: 'Client Essai'}).first().click(); await p.waitForTimeout(300);
  r.push(['client choisi dans la liste', (await fr.inputValue('#niClient')) === 'Client Essai' && await fr.evaluate(() => document.querySelector('.lc-panneau').hidden)]);
  await fr.evaluate(() => { const m = document.getElementById('niModal') || document.querySelector('.niBox'); const x = document.querySelector('[data-ni="close"], .niClose, #niClose'); if(x) x.click(); else if(m) m.remove(); }); await p.waitForTimeout(300);
  // ---------- droits ----------
  const D = await session('direction');
  const dd = await D.fr.evaluate(async () => { const a = await GTM_CF_SB.from('mgt_cf_commandes').select('id,numero'), b = await GTM_CF_SB.from('mgt_cf_commandes').insert({numero: 'CD026.009'}).select('*'), c = await GTM_CF_SB.rpc('mgt_cf_set_prix_achat', {p_ligne_id: 'x', p_pu_achat: 1});
    return {lit: !a.error && a.data.length === 1, ecrit: b.error && b.error.code, prix: c.error && c.error.code}; });
  r.push(['Direction : commandes en consultation (lecture oui, création et prix refusés)', dd.lit && dd.ecrit === '42501' && dd.prix === '42501']);
  const S2 = await session('secretaire_mgt');
  r.push(['Secrétaire MGT : pas de tuile Commandes fournisseurs (profil sans accès)', await S2.fr.evaluate(() => { openModule('dashboard'); return new Promise(ok => setTimeout(() => { const t = document.querySelector('[data-cf-home]'); ok(!t || t.hidden); }, 1200)); })]);
  r.push(['n° CD026.009 non créé', (lire((await base()).mgt_crm_cf_commandes) || []).length === 1]);
  r.push(['aucun appel Internet des nouveaux modules (Supabase, CDN)', !reseau.some(u => /supabase|jsdelivr|tesseract|pdfjs-dist/.test(u))]);
  r.push(['aucun message d\'erreur des nouveaux modules', !cons.some(x => !/dialogue/.test(x))]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err); if(cons.length) console.log(cons);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
