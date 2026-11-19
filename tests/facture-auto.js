#!/usr/bin/env node
// Facture d'export automatique : dès qu'un carton est enregistré dans un export en cours, son brouillon de facture
// existe ; chaque carton ajouté le remet à jour. Données inventées.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => { const s = serveur.demarrer(8794), b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'})).newPage();
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8794/index.html'); await p.waitForFunction(() => typeof renderShell === 'function');
  await p.evaluate(() => { hlEcritureAutorisee = () => true; currentUser = {username:'admin', nom:'A', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true}};
    memoryCache['grp1_fact_params'] = {tarifExport:percTarif().map((a, i) => ({code:a.code, prix:10 + i}))}; memoryCache['grp1_fact_clients'] = {defaut:{nom:'PERCKO'}};
    activeSociete = 'tek'; activeModule = 'commandes'; renderShell(); nav('commandes-home'); });
  await p.waitForTimeout(1500);
  const fr = p.frames().find(f => /suivi-commandes/.test(f.url()));
  await fr.waitForFunction(() => typeof pkExports === 'object');
  
  await fr.evaluate(() => { S.lines.push({id:'a1', lot:'PKT', client:'NEOLYS', model:'PHARMA-HOMME', lib:'PHARMA_HOMME COL V NOIR', size:'S', qty:500, cc:0}); ['cp','gadh','asm','ret'].forEach((st,q) => S.moves.push({id:'M'+q, date:'2026-11-10', lineId:'a1', stage:st, qty:500, nc:0, note:''}));
    S.exports = [{id:'E1', n:3, d:'2026-11-21', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', com:'', cartons:[]}];
    commit(function(){ pkExports.enregistrerCartonExport(S.exports[0], {id:'C1', n:1, kg:5, com:'', it:[['a1', 10, 'PKT', 'PHARMA_HOMME COL V NOIR', 'S']]}); }); });
  await p.waitForTimeout(2000);
  const a = await p.evaluate(() => JSON.stringify(Object.values(factToutes('tek')).map(f => [f.statut, f.lignes.map(l => l.ref + ':' + l.qte)])));
  ok(a === '[["brouillon",["ART001:10"]]]', 'premier carton : brouillon de facture créé tout seul (' + a + ')');
  await fr.evaluate(() => { commit(function(){ pkExports.enregistrerCartonExport(S.exports[0], {id:'C2', n:2, kg:5, com:'', it:[['a1', 7, 'PKT', 'PHARMA_HOMME COL V NOIR', 'S']]}); }); });
  await p.waitForTimeout(2000);
  const c = await p.evaluate(() => JSON.stringify(Object.values(factToutes('tek')).map(f => [f.statut, f.percko.colis, f.lignes.map(l => l.ref + ':' + l.qte)])));
  ok(c === '[["brouillon",2,["ART001:17"]]]', 'carton ajouté : la même facture est remise à jour, sans doublon (' + c + ')');
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'aucune erreur'); process.exit(echecs ? 1 : 0); })();
