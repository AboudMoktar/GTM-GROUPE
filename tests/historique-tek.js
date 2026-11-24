#!/usr/bin/env node
// Historique TEK-TREND : commandes (quantités totales par commande et par mois) et saisie rapide des factures
// (numéro, date, montant). Données inventées. Lancement (dans tests/) : npm run historique-tek
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8787), b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1366, height:768}, serviceWorkers:'block'})).newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8787/index.html'); await p.waitForFunction(() => typeof renderHistoriqueTek === 'function');
  const prep = (role) => p.evaluate(role => { hlEcritureAutorisee = () => true;
    currentUser = {username:'u', nom:'Essai', role, profil:role === 'admin' ? 'sysadmin' : 'lecture', groupe:role === 'admin', societes:{tek:true}};
    activeSociete = 'tek'; activeModule = 'factures'; renderShell(); nav('fact-historique'); }, role);
  await p.evaluate(() => { memoryCache['grp1_fact_clients'] = {defaut:{nom:'PERCKO'}}; memoryCache['grp1_fact_compteurs'] = {FA:{'2026':28}};
    memoryCache['grp1_factures'] = {x27:{type:'facture', numero:'FA26/027', statut:'emise', date:'2026-10-10', clientId:'defaut', client:{nom:'PERCKO'}, lignes:[{designation:'a', qte:1, pu:20}], tva:0, timbre:0, paiements:[]}}; });
  await prep('admin'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('.sidebar nav button[data-tab]')].map(x => x.textContent.trim()).join('|')) === 'Factures|Historique|Clients|Réglages', 'Facturation : onglet « Historique »');
  ok(await p.inputValue('#hk-num') === 'PK202601-1', 'premier numéro proposé : PK202601-1');
  const ajout = async (n, a, br, exo) => { await p.fill('#hk-num', n); await p.fill('#hk-sv', String(a)); await p.fill('#hk-br', String(br)); await p.fill('#hk-exo', String(exo)); await p.click('text=Ajouter'); await p.waitForTimeout(200); };
  await ajout('PK202601-1', 1200, 300, 40); await ajout('pk202602-1', 900, 150, 0); await ajout('PK202602-2', 100, 0, 10);
  ok(await p.inputValue('#hk-num') === 'PK202603-1', 'numéro suivant proposé : PK202603-1');
  await ajout('PK202601-1', 5, 0, 0);
  ok(await p.evaluate(() => Object.keys(getJSON('fact_historique', {}).commandes).length) === 3, 'commande déjà saisie : refusée');
  await ajout('PK202613-1', 5, 0, 0);
  ok(await p.evaluate(() => Object.keys(getJSON('fact_historique', {}).commandes).length) === 3, 'mois 13 : refusé');
  const tab = await p.evaluate(() => [...document.querySelectorAll('.hk-tab')[0].querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => (c.querySelector('input') ? c.querySelector('input').value : c.textContent).replace(/\s/g, '')).join('|')));
  ok(tab[0] === 'Janvier2026|1200|300|40|1540|' && tab[2] === 'Février2026|1000|150|10|1160|' && tab[5] === 'Total2026|2200|450|50|2700|', 'regroupement par mois et totaux (' + tab.join(' ; ') + ')');
  ok(await p.evaluate(() => [...document.querySelectorAll('.hk-kpi b')].map(x => x.textContent.replace(/\s/g, '')).slice(0, 5).join('|')) === '3|2700|2200|450|50', 'compteurs : 3 commandes, 2 700 pièces, 2 200 / 450 / 50');
  // correction d'une quantité et suppression
  await p.locator('tr', {hasText:'PK202602-2'}).locator('.hk-q').nth(0).fill('150'); await p.locator('tr', {hasText:'PK202602-2'}).locator('.hk-q').nth(0).dispatchEvent('change'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Object.values(getJSON('fact_historique', {}).commandes).find(c => c.num === 'PK202602-2').sv) === 150, 'quantité corrigée directement dans le tableau');
  p.once('dialog', d => d.accept()); await p.locator('tr', {hasText:'PK202602-2'}).locator('button').click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Object.keys(getJSON('fact_historique', {}).commandes).length) === 2, 'commande supprimée de l\'historique');
  // factures : numéros manquants proposés d'abord
  const l = p.locator('#hk-fact .hk-lf');
  ok(await l.nth(0).locator('.hk-fn').inputValue() === 'FA26/001' && await l.nth(2).locator('.hk-fn').inputValue() === 'FA26/003', 'saisie rapide : propose FA26/001, 002, 003 (numéros manquants)');
  await l.nth(0).locator('.hk-fd').fill('2026-01-31'); await l.nth(0).locator('.hk-fm').fill('15230.5'); await l.nth(0).locator('.hk-fc').fill('pk202601-1');
  await l.nth(1).locator('.hk-fd').fill('2025-02-27'); await l.nth(1).locator('.hk-fm').fill('9870');
  await l.nth(2).locator('.hk-fd').fill('2026-03-05');                         // FA26/003 sans montant
  await p.click('text=Enregistrer les factures'); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => ({n:Object.values(factToutes('tek')).map(f => f.numero).sort().join(','), rouge:[...document.querySelectorAll('#hk-fact .hk-err')].map(tr => tr.querySelector('.hk-fn').value + '|' + tr.querySelector('.hk-fd').value + '|' + tr.querySelector('.hk-fm').value)}));
  ok(e1.n === 'FA26/001,FA26/003,FA26/027', 'lignes justes enregistrées malgré une ligne en erreur (' + e1.n + ')');
  ok(e1.rouge.join() === 'FA26/002|2025-02-27|9870', 'ligne en erreur gardée en rouge avec sa saisie, à corriger');
  ok(await p.evaluate(() => { const f = Object.values(factToutes('tek')).find(x => x.numero === 'FA26/003'); return factTotaux(f).ttc === 0 && factStatut(f, factToutes('tek')) === 'payee' && !(f.paiements || []).length; }), 'facture sans montant : enregistrée à 0 €, sans paiement');
  await p.locator('#hk-fact .hk-err .hk-fd').fill('2026-02-27'); await p.locator('#hk-fact .hk-err .hk-fp').uncheck();
  await p.click('text=Enregistrer les factures'); await p.waitForTimeout(300);
  const F = await p.evaluate(() => Object.values(factToutes('tek')).filter(f => f.numero !== 'FA26/027').sort((a, b) => a.numero < b.numero ? -1 : 1).map(f => ({n:f.numero, d:f.date, ech:f.echeance, ttc:factTotaux(f).ttc, st:factStatut(f, factToutes('tek')), o:f.objet, or:f.origine.type})));
  ok(F.length === 3 && F[0].n === 'FA26/001' && F[0].ttc === 15230.5 && F[0].st === 'payee' && F[0].o === 'PK202601-1' && F[0].or === 'saisie', 'FA26/001 enregistrée : 15 230,50 €, payée, commande PK202601-1');
  ok(F[1].n === 'FA26/002' && F[1].ttc === 9870 && F[1].st !== 'payee' && F[1].ech === '2026-03-29', 'FA26/002 corrigée puis enregistrée, non payée : échéance à 30 jours');
  ok(await p.evaluate(() => getJSON('fact_compteurs', {}).FA['2026']) === 28, 'compteur inchangé (28) : la prochaine facture reste FA26/029');
  ok(await p.evaluate(() => /FA26\/004/.test(document.querySelector('.hk-manq').textContent) && !/FA26\/00[123]/.test(document.querySelector('.hk-manq').textContent)), 'numéros manquants mis à jour');
  const tots = await p.evaluate(() => [...document.querySelectorAll('.hk-tots b')].map(b => b.textContent.replace(/\s/g, '')).join('|'));
  ok(tots === '25120,50€|15230,50€|9890,00€', 'total facturé, encaissé, reste à encaisser (' + tots + ')');
  ok(await p.evaluate(() => /Total encaissé/.test(document.body.innerText) && /Reste à encaisser/.test(document.body.innerText)), 'lignes « Total encaissé » et « Reste à encaisser » sous la liste');
  // modification directe dans la liste (factures saisies à la main)
  ok(await p.locator('#hk-liste .hk-le').count() === 3 && await p.locator('#hk-liste .hk-clic').count() === 1, 'liste : 3 factures saisies modifiables, FA26/027 (autre origine) s\'ouvre en fiche');
  const lg = p.locator('#hk-liste .hk-le', {has:p.locator('.hk-en[value="FA26/003"]')});
  await lg.locator('.hk-en').fill('FA26/012'); await lg.locator('.hk-ed').fill('2026-04-21'); await lg.locator('.hk-em').fill('500'); await lg.locator('.hk-ec').fill('pk202604-1');
  const l2 = p.locator('#hk-liste .hk-le', {has:p.locator('.hk-en[value="FA26/002"]')}); await l2.locator('.hk-ep').check();
  ok(await p.locator('#hk-maj').isEnabled(), 'bouton « Enregistrer les modifications » actif après une modification');
  await p.click('#hk-maj'); await p.waitForTimeout(300);
  const E = await p.evaluate(() => { const l = factToutes('tek'), f = Object.values(l).find(x => x.numero === 'FA26/012'), g = Object.values(l).find(x => x.numero === 'FA26/002');
    return {n:Object.values(l).map(x => x.numero).sort().join(','), f12:f && [f.date, factTotaux(f).ttc, f.objet, factStatut(f, l)].join('|'), f2:factStatut(g, l), cpt:getJSON('fact_compteurs', {}).FA['2026']}; });
  ok(E.n === 'FA26/001,FA26/002,FA26/012,FA26/027' && E.f12 === '2026-04-21|500|PK202604-1|payee', 'FA26/003 renumérotée FA26/012, date, montant et commande modifiés (' + E.f12 + ')');
  ok(E.f2 === 'payee', 'FA26/002 cochée « Payée » : encaissée');
  ok(E.cpt === 27, 'compteur recalé sur le plus grand numéro émis (27) : prochaine facture FA26/028');
  const l3 = p.locator('#hk-liste .hk-le', {has:p.locator('.hk-en[value="FA26/012"]')}); await l3.locator('.hk-en').fill('FA26/027'); await p.click('#hk-maj'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Object.values(factToutes('tek')).some(x => x.numero === 'FA26/012')), 'renumérotation vers un numéro déjà pris : refusée');
  p.once('dialog', d => d.accept()); await p.locator('#hk-liste .hk-le', {has:p.locator('.hk-en[value="FA26/012"]')}).locator('button').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !Object.values(factToutes('tek')).some(x => x.numero === 'FA26/012')), 'facture saisie supprimée depuis la liste');
  // doublon refusé
  await p.locator('#hk-fact .hk-lf').nth(0).locator('.hk-fn').fill('FA26/027'); await p.locator('#hk-fact .hk-lf').nth(0).locator('.hk-fd').fill('2026-10-11'); await p.locator('#hk-fact .hk-lf').nth(0).locator('.hk-fm').fill('5');
  await p.click('text=Enregistrer les factures'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Object.keys(factToutes('tek')).length === 3 && document.querySelectorAll('#hk-fact .hk-err').length === 1), 'numéro existant : refusé, ligne gardée en rouge');
  // même écran depuis Suivi des Commandes
  await p.evaluate(() => { activeModule = 'commandes'; renderShell(); nav('cmd-historique'); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('.hk-tab') && [...document.querySelectorAll('.sidebar nav button[data-tab]')].map(x => x.textContent.trim()).join('|') === 'Commandes|Historique'), 'Suivi des Commandes : onglet « Historique » (même écran)');
  // commandes reprises du suivi (novembre 2026 et après) : par modèle et par taille, 2e choix retiré ; octobre ignoré
  await p.evaluate(() => {
    const L = (id, model, lib, z, q) => [id, 0, 'NEOLYS', model, lib, z, q];
    memoryCache[CACHE_PREFIX + 'suivi_index'] = ['lines-PK202611-1', 'lines-PK202612-1', 'lines-PK202610-1', 'moves-PK202611-1-1'];
    memoryCache[CACHE_PREFIX + 'suivi_d_lines-PK202611-1'] = {lot:'PK202611-1', lines:[L('a', 'LYNE PRO', 'LYNE PRO homme noir', 'S', 100), L('b', 'LYNE PRO', 'LYNE PRO homme noir', 'M', 200), L('c', 'LYNE PRO', 'LYNE PRO homme gris', 'M', 50), L('d', 'BRASSIERE', 'BRASSIERE noire', 'S', 30)]};
    memoryCache[CACHE_PREFIX + 'suivi_d_lines-PK202612-1'] = {lot:'PK202612-1', lines:[L('e', 'EXOSQUELETTE', 'EXOSQUELETTE', 'TU', 12)]};
    memoryCache[CACHE_PREFIX + 'suivi_d_lines-PK202610-1'] = {lot:'PK202610-1', lines:[L('f', 'LYNE PRO', 'LYNE PRO homme noir', 'S', 999)]};
    memoryCache[CACHE_PREFIX + 'suivi_d_moves-PK202611-1-1'] = {moves:[['m1', '2026-11-20', 'b', 'emb', 0, 0, 6, '', '', 1]]};
    nav('cmd-historique'); });
  await p.waitForTimeout(300);
  const su = await p.evaluate(() => ({
    lignes: [...document.querySelectorAll('.hk-tab')[0].querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => (c.querySelector('input') ? c.querySelector('input').value : c.textContent).replace(/\s/g, '')).join('|')),
    det: [...document.querySelectorAll('.hk-det')].map(d => d.querySelector('summary').textContent.replace(/\s+/g, ' ').trim()),
    mat: [...document.querySelectorAll('.hk-det')][0] ? [...document.querySelectorAll('.hk-det')[0].querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s/g, '')).join('|')) : [],
    rs: document.querySelector('.hk-det .hk-mod') ? document.querySelector('.hk-det .hk-mod').rowSpan : 0 }));
  ok(su.lignes.some(x => x === 'PK202611-1suivi|344|30|0|374|') && su.lignes.some(x => x === 'PK202612-1suivi|0|0|12|12|') && !su.lignes.some(x => /PK202610/.test(x)), 'novembre et décembre repris du suivi (2e choix retiré), octobre laissé à la saisie (' + su.lignes.join(' ; ') + ')');
  ok(su.det.length === 2 && /PK202611-1 · Novembre 2026 · 374 pièces/.test(su.det[0]) && /6 en 2e choix/.test(su.det[0]), 'détail par commande (' + su.det.join(' ; ') + ')');
  ok(su.mat[0] === 'BRASSIERE|BRASSIEREnoire|30||30' && su.mat[1] === 'LYNEPRO|LYNEPROhommegris||50|50' && su.mat[3] === 'TotalLYNEPRO|100|244|344' && su.rs === 1, 'tableau modèle × taille, modèle fusionné sur ses libellés (' + su.mat.join(' ; ') + ')');
  // lecture seule
  await prep('viewer'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('hk-num') && !document.getElementById('hk-fact') && document.querySelectorAll('.hk-tab .hk-q').length === 0 && /PK202601-1/.test(document.body.innerText)), 'compte en lecture : consultation sans saisie');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
