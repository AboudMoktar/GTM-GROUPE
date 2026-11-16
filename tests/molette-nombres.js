#!/usr/bin/env node
// La molette de la souris ne doit jamais changer une quantité saisie : elle fait défiler la page.
// (Saisie d'un carton du suivi : 58 saisi, molette pour descendre valider, la quantité changeait.)
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8786), b = await chromium.launch(), p = await b.newPage({viewport:{width:1280, height:700}}); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8786/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof render === 'function' && typeof pkExports === 'object');
  await p.evaluate(() => {
    for (let i = 0; i < 30; i++) ['S', 'M', 'L'].forEach((z, j) => { const id = 'L' + i + '_' + j; S.lines.push({id, lot:'PKT', client:'NEOLYS', model:'M' + i, lib:'Modèle essai ' + i, size:z, qty:200, cc:0});
      ['cp', 'gadh', 'asm', 'ret'].forEach((st, q) => S.moves.push({id:'M' + id + q, date:'2026-11-10', lineId:id, stage:st, qty:200, nc:0, note:''})); });
    S.exports = [{id:'E1', n:1, d:'2026-11-21', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', com:'', cartons:[]}];
    ui.lot = 'PKT'; ui.tab = 'exp'; ui.xp = {id:'E1', carton:{nouveau:true}}; render();
  });
  const champ = p.locator('.xp-mx input').nth(4);
  await champ.click(); await champ.fill('58');
  const bx = await champ.boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  const avant = await p.evaluate(() => document.getElementById('view').scrollTop);
  for (let i = 0; i < 6; i++){ await p.mouse.wheel(0, 120); await p.waitForTimeout(60); }
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({v:[...document.querySelectorAll('.xp-mx input')][4].value, defile:document.getElementById('view').scrollTop, actif:document.activeElement.tagName}));
  ok(r.v === '58', 'molette au-dessus du champ : la quantité saisie reste 58 (lu : ' + r.v + ')');
  ok(r.defile > avant + 100, 'la page a défilé (' + avant + ' → ' + r.defile + ')');
  ok(/58/.test(await p.locator('.xp-sticky').innerText()), 'le total du carton affiche toujours 58 pièces');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur'); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
