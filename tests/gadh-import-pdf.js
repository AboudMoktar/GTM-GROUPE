#!/usr/bin/env node
// GADH — CRM V 0.0.2 : import d'une commande PDF (texte, puis document scanné lu par OCR en français, bibliothèques
// servies par le site). Fichiers d'essai inventés (fixtures/commande-essai-*.pdf).
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8803), b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1366, height:900}, serviceWorkers:'block'})).newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8803/index.html'); await p.waitForFunction(() => typeof gcpdfTraiter === 'function');
  await p.evaluate(() => { hlEcritureAutorisee = () => true;
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{gadh:true}};
    activeSociete = 'gadh'; activeModule = 'gadh-commandes'; renderShell(); nav('gc-accueil');
    gcEnregistrer('articles', [{id:'a1', ref:'ESSAI-1', designation:'Article essai bleu', unite:'m', prixVente:5, prixAchat:3, actif:true, paliers:[], histoPrix:[]}, {id:'a2', ref:'ESSAI-2', designation:'Article essai rouge', unite:'m', prixVente:7.5, prixAchat:4, actif:true, paliers:[], histoPrix:[]}]);
    setJSON('gadh_fact_clients', {c1:{nom:'SOCIETE EXEMPLE SARL'}}); gcCacheD = null;
    const f0 = gcpdfOuvrirFormulaire; gcpdfOuvrirFormulaire = function(A){ window.__A = A; return f0.apply(this, arguments); }; });
  const lire = async (fichier, delai) => { await p.evaluate(() => gcpdfOuvrir('client')); await p.waitForTimeout(300);
    await p.locator('#mgt-modal-zone input[type=file]').first().setInputFiles(__dirname + '/fixtures/' + fichier);
    await p.waitForFunction(() => window.__A, null, {timeout:delai}).catch(() => {});
    const r = await p.evaluate(() => { const A = window.__A || {}; return {ocr:!!A.ocr, numero:A.numero || '', lignes:(A.lignes || []).map(l => [l.ref || l.refClient || l.designation || '', l.qte, l.pu || l.prix || ''].join(':')), cles:Object.keys(A).join(','), etat:(document.getElementById('gcpdf-etat') || {}).textContent || ''}; });
    await p.evaluate(() => { window.__A = null; try { mgtFermer(); } catch(e) {} }); return r; };
  const t = await lire('commande-essai-texte.pdf', 30000);
  ok(!t.ocr && /99001/.test(t.numero) && t.lignes.join() === 'ESSAI-1:1000:5,ESSAI-2:500:7.5' || (!t.ocr && /99001/.test(t.numero) && t.lignes.length === 2), 'PDF texte : PO 99001, 2 lignes lues (' + JSON.stringify(t) + ')');
  const o = await lire('commande-essai-scan.pdf', 240000);
  ok(o.ocr && o.lignes.length >= 1, 'PDF scanné : lu par OCR (français), lignes reconnues (' + JSON.stringify(o) + ')');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.slice(0, 3).join(' | ') : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
