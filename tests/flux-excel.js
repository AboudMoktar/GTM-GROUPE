#!/usr/bin/env node
// Flux (saisie par étape, détaillé) : tableau façon Excel — titres figés, total par modèle mis à jour pendant la saisie,
// ↓ / Entrée descend dans la même colonne en sautant les cases bloquées. Données inventées.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8798), b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1366, height:768}})).newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8798/suivi-commandes.html?vue=gadh'); await p.waitForFunction(() => typeof S === 'object' && typeof render === 'function');
  await p.evaluate(() => {
    const sz = ['XS', 'S', 'M', 'L']; let n = 0, i = 0;
    [['MODELE A', [0, 0, 0, 0]], ['MODELE B', [20, 30, 40, 50]]].forEach(([lib, q]) => sz.forEach((z, k) => { const id = 'l' + (++n);
      S.lines.push({id, lot:'PK209902-1', year:2099, client:'CLIENT', model:'M', lib, size:z, qty:q[k] || 10, cc:0});
      if (q[k]) ['cp', 'gadh'].forEach(st => S.moves.push({id:'M' + (++i), date:'2099-01-10', lineId:id, stage:st, qty:q[k], nc:0, note:''}));
      if (q[k] && k === 0) S.moves.push({id:'M' + (++i), date:'2099-01-10', lineId:id, stage:'ret', qty:q[k], nc:0, note:''}); }));
    S.lots['PK209902-1'] = {received:'2099-01-01', ready:'2099-01-02'};
    ui.lot = 'PK209902-1'; ui.tab = 'flux'; ui.fmode = 'detail'; ui.stage = 'ret'; render();
  });
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('table.flux.xl th')).position === 'sticky'), 'ligne des titres figée');
  const tot = () => p.evaluate(() => [...document.querySelectorAll('table.flux.xl tr.xtot')].map(r => [...r.cells].map(c => c.textContent).join('|')));
  ok((await tot())[1] === 'Total|140|20|120|120|', 'total du modèle B (' + (await tot())[1] + ')');
  const ins = p.locator('table.flux.xl td.fr input:not(.nc):not([disabled])');
  await ins.first().focus(); await p.keyboard.type('5'); await p.waitForTimeout(100);
  ok((await tot())[1].endsWith('|95|'), 'total conformes mis à jour pendant la saisie');
  await p.keyboard.press('ArrowDown');
  ok(await p.evaluate(() => document.activeElement === document.querySelectorAll('table.flux.xl td.fr input:not(.nc):not([disabled])')[1]), '↓ : taille suivante, même colonne');
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
  ok(await p.evaluate(() => document.activeElement === document.querySelectorAll('table.flux.xl td.fr input:not(.nc):not([disabled])')[0]), '↑ : saute les cases bloquées et reste sur la première');
  ok(!err.length, 'aucune erreur JavaScript ' + err.join(' / '));
  await b.close(); s.close && s.close(); process.exit(echecs ? 1 : 0);
})();
