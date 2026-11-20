#!/usr/bin/env node
// Pièces restantes passées en 2e choix (Flux), par taille et par modèle : retirées de la commande (quantité commandée,
// reste à produire, état de commande), conservées à l'enregistrement, annulables. Données inventées.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8796), b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1366, height:900}})).newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8796/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof deuxiemeChoix === 'function');
  await p.evaluate(() => {
    const L = (id, lib, sz, q) => ({id, lot:'PK209901-1', year:2099, client:'NEOLYS', model:'PHARMA-FEMME', lib, size:sz, qty:q, cc:0});
    S.lines.push(L('a', 'PHARMA_FEMME COL V ROSE', 'XS', 110), L('b', 'PHARMA_FEMME COL V ROSE', 'S', 235), L('c', 'PHARMA_FEMME COL V NOIR', 'M', 40));
    S.lots['PK209901-1'] = {received:'2099-01-01', ready:'2099-01-02'};
    let i = 0; const mv = (lineId, stage, qty) => S.moves.push({id:'M' + (++i), date:'2099-01-10', lineId, stage, qty, nc:0, note:''});
    ['cp', 'gadh', 'asm', 'ret', 'ctl'].forEach(st => { mv('a', st, 110); mv('b', st, 235); mv('c', st, 40); });
    mv('a', 'emb', 108); mv('b', 'emb', 225); mv('c', 'emb', 30);
    ui.lot = 'PK209901-1'; ui.tab = 'flux'; ui.fmode = 'detail'; ui.stage = 'emb'; render();
  });
  await p.click('[data-ch2]'); await p.waitForTimeout(300);
  ok(await p.locator('[data-ch2l]').count() === 3, 'panneau 2e choix : une case par taille ayant un reste (XS 2, S 10, M 10)');
  await p.locator('button', {hasText:/^Tout ce modèle \(12\)$/}).click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => ['a', 'b', 'c'].map(k => document.querySelector('[data-ch2l="' + k + '"]').value).join(',')) === '2,10,', 'bouton « Tout ce modèle » : ROSE XS 2 + S 10, le NOIR non touché');
  if (process.env.CAPTURE) await p.screenshot({path:process.env.CAPTURE});
  await p.fill('[data-ch2l="c"]', '4'); await p.dispatchEvent('[data-ch2l="c"]', 'change');
  await p.locator('button', {hasText:'✔ Passer en 2e choix'}).first().click(); await p.waitForTimeout(200);
  await p.locator('.sx-go').click(); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const R = suivi('PK209901-1', '*'); const A = sumStates(S.lines, stageTotals());
    const o = {}; R.forEach(x => o[x.id] = x); return {fr:['a', 'b', 'c'].map(k => o[k].fr).join(','), ch2:['a', 'b', 'c'].map(k => o[k].ch2).join(','), q:A.q, ch2t:A.ch2, nc:Object.values(ncTotals()).length,
      dispo:(() => { const t = stageTotals(), n = ncTotals(); return S.lines.map(l => (t[l.id].ctl || 0) - (t[l.id].emb || 0) - ((n[l.id] || {}).emb || 0)).join(','); })() }; });
  ok(r.fr === '108,225,36' && r.ch2 === '2,10,4' && r.q === 369 && r.ch2t === 16, 'retirées de la commande : quantités 110→108, 235→225, 40→36 (' + JSON.stringify(r) + ')');
  ok(r.dispo === '0,0,6', 'plus disponibles à l\'emballage (il reste 6 NOIR M non choisies)');
  const grille = await p.evaluate(() => { const g = pkExports.etatCommandeGrid(null, 'PK209901-1'); return g.rows.map(x => (x.cells || []).map(c => c && c.v !== undefined ? c.v : '').join('|')).join('\n'); });
  ok(!/\|110\|/.test(grille) && /108/.test(grille), 'état de commande : quantités commandées diminuées');
  // enregistrement : le marquage 2e choix survit à l'aller-retour (documents)
  const rt = await p.evaluate(() => { const d = desiredDocs(); const k = Object.keys(d).find(x => x.indexOf('moves-') === 0); return d[k].moves.filter(a => a[9] === 1).length; });
  ok(rt === 3, 'enregistré avec le marquage 2e choix (3 mouvements)');
  ok(await p.locator('[data-ch2x]').count() === 3, 'liste des 2e choix de la commande');
  await p.locator('[data-ch2x]').first().click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => sumStates(S.lines, stageTotals()).ch2) < 16, 'annulation : les pièces reviennent dans la commande');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
