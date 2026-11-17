#!/usr/bin/env node
// État de commande : renvoi sous le tableau pour les pièces contrôlées pas encore emballées
// (déjà déduites du reste). Données inventées. Lancement (dans tests/) : npm run etat-controles
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8789), b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8789/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && window.pkExports && pkExports.etatCommandeGrid);
  const res = await p.evaluate(() => {
    const L = (id, lib, sz, q) => ({id, lot:'PK209901-1', year:2099, client:'NEOLYS', model:'M', lib, size:sz, qty:q, cc:0});
    S.lines.push(L('a', 'Gilet homme noir', 'XS', 5), L('b', 'Gilet homme noir', 'S', 25), L('c', 'Gilet homme noir', 'M', 10));
    const mv = (id, lineId, stage, qty) => S.moves.push({id, date:'2099-01-10', lineId, stage, qty, nc:0, note:''});
    mv('1', 'a', 'ctl', 10); mv('2', 'b', 'ctl', 20); mv('3', 'c', 'ctl', 10); mv('4', 'c', 'emb', 10);
    const g = pkExports.etatCommandeGrid(null, 'PK209901-1');
    const txt = g.rows.map(r => (r.cells || []).map(c => c && c.v !== undefined ? c.v : '').filter(x => x !== '').join(' | '));
    const reste = g.rows.slice(3, 6).map(r => r.cells[r.cells.length - 1].v);
    return {txt, reste, pdf:pdfBuild([g]).length > 1000, xlsx:!!xlsxBuild([{name:'E', grid:g, first:1}])};
  });
  ok(JSON.stringify(res.reste) === '[0,5,0]', 'reste = total − contrôlés (XS 0, S 5, M emballé 0)');
  const i = res.txt.findIndex(t => /^Contrôlés, pas encore emballés/.test(t));
  ok(i > 0 && /30 pièces/.test(res.txt[i]), 'renvoi sous le tableau : 30 pièces contrôlées non emballées');
  ok(res.txt[i + 1] === '• Gilet Homme Noir — XS : 10 · S : 20', 'détail : Gilet Homme Noir — XS : 10 · S : 20 (le M emballé n\'y est pas)');
  ok(res.pdf && res.xlsx, 'PDF et Excel construits avec le renvoi');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
