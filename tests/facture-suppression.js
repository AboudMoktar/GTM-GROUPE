#!/usr/bin/env node
// Suppression d'une facture déjà émise (administrateur seulement, confirmation par le numéro) :
// le compteur recule si c'est le dernier numéro, l'export redevient facturable, une facture avec avoir est protégée.
// Données inventées. Lancement (dans tests/) : npm run facture-suppression
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8786), b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1366, height:768}, serviceWorkers:'block'})).newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8786/index.html'); await p.waitForFunction(() => typeof renderShell === 'function' && typeof factSupprimerEmise === 'function');
  const prep = (role) => p.evaluate(role => { hlEcritureAutorisee = () => true;
    currentUser = {username:'u', nom:'Essai', role, profil:role === 'admin' ? 'sysadmin' : 'lecture', groupe:role === 'admin', societes:{tek:true}};
    const L = [{designation:'Article essai', qte:10, pu:5, remise:0}];
    memoryCache['grp1_fact_clients'] = {defaut:{nom:'CLIENT ESSAI'}};
    memoryCache['grp1_fact_compteurs'] = {FA:{'2026':32}, AV:{'2026':1}};
    memoryCache['grp1_factures'] = {
      f10:{type:'facture', numero:'FA26/030', statut:'emise', date:'2026-10-01', echeance:'2026-10-31', clientId:'defaut', client:{nom:'CLIENT ESSAI', adresse:'', mf:''}, lignes:L, tva:0, timbre:0, paiements:[]},
      f11:{type:'facture', numero:'FA26/031', statut:'emise', date:'2026-10-05', echeance:'2026-11-04', clientId:'defaut', client:{nom:'CLIENT ESSAI', adresse:'', mf:''}, lignes:L, tva:0, timbre:0, paiements:[]},
      a1:{type:'avoir', numero:'AV-2026-001', statut:'emise', date:'2026-10-06', clientId:'defaut', client:{nom:'CLIENT ESSAI', adresse:'', mf:''}, factureLiee:'f11', lignes:L, tva:0, timbre:0},
      f12:{type:'facture', numero:'FA26/032', statut:'emise', date:'2026-11-16', echeance:'2026-12-16', clientId:'defaut', client:{nom:'CLIENT ESSAI', adresse:'', mf:''}, lignes:L, tva:0, timbre:0, paiements:[{date:'2026-11-17', montant:10, mode:'virement'}], origine:{type:'export', exportId:'X1', label:'N°1'}}};
    activeSociete = 'tek'; activeModule = 'factures'; renderShell(); }, role);
  const ouvrir = (id) => p.evaluate(id => { factOuvrir(id); }, id).then(() => p.waitForTimeout(300));
  const bouton = () => p.locator('button', {hasText:/^Supprimer (la facture|l'avoir)/});
  const repondre = (texte) => { p.removeAllListeners('dialog'); p.on('dialog', d => d.type() === 'prompt' ? d.accept(texte) : d.accept()); };

  // lecture seule : pas de bouton
  await prep('viewer'); await ouvrir('f12');
  ok(await bouton().count() === 0, 'compte en lecture : aucun bouton de suppression');
  // administrateur
  await prep('admin'); await ouvrir('f12');
  ok(await bouton().count() === 1 && /FA26\/032/.test(await bouton().textContent()), 'administrateur : bouton « Supprimer la facture FA26/032 »');
  repondre('FA26/099'); await bouton().click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!factToutes('tek').f12), 'numéro mal retapé : rien n\'est supprimé');
  let msg = ''; p.removeAllListeners('dialog'); p.on('dialog', d => { msg = d.message(); d.accept('fa26/032'); });
  await bouton().click(); await p.waitForTimeout(400);
  const e1 = await p.evaluate(() => ({existe:!!factToutes('tek').f12, cpt:getJSON('fact_compteurs', {}).FA['2026'], ecran:document.querySelector('main').innerText}));
  ok(!e1.existe && e1.cpt === 31, 'dernier numéro supprimé : facture effacée, compteur ramené à 31 (prochaine = FA26/032)');
  ok(/paiement/.test(msg) && /dernier numéro/.test(msg), 'l\'avertissement cite le paiement et le dernier numéro');
  ok(await p.evaluate(() => factNumero('tek', 'facture', '2026')) === 'FA26/032', 'la facture suivante reprend bien le numéro FA26/032');
  // facture avec avoir : protégée
  await prep('admin'); await ouvrir('f11'); repondre('FA26/031'); await bouton().click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!factToutes('tek').f11), 'facture qui a un avoir : suppression refusée');
  // facture qui n'est pas la dernière : supprimée, compteur inchangé (trou signalé)
  await prep('admin'); await ouvrir('f10'); msg = ''; p.removeAllListeners('dialog'); p.on('dialog', d => { msg = d.message(); d.accept('FA26/030'); });
  await bouton().click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !factToutes('tek').f10 && getJSON('fact_compteurs', {}).FA['2026'] === 32) && /trou/.test(msg), 'numéro du milieu : supprimée, compteur inchangé, trou signalé');
  // l'avoir lui-même se supprime, puis la facture
  await prep('admin'); await ouvrir('a1'); repondre('AV-2026-001'); await bouton().click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !factToutes('tek').a1 && getJSON('fact_compteurs', {}).AV['2026'] === 0), 'avoir supprimé (compteur des avoirs ramené à 0)');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
