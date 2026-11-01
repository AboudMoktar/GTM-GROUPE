#!/usr/bin/env node
// ============================================================
// Parcours des ventes GADH dans la vraie application (émulateurs, règles V2) :
// devis → commande → livraison (sortie de stock) → facture, puis consultation par le Technico MGT.
// Lancement (dans tests/) : npm run e2e-ventes   (serveur web local sur le port 8790)
// ============================================================
'use strict';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const fs = require('fs'), path = require('path');
const admin = require('../functions/node_modules/firebase-admin');
const {chromium} = require('playwright');
const C = require('../roles-config.js');
const {donneesInitiales} = require('./scenarios.js');

const PROJET = 'demo-gtm-groupe', DOM = '@tek-trend.app', MDP = 'Test2026ok';
const SITE = process.env.GTM_SITE || 'http://localhost:8790/index.html';
admin.initializeApp({projectId: PROJET, databaseURL: `http://127.0.0.1:9000?ns=${PROJET}`});
const SDK = path.join(__dirname, 'node_modules', 'firebase');
const CONFIG = `const firebaseConfig = {apiKey:'demo-cle', authDomain:'localhost', databaseURL:'http://127.0.0.1:9000?ns=${PROJET}', projectId:'${PROJET}'};
(function(){ const init = firebase.initializeApp.bind(firebase); firebase.initializeApp = function(c, n){ const app = init(c, n);
  try { app.auth().useEmulator('http://127.0.0.1:9099', {disableWarnings:true}); } catch(e) {} try { app.database().useEmulator('127.0.0.1', 9000); } catch(e) {} return app; }; })();`;

// Écritures typiques de chaque rôle : [clé, autorisée ?]
const ECRITURES = {
  sysadmin: [['mgt_parametres', true], ['employees', true]],
  responsable: [['prod_2026-11-02', true], ['gadh_employees', true], ['mgt_parametres', false]],
  secretaire_tek: [['employees', true], ['factures', true], ['prod_2026-11-02', false], ['schedule', false]],
  agent_chaine: [['prod_2026-11-02', true], ['fc_2026-11-02', true], ['employees', false], ['factures', false]],
  resp_gadh: [['cmd_saisies_c9', true], ['gadh_employees', false], ['gadh_achat_bons', false], ['gadh_vente_devis', false], ['prod_references', false]],
  secretaire_gadh: [['gadh_employees', true], ['gadh_factures', true], ['gadh_achat_bons', true], ['gadh_vente_livraisons', true], ['cmd_saisies_c9', false]],
  technico_mgt: [['mgt_parametres', true], ['gadh_achat_bons', false], ['gadh_vente_devis', false], ['gadh_factures', false], ['employees', false]],
  secretaire_mgt: [['mgt_crm_clients', true], ['mgt_crm_droits', false], ['mgt_parametres', false], ['employees', false]],
  direction: [['prod_2026-11-02', false], ['gadh_employees', false], ['mgt_parametres', false]]
};

(async () => {
  const comptes = {};
  for(const r of C.ORDRE){
    const u = await admin.auth().createUser({email: r.replace(/_/g, '') + DOM, password: MDP});
    const d = C.ROLES[r];
    comptes[u.uid] = {nom: d.label, username: r.replace(/_/g, ''), role: d.role, profil: r, groupe: !!d.groupe, societes: d.societes};
  }
  const base = donneesInitiales(); base.groupe1.users_v2 = comptes; delete base.groupe1.sessions;
  await admin.database().ref('/').set(base);
  // Règles V2 appliquées à la base utilisée par l'application (même espace de noms).
  const regles = fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8');
  const rep = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', headers: {Authorization: 'Bearer owner'}, body: regles});
  if(!rep.ok) throw new Error('Règles non chargées : ' + rep.status + ' ' + await rep.text());


  const b = await chromium.launch();
  const ouvrir = async (r) => {
    const ctx = await b.newContext({viewport:{width:412, height:900}}); const p = await ctx.newPage();
    const refus = [], erreurs = [];
    p.on('console', m => { const t = m.text(); if(/permission_denied/i.test(t)) refus.push(t.slice(0, 160)); });
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.route(u => { const s = String(u); return !(s.startsWith('http://localhost') || s.startsWith('http://127.0.0.1')); }, rt => {
      const m = /firebasejs\/[\d.]+\/(firebase-[a-z-]+-compat\.js)$/.exec(rt.request().url());
      if(m && fs.existsSync(path.join(SDK, m[1]))) return rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(SDK, m[1]), 'utf8')});
      return rt.abort();
    });
    await p.route('**/firebase-config.js', rt => rt.fulfill({contentType: 'application/javascript', body: CONFIG}));
    await p.goto(SITE);
    await p.waitForSelector('#login-user', {timeout: 15000});
    await p.fill('#login-user', r.replace(/_/g, '')); await p.fill('#login-pass', MDP);
    await p.click('#login-form button[type=submit]');
    await p.waitForTimeout(4000);
    return {ctx, p, refus, erreurs};
  };
  let ok = 0, total = 0; const echecs = [];
  const verif = (lib, cond, detail) => { total++; if(cond) ok++; else echecs.push(lib + (detail ? ' — ' + detail : '')); console.log((cond ? '  ok    ' : '  ÉCHEC ') + lib); };
  const pause = (p, ms) => p.waitForTimeout(ms || 600);

  // 1. Secrétaire GADH : tout le circuit
  const S = await ouvrir('secretaire_gadh');
  let p = S.p;
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-ventes'); });
  await pause(p);
  verif('Secrétaire GADH : module Ventes ouvert', await p.evaluate(() => activeModule === 'gadh-ventes' && /Ventes/.test(document.body.innerText)));
  await p.screenshot({path:'/tmp/ventes-1-accueil.png', fullPage:true});
  // Article stocké (accessoire, 50 en stock) et client
  await p.evaluate(() => {
    const a = achGet('art'); a.art_fil = {nom:'Fil polyester', categorie:'accessoire', unite:'bobine', prix:2, prixVente:3.5, actif:true}; a.art_srv = {nom:'Assemblage à façon', categorie:'produit', unite:'pièce', prixVente:1.2, actif:true}; achSet('art', a);
    const m = achGet('mv'); m.mv_init = {date:getTodayISO(), articleId:'art_fil', type:'entree', qte:50, motif:'Stock initial', t:Date.now()}; achSet('mv', m);
  });
  await p.evaluate(() => venFormClient()); await pause(p, 300);
  await p.fill('#vc-nom', 'Confection Monastir'); await p.fill('#vc-tel', '73 000 000');
  await p.evaluate(() => venSauverClient('', false)); await pause(p);
  const cid = await p.evaluate(() => Object.keys(venClients()).find(k => venClients()[k].nom === 'Confection Monastir'));
  verif('Client créé (clients de la Facturation GADH)', !!cid);
  // Devis : 2 lignes
  await p.evaluate(() => { nav('ven-devis'); venNouveau('devis'); }); await pause(p);
  await p.selectOption('#vf-client', cid);
  await p.evaluate(() => venChoixArticle(0, 'art_fil')); await pause(p, 300);
  await p.fill('.vf-ligne[data-i="0"] .vf-qte', '20');
  await p.evaluate(() => venAjouterLigne()); await pause(p, 300);
  await p.evaluate(() => venChoixArticle(1, 'art_srv')); await pause(p, 300);
  await p.fill('.vf-ligne[data-i="1"] .vf-qte', '100');
  await p.evaluate(() => venRecalc());
  await p.screenshot({path:'/tmp/ventes-2-devis.png', fullPage:true});
  await p.evaluate(() => venEnregistrer()); await pause(p);
  const dv = await p.evaluate((cid) => { const l = venGet('devis'), id = Object.keys(l).find(k => l[k].clientId === cid); return id && {id, d:l[id], t:venTotaux(l[id])}; }, cid);
  verif('Devis enregistré avec son numéro DV', dv && /^DV-\d{4}-\d{3}$/.test(dv.d.numero), dv && dv.d.numero);
  verif('Prix de vente repris de l\'article et total HT juste (20 × 3,5 + 100 × 1,2 = 190)', dv && Math.abs(dv.t.ht - 190) < 1e-6, dv && String(dv.t.ht));
  // Accepté → commande
  await p.evaluate((id) => venDevisEnCommande(id), dv.id); await pause(p);
  const cmd = await p.evaluate((cid) => { const l = venGet('cmd'), id = Object.keys(l).find(k => l[k].clientId === cid); return id && {id, d:l[id]}; }, cid);
  verif('Commande client créée depuis le devis (CC)', cmd && /^CC-/.test(cmd.d.numero) && cmd.d.devisId === dv.id);
  verif('Devis passé à « Accepté »', await p.evaluate((id) => venGet('devis')[id].statut === 'accepte', dv.id));
  // Livraison partielle : 15 bobines sur 20, 100 pièces
  await p.evaluate((id) => venFormLivrer(id), cmd.id); await pause(p, 300);
  await p.fill('#vl-q0', '15');
  await p.evaluate((id) => venValiderLivraison(id), cmd.id); await pause(p);
  const bl = await p.evaluate((cid) => { const l = venGet('bl'), id = Object.keys(l).find(k => l[k].clientId === cid); return id && {id, d:l[id]}; }, cid);
  verif('Bon de livraison créé (BL)', bl && /^BL-/.test(bl.d.numero));
  verif('Stock du fil : 50 − 15 = 35 (la prestation ne touche pas le stock)', await p.evaluate(() => achStock().art_fil === 35 && !achStock().art_srv), String(await p.evaluate(() => achStock().art_fil)));
  verif('Commande « Livrée en partie »', await p.evaluate((id) => venStatutCmd(venGet('cmd')[id]).label === 'Livrée en partie', cmd.id));
  await p.screenshot({path:'/tmp/ventes-3-livraison.png', fullPage:true});
  // Facturer
  await p.evaluate((id) => venFacturer(id), bl.id); await pause(p, 1000);
  const fa = await p.evaluate((id) => { const b = venGet('bl')[id], f = factListe('gadh')[b.factureId]; return f && {id:b.factureId, f, t:factTotaux(f), module:activeModule}; }, bl.id);
  verif('Facture préparée dans le module Facturation GADH', fa && fa.f.origine && fa.f.origine.type === 'vente' && fa.module === 'factures');
  verif('Montant facturé = livré (15 × 3,5 + 100 × 1,2 = 172,5 HT)', fa && Math.abs(fa.t.ht - 172.5) < 1e-6, fa && String(fa.t.ht));
  await p.screenshot({path:'/tmp/ventes-4-facture.png', fullPage:true});
  // Émettre + encaissement partiel, comme le ferait la Facturation
  await p.evaluate((id) => { const l = factToutes('gadh'); l[id].statut = 'emise'; l[id].numero = factNumero('gadh', 'facture', getTodayISO().slice(0, 4)); l[id].paiements = [{date:getTodayISO(), montant:100, mode:'cheque'}]; factEnregistrer('gadh', l); }, fa.id);
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-ventes'); }); await pause(p);
  const acc = await p.evaluate(() => document.querySelector('#main, main, body').innerText);
  const attendu = await p.evaluate((id) => achDT(factTotaux(factListe('gadh')[id], factListe('gadh')).reste), fa.id);
  verif('Accueil Ventes : reste à encaisser affiché (' + attendu + ')', acc.indexOf(attendu) >= 0);
  verif('Accueil Ventes : commande toujours à livrer (5 bobines restantes)', /Commandes à livrer/.test(acc) && acc.indexOf(cmd.d.numero) >= 0);
  await p.screenshot({path:'/tmp/ventes-5-accueil.png', fullPage:true});
  await p.evaluate(() => { venClientOuvert = Object.keys(venClients()).find(k => venClients()[k].nom === 'Confection Monastir'); nav('ven-clients'); }); await pause(p);
  verif('Fiche client : ventes et reste à encaisser', (await p.evaluate(() => document.body.innerText)).indexOf(attendu) >= 0);
  await p.screenshot({path:'/tmp/ventes-6-client.png', fullPage:true});
  // Annulation d'une 2e livraison : remise en stock
  await p.evaluate((id) => venFormLivrer(id), cmd.id); await pause(p, 300);
  await p.evaluate((id) => venValiderLivraison(id), cmd.id); await pause(p);
  const bl2 = await p.evaluate((cid) => Object.keys(venGet('bl')).find(k => venGet('bl')[k].clientId === cid && !venGet('bl')[k].factureId), cid);
  verif('2e livraison : commande « Livrée », stock 30', await p.evaluate((c) => venStatutCmd(venGet('cmd')[c]).label === 'Livrée' && achStock().art_fil === 30, cmd.id));
  await p.evaluate((id) => venAnnulerBl(id), bl2); await pause(p);
  verif('Annulation : stock revenu à 35, commande de nouveau « Livrée en partie »', await p.evaluate((c) => achStock().art_fil === 35 && venStatutCmd(venGet('cmd')[c]).label === 'Livrée en partie', cmd.id));
  // Prestation : fiche adaptée (tarification, description, suppléments) puis devis avec supplément, imprimé avec le logo
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-achats'); nav('ach-articles'); achFormArticle(); }); await pause(p, 400);
  await p.fill('#aa-nom', 'Repassage et pliage'); await p.selectOption('#aa-cat', 'produit'); await pause(p, 200);
  verif('Fiche prestation : champs de stock masqués, tarification affichée', await p.evaluate(() => document.getElementById('aa-bloc-stock').style.display === 'none' && document.getElementById('aa-bloc-presta').style.display === ''));
  await p.selectOption('#aa-tarif', '__autre'); await p.fill('#aa-tarif-autre', 'colis');
  await p.fill('#aa-pp', '4'); await p.fill('#aa-desc', 'Repassage vapeur, pliage et mise sous sachet');
  await p.evaluate(() => achAjouterOption()); await p.fill('.aa-opt-nom', 'Étiquetage client'); await p.fill('.aa-opt-pu', '0.5');
  await p.screenshot({path:'/tmp/ventes-8-prestation.png', fullPage:true});
  await p.evaluate(() => achSauverArticle('', false)); await pause(p);
  const pr = await p.evaluate(() => { const a = achGet('art'), id = Object.keys(a).find(k => a[k].nom === 'Repassage et pliage'); return id && Object.assign({id}, a[id], {tarifs:achTarifs()}); });
  verif('Prestation enregistrée : tarif « par colis » créé, prix, description, 1 supplément', pr && pr.unite === 'colis' && pr.prixVente === 4 && /vapeur/.test(pr.description) && pr.options.length === 1 && pr.tarifs.indexOf('colis') >= 0, JSON.stringify(pr));
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-ventes'); nav('ven-devis'); venNouveau('devis'); }); await pause(p);
  await p.selectOption('#vf-client', cid);
  await p.evaluate((id) => venChoixArticle(0, id), pr.id); await pause(p, 300);
  await p.fill('.vf-ligne[data-i="0"] .vf-qte', '10');
  await p.evaluate(() => venAjouterOption(0, 0)); await pause(p, 300);
  await p.screenshot({path:'/tmp/ventes-9-devis-presta.png', fullPage:true});
  await p.evaluate(() => venEnregistrer()); await pause(p);
  const dv2 = await p.evaluate((cid) => { const l = venGet('devis'), id = Object.keys(l).filter(k => l[k].clientId === cid).sort((a, b) => (l[b].numero || '').localeCompare(l[a].numero || ''))[0]; return {id, d:l[id], t:venTotaux(l[id])}; }, cid);
  verif('Devis prestation : 10 colis × 4 + supplément 1 × 0,5 = 40,5 HT', Math.abs(dv2.t.ht - 40.5) < 1e-6 && dv2.d.lignes[1].designation === 'Étiquetage client', JSON.stringify(dv2.d.lignes));
  const html = await p.evaluate((id) => { let h = ''; const o = window.open; window.open = () => ({document:{open(){}, write(x){ h = x; }, close(){}}}); venImprimer('devis', id); window.open = o; return h; }, dv2.id);
  verif('Impression du devis : logo GADH intégré et description de la prestation', /<img src="data:image\/png;base64,/.test(html) && /vapeur/.test(html));
  const v = await S.ctx.newPage(); await v.setContent(html.replace(/<script>[\s\S]*?<\/script>/, ''), {waitUntil:'load'}); await v.screenshot({path:'/tmp/ventes-10-impression.png', fullPage:true}); await v.close();
  const fh = await p.evaluate(() => { const l = factListe('gadh'), id = Object.keys(l).find(k => l[k].origine && l[k].origine.type === 'vente'); let h = ''; const o = window.open; window.open = () => ({document:{open(){}, write(x){ h = x; }, close(){}}}); activeSociete = 'gadh'; factImprimer(id); window.open = o; return h; });
  verif('Impression de la facture GADH : logo intégré', /<img src="data:image\/png;base64,/.test(fh));
  const ah = await p.evaluate(() => { let h = ''; const o = window.open; window.open = () => ({document:{open(){}, write(x){ h = x; }, close(){}}}); const b = achGet('bons'); const id = Object.keys(b)[0]; if(id) achImprimer(id); window.open = o; return h; });
  verif('Impression du bon d\'achat : logo intégré', /<img src="data:image\/png;base64,/.test(ah));
  verif('Secrétaire GADH : aucun refus Firebase ni erreur', !S.refus.length && !S.erreurs.length, S.refus.concat(S.erreurs).join(' | '));
  await S.ctx.close();

  // 2. Technico MGT : consultation
  const Tq = await ouvrir('technico_mgt'); p = Tq.p;
  verif('Technico MGT : module Ventes proposé dans GADH', await p.evaluate(() => modulesDeSociete('gadh').indexOf('gadh-ventes') >= 0));
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-ventes'); }); await pause(p, 1500);
  const txt = await p.evaluate(() => document.body.innerText);
  verif('Technico MGT : voit les ventes et le reste à encaisser', txt.indexOf(attendu) >= 0, txt.slice(0, 300));
  verif('Technico MGT : aucun bouton de saisie', !/\+ Devis|\+ Commande client/.test(txt));
  await p.evaluate(() => nav('ven-livraisons')); await pause(p);
  await p.screenshot({path:'/tmp/ventes-7-technico.png', fullPage:true});
  verif('Technico MGT : aucun refus au chargement ni erreur', !Tq.refus.length && !Tq.erreurs.length, Tq.refus.concat(Tq.erreurs).join(' | '));
  verif('Technico MGT : modification refusée par Firebase', await p.evaluate(async () => { try { await fbRootRef.child(firebaseCheminDe('gadh_vente_devis')).set({x:1}); return false; } catch(e) { return true; } }));
  await Tq.ctx.close();

  // 3. Responsable GADH : pas de module Ventes
  const Rg = await ouvrir('resp_gadh'); p = Rg.p;
  verif('Responsable GADH : pas de module Ventes', await p.evaluate(() => modulesDeSociete('gadh').indexOf('gadh-ventes') < 0));
  await Rg.ctx.close();

  // 4. Tableau de bord GADH : sections Ventes, Achats et stock, Facturation
  const Rs = await ouvrir('responsable'); p = Rs.p;
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-tableau'); nav('gadh-tableau-vue'); }); await pause(p, 1200);
  const tb = await p.evaluate(() => document.getElementById('main').innerText);
  verif('Tableau de bord GADH : sections Ventes, Achats et stock, Facturation', /Ventes facturées du mois/.test(tb) && /Valeur du stock/.test(tb) && /Facturé ce mois/.test(tb), tb.slice(-600));
  verif('Tableau de bord GADH : reste à encaisser des ventes (' + attendu + ')', tb.indexOf(attendu) >= 0);
  verif('Tableau de bord GADH : aucune erreur', !Rs.erreurs.length && !Rs.refus.length, Rs.erreurs.concat(Rs.refus).join(' | '));
  await p.screenshot({path:'/tmp/ventes-11-tableau.png', fullPage:true});
  // Indicateurs cliquables
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.dd-bx')).find(x => /Articles sous le seuil/.test(x.textContent)); b.click(); }); await pause(p, 800);
  verif('Clic « Articles sous le seuil » → écran Stock des achats', await p.evaluate(() => activeModule === 'gadh-achats' && /Articles suivis/.test(document.getElementById('main').innerText)));
  await p.evaluate(() => nav('ach-accueil')); await pause(p, 500);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kpi-mini')).find(x => /Reste à payer/.test(x.textContent)); b.click(); }); await pause(p, 800);
  verif('Clic « Reste à payer » → bons d\'achat filtrés « à payer »', await p.evaluate(() => achFiltre === 'apayer'));
  await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-ventes'); }); await pause(p, 600);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kpi-mini')).find(x => /Reste à encaisser/.test(x.textContent)); b.click(); }); await pause(p, 900);
  verif('Clic « Reste à encaisser » (accueil Ventes) → défile vers le détail', await p.evaluate(() => !!document.querySelector('.kpi-flash')));
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kpi-mini')).find(x => /Commandes à livrer/.test(x.textContent)); b.click(); }); await pause(p, 600);
  verif('Clic « Commandes à livrer » → liste des commandes', await p.evaluate(() => /Commandes clients/.test(document.getElementById('main').innerText)));
  verif('Indicateurs : aucune erreur', !Rs.erreurs.length, Rs.erreurs.join(' | '));
  await Rs.ctx.close();
  const Rg2 = await ouvrir('resp_gadh'); p = Rg2.p;
  const vis = await p.evaluate(() => modulesDeSociete('gadh').indexOf('gadh-tableau') >= 0);
  if(vis){ await p.evaluate(() => { activeSociete = 'gadh'; chooseModule('gadh-tableau'); nav('gadh-tableau-vue'); }); await pause(p, 800); }
  const tb2 = vis ? await p.evaluate(() => document.getElementById('main').innerText) : '';
  verif('Responsable GADH : pas de chiffres de ventes, achats ni facturation', !/Ventes facturées|Valeur du stock|Facturé ce mois/.test(tb2) && !Rg2.erreurs.length, Rg2.erreurs.join(' | '));
  await Rg2.ctx.close();

  await b.close();
  console.log(`Parcours ventes GADH : ${ok}/${total} contrôles conformes`);
  echecs.forEach(e => console.log('  ÉCHEC  ' + e));
  process.exit(echecs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
