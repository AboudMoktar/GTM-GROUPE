#!/usr/bin/env node
// Suivi PERCKO, Tableau (24/11/2026) : portefeuille des commandes comme un ERP — une ligne par commande, cycle des
// étapes, avancement, reste, retard ; filtres En cours / Terminées / Toutes et recherche. Données d'essai.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8848), b = await chromium.launch(), p = await b.newPage({viewport:{width:1366, height:900}}); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8848/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof portefeuille === 'function');
  await p.evaluate(() => {
    let i = 0;
    S.lines.push({id:'A1', lot:'PKA-1', year:2026, client:'NEOLYS', model:'M', lib:'Modèle noir', size:'M', qty:100, cc:0});
    S.lines.push({id:'B1', lot:'PKB-1', year:2026, client:'ALLOGA', model:'M', lib:'Modèle gris', size:'S', qty:50, cc:0});
    ['cp', 'gadh', 'ret', 'ctl'].forEach(st => S.moves.push({id:'M' + (++i), date:'2026-11-10', lineId:'A1', stage:st, qty:100, nc:0, note:''}));
    ['cp', 'gadh', 'ret', 'ctl', 'emb', 'exp'].forEach(st => S.moves.push({id:'M' + (++i), date:'2026-11-12', lineId:'B1', stage:st, qty:50, nc:0, note:''}));
    S.lots['PKA-1'] = {ready:'2026-11-01', livraison:'2020-01-01'}; S.lots['PKB-1'] = {ready:'2026-11-01'};
    ui.tab = 'dash'; ui.lot = 'PKA-1'; render();
  });
  await p.waitForTimeout(200);
  const vis = () => p.evaluate(() => [...document.querySelectorAll('table.pf-t tbody tr')].filter(t => t.style.display !== 'none' && t.cells.length > 1).map(t => t.cells[0].textContent.trim().slice(0, 5) + ':' + t.cells[8].textContent.trim()));
  let v = await vis();
  ok(v.length === 1 && /^PKA-1:En retard/.test(v[0]), 'En cours : la commande en retard, avec son retard (' + v.join(' ; ') + ')');
  const cy = await p.evaluate(() => [...document.querySelectorAll('table.pf-t tbody tr')[0].querySelectorAll('.pf-et')].map(e => e.className.replace('pf-et', '').trim() || '-').join(','));
  ok(cy === 'fait,fait,fait,fait,-,-', 'cycle : coupe → contrôle faits, emballage et expédition à faire (' + cy + ')');
  await p.evaluate(() => [...document.querySelectorAll('.pf .seg button')].find(x => x.textContent === 'Toutes').click()); await p.waitForTimeout(150);
  v = await vis(); ok(v.length === 2, 'Toutes : 2 commandes (' + v.join(' ; ') + ')');
  await p.evaluate(() => { const i = document.querySelector('.pf input[type=search]'); i.value = 'alloga'; i.dispatchEvent(new Event('input')); });
  v = await vis(); ok(v.length === 1 && /^PKB-1:✔ Terminée/.test(v[0]), 'recherche par client (' + v.join(' ; ') + ')');
  await p.evaluate(() => [...document.querySelectorAll('table.pf-t tbody tr')].find(t => t.style.display !== 'none').querySelector('button').click()); await p.waitForTimeout(150);
  ok(await p.evaluate(() => ui.tab === 'flux' && ui.lot === 'PKB-1'), 'Ouvrir ▸ mène au tableau de la commande');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
