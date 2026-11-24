#!/usr/bin/env node
// Suivi PERCKO, saisie d'un carton (24/11/2026) : les exosquelettes et les brassières sont toujours proposés,
// même pour une commande qui n'en contient pas (repris des autres commandes, sinon modèles de base). Données d'essai.
// Lancement (dans tests/) : node carton-exo-bra.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8843), b = await chromium.launch(), p = await b.newPage({viewport:{width:1280, height:900}}); const err = []; p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8843/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof render === 'function' && typeof pkExports === 'object');
  const liste = () => p.evaluate(() => [...document.querySelectorAll('table.xp-mx tbody tr')].map(tr => (tr.cells[0] || {}).textContent || '').map(t => t.trim()).filter(Boolean));
  await p.evaluate(() => {
    ['XS', 'S', 'M'].forEach((z, j) => { const id = 'L' + j; S.lines.push({id, lot:'PKT', client:'NEOLYS', model:'M0', lib:'Modèle essai noir', size:z, qty:50, cc:0});
      ['cp', 'gadh', 'asm', 'ret'].forEach((st, q) => S.moves.push({id:'M' + id + q, date:'2026-11-10', lineId:id, stage:st, qty:50, nc:0, note:''})); });
    S.exports = [{id:'E1', n:1, d:'2026-11-21', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', com:'', cartons:[]}];
    ui.lot = 'PKT'; ui.tab = 'exp'; ui.xp = {id:'E1', carton:{nouveau:true}}; render();
  });
  await p.waitForTimeout(200);
  let l = await liste();
  ok(l.some(x => /Modèle essai noir/i.test(x)) && l.some(x => /^Exosquelette$/i.test(x)) && ['A-B', 'C-D', 'E-F', 'G-H'].every(z => l.some(x => new RegExp('Brassi.re ' + z, 'i').test(x))), 'commande sans exo ni brassière : modèles de base proposés (' + l.join(' ; ') + ')');
  // exo et brassières d'une autre commande : repris tels quels (libellés et tailles)
  await p.evaluate(() => {
    S.lines.push({id:'X1', lot:'PKA', client:'NEOLYS', model:'EXOSQUELETTE', lib:'EXOSQUELETTE V2', size:'TU', qty:10, cc:0});
    S.lines.push({id:'B1', lot:'PKA', client:'NEOLYS', model:'BRASSIERE', lib:'BRASSIERE SPORT NOIRE', size:'M', qty:10, cc:0});
    ui.xp = {id:'E1', carton:{nouveau:true}}; render();
  });
  await p.waitForTimeout(200);
  l = await liste();
  ok(l.some(x => /Exosquelette V2/i.test(x)) && l.some(x => /Brassiere Sport Noire/i.test(x)) && !l.some(x => /^Exosquelette$/i.test(x)), 'exo et brassières des autres commandes repris (' + l.join(' ; ') + ')');
  // saisie d'une quantité d'exosquelette dans le carton
  const it = await p.evaluate(() => { const i = [...document.querySelectorAll('table.xp-mx input')].find(x => /EXOSQUELETTE V2|Exosquelette V2/i.test(x.title)); if (!i) return null; i.value = '6'; i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true})); return document.querySelector('.xp-tot').textContent; });
  ok(it === '6', 'quantité d\'exosquelette saisie dans le carton (total ' + it + ')');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
