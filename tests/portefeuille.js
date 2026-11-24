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
  ok(cy === 'fait,fait,fait,fait,fait,-,-,-,-', 'cycle : confirmée, coupe → contrôle faits ; emballage, expédition, facture, paiement à faire (' + cy + ')');
  await p.evaluate(() => [...document.querySelectorAll('.pf .seg button')].find(x => x.textContent === 'Toutes').click()); await p.waitForTimeout(150);
  v = await vis(); ok(v.length === 2, 'Toutes : 2 commandes (' + v.join(' ; ') + ')');
  await p.evaluate(() => { const i = document.querySelector('.pf input[type=search]'); i.value = 'alloga'; i.dispatchEvent(new Event('input')); });
  v = await vis(); ok(v.length === 1 && /^PKB-1:Expédiée · à facturer/.test(v[0]), 'recherche par client ; expédiée sans facture : « à facturer » (' + v.join(' ; ') + ')');
  // facture émise puis payée (lue dans la facturation)
  const etat = (statut, reste) => p.evaluate(([statut, reste]) => {
    S.exports = [{id:'E1', n:1, d:'2026-11-12', cl:'ALLOGA', st:'fini', cartons:[{id:'C1', n:1, it:[['B1', 50, 'PKB-1', 'Modèle gris', 'S']]}]}];
    window.HOST = {facturesExports:() => [{id:'F1', exportId:'E1', numero:'FA26/031', statut, ttc:1000, reste}]};
    ui.pf = {f:'tout', q:'alloga'}; render();
    const tr = [...document.querySelectorAll('table.pf-t tbody tr')].find(t => t.style.display !== 'none');
    return tr.cells[8].textContent.trim() + '|' + [...tr.querySelectorAll('.pf-et')].slice(-2).map(e => e.className.replace('pf-et', '').trim() || '-').join(',');
  }, [statut, reste]);
  const e1 = await etat('impayee', 1000), e2 = await etat('retard', 1000), e3 = await etat('payee', 0);
  ok(/^Facturée · à encaisser\|fait,-$/.test(e1) && /^Paiement en retard\|fait,-? ?retard$|^Paiement en retard\|fait,retard$/.test(e2) && /^✔ Payée\|fait,fait$/.test(e3), 'facturée → paiement en retard → payée (' + [e1, e2, e3].join(' ; ') + ')');
  await p.evaluate(() => { ui.pf = {f:'fini', q:''}; render(); });
  v = await vis(); ok(v.length === 1 && /^PKB-1/.test(v[0]), 'Terminées = expédiées et payées (' + v.join(' ; ') + ')');
  await p.evaluate(() => { ui.pf = {f:'tout', q:'alloga'}; render(); });
  await p.evaluate(() => [...document.querySelectorAll('table.pf-t tbody tr')].find(t => t.style.display !== 'none').querySelector('button').click()); await p.waitForTimeout(150);
  ok(await p.evaluate(() => ui.tab === 'flux' && ui.lot === 'PKB-1'), 'Ouvrir ▸ mène au tableau de la commande');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
