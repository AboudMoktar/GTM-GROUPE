#!/usr/bin/env node
// Suivi PERCKO, onglet Exports : le disponible (chiffre gris) retire les pièces déjà expédiées hors export
// (passages « Expédition » de Flux ou Pilotage) ; dépasser reste permis (données d'essai, sans base).
// Lancement (dans tests/) : npm run export-dispo
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), p = await (await b.newContext({viewport: {width: 1300, height: 900}})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof vExports === 'function');
  const r = [];
  const d = await p.evaluate(() => {
    const L = (id, sz, q) => ({id, lot:'PK202611', year:2026, client:'NEOLYS', model:'M', lib:'LYNE PRO homme gris', size:sz, qty:q, cc:0});
    S.lines.push(L('S1', 'S', 100), L('M1', 'M', 100));
    ['cp', 'gadh', 'asm', 'ret', 'conf'].forEach((st, k) => { S.moves.push({id:'a' + k, date:'2026-11-01', lineId:'S1', stage:st, qty:80, nc:0, note:''}); S.moves.push({id:'b' + k, date:'2026-11-01', lineId:'M1', stage:st, qty:50, nc:0, note:''}); });
    /* 30 pièces S déjà expédiées depuis Pilotage (sans export) */
    ['ctl', 'emb', 'pret', 'exp'].forEach((st, k) => S.moves.push({id:'e' + k, date:'2026-11-05', lineId:'S1', stage:st, qty:30, nc:0, note:'Pilotage'}));
    S.lots.PK202611 = {ready:true};
    S.exports = [{id:'X1', n:1, cl:'NEOLYS', d:'2026-11-21', st:'cours', cartons:[]}];
    ui.tab = 'exp'; ui.xp = {id:'X1', carton:{nouveau:true}}; render();
    return {s:dispoRetour('PK202611', 'S1', null), m:dispoRetour('PK202611', 'M1', null)};
  });
  r.push(['disponible = retour − déjà expédié', d.s === 50 && d.m === 50]);
  const cell = (sz) => p.locator('.xp-mx input[title^="Lyne Pro Homme Gris · ' + sz + ' "]');
  r.push(['chiffre gris = disponible', await cell('S').getAttribute('placeholder') === '50' && await cell('M').getAttribute('placeholder') === '50']);
  r.push(['info : déjà expédié', /déjà expédié 30, disponible 50/.test(await cell('S').getAttribute('title'))]);
  await cell('S').fill('70'); await cell('M').fill('20');
  r.push(['dépassement signalé en rouge', await cell('S').getAttribute('class') === 'trop' && await cell('M').getAttribute('class') === 'plein']);
  await p.locator('button', {hasText: 'Valider et carton suivant'}).click(); await p.waitForTimeout(500);
  r.push(['dépassement permis : carton enregistré', await p.evaluate(() => S.exports[0].cartons.length === 1)]);
  r.push(['carton suivant : disponible recalculé', await cell('S').getAttribute('placeholder') === '' && await cell('M').getAttribute('placeholder') === '30']);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
