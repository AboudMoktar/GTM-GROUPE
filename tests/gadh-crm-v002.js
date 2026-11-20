#!/usr/bin/env node
// GADH — CRM V 0.0.2 (livré par l'ami) intégré dans GTM : chaque espace s'ouvre sans erreur, le chargeur de données
// fusionne un fichier de données (inventées), l'import PDF a ses bibliothèques sur le site. Données inventées uniquement.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8798), b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1366, height:900}, serviceWorkers:'block'})).newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  p.on('dialog', d => d.accept());
  const cons = []; p.on('console', m => { if (m.type() === 'error' && /CRM|Gestion des commandes|gc-/.test(m.text())) cons.push(m.text().split('\n')[0]); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8798/index.html'); await p.waitForFunction(() => typeof renderShell === 'function' && typeof gcvTableau !== 'undefined' || typeof GCV_VERSION !== 'undefined');
  await p.evaluate(() => { hlEcritureAutorisee = () => true;
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}};
    activeSociete = 'gadh'; activeModule = 'gadh-commandes'; renderShell(); nav('gc-accueil'); });
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => GCV_VERSION === '0.0.2' && !!document.querySelector('[data-gc="bandeau"]')), 'tableau de bord V 0.0.2 affiché dans GTM');
  const espaces = await p.evaluate(() => gcNavItems().filter(i => i.show).map(i => i.tab));
  ok(espaces.length >= 6, 'menu : ' + espaces.join(', '));
  const ecrans = ['gc-commandes', 'gc-factures', 'gc-offres', 'gc-clients', 'gc-achats', 'gc-prix-achat', 'gc-fournisseurs', 'gc-previsionnel', 'gc-stock', 'gc-mouvements', 'gc-catalogue', 'gc-rentabilite', 'gc-journal', 'gc-reglages', 'gc-accords', 'gc-planning', 'gc-livraisons', 'gc-prix-reels', 'gc-arrivages'];
  const vides = [];
  for (const e of ecrans){ const n0 = err.length; await p.evaluate(t => nav(t), e); await p.waitForTimeout(250);
    const t = await p.evaluate(() => { const m = document.getElementById('main'); return m && !/Affichage impossible/.test(m.textContent) ? m.textContent.trim().length : 0; }); if (!t || err.length > n0) vides.push(e + (err.length > n0 ? ' : ' + err[err.length - 1] : '')); }
  ok(!vides.length, 'tous les écrans s\'ouvrent sans erreur' + (vides.length ? ' — ' + vides.join(' | ') : ''));
  // chargeur de données : fichier de données (inventées) fusionné sans doublon, données passées par setJSON (→ base)
  const r = await p.evaluate(() => { window.GADH_DONNEES = {format:'gadh-gc-donnees', version:1, genere:'2026-11-16', donnees:{
      gadh_gc_articles:[{id:'x1', ref:'ESSAI-1', designation:'Article essai', unite:'m', prixVente:5, prixAchat:3, actif:true, paliers:[], histoPrix:[]}],
      gadh_fact_clients:{c1:{nom:'Client Essai'}}, gadh_factures:{f1:{numero:'GA-2026-001', date:'2026-10-01', statut:'emise', type:'facture', lignes:[{designation:'x', qte:2, pu:100}], paiements:[{montant:50, date:'2026-10-10'}], clientId:'c1', echeance:'2999-01-01'}}}};
    const ecrit = []; const s0 = window.setJSON; window.setJSON = function(k, v){ ecrit.push(k); return s0.apply(this, arguments); };
    return Promise.resolve(gcChargerReprise()).then(x => { window.setJSON = s0;
      return {ecrit:ecrit.sort().join(','), art:getJSON('gadh_gc_articles', []).length, f:Object.keys(getJSON('gadh_factures', {})).length}; }); });
  ok(/gadh_gc_articles/.test(r.ecrit) && r.art >= 1 && r.f === 1, 'chargement d\'un fichier de données : enregistré dans les données GADH (' + JSON.stringify(r) + ')');
  ok(await p.evaluate(() => { const c = ddChiffreAffaires('gadh', '2026'); return c.ca === 200 && c.enc === 50 && c.n === 1; }), 'vue direction : factures GADH du CRM comptées');
  // bibliothèques de l'import PDF servies par le site
  const libs = await p.evaluate(async () => { const r = []; for (const k of ['pdfjs', 'pdfjsworker', 'tesseract', 'ocr']){ const x = await fetch(GC_LOCAL[k], {method:'HEAD'}); r.push(k + ':' + x.status); } return r.join(' '); });
  ok(!/:(?!200)\d+/.test(libs), 'bibliothèques PDF / OCR présentes : ' + libs);
  ok(cons.length === 0, 'aucune erreur d\'affichage du CRM' + (cons.length ? ' — ' + cons.slice(0, 3).join(' | ') : ''));
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.slice(0, 3).join(' | ') : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
