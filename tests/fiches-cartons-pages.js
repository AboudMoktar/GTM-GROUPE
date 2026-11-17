#!/usr/bin/env node
// Fiches cartons : orientation (portrait / paysage) et 1 à 4 fiches par feuille A4, au choix.
// Chaque combinaison : nombre de feuilles attendu (PDF réel), aucune fiche coupée ni débordante,
// une fiche longue prend plusieurs cases ou une feuille. Données inventées. Lancement : npm run fiches-cartons-pages
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8788), b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1300, height:900}})).newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.removeItem('pk_etq'); } catch(e){} });
  await p.goto('http://localhost:8788/suivi-commandes.html'); await p.waitForFunction(() => typeof docCartonsHtml === 'function' && typeof etqChoixUI === 'function');
  const doc = (ori, n, client, long) => p.evaluate(([ori, n, client, long]) => {
    const colis = [];
    for (let i = 1; i <= 11; i++){
      const items = (long && i === 5) ? ['XS','S','M','L','XL','XXL','3XL'].map(sz => ({lib:'PHARMA_FEMME COL V NOIR', size:sz, q:10})).concat(['S','M','L','XL','XXL'].map(sz => ({lib:'PHARMA_HOMME COL V NOIR', size:sz, q:4})))
        : [{lib:'PHARMA_FEMME COL V NOIR', size:'XL', q:60}];
      colis.push({n:i, items, q:items.reduce((a, x) => a + x.q, 0)});
    }
    return "<style>@page{size:A4 " + ori + ";margin:8mm}" + PK_DOC_CSS + "#pk-doc-zone{display:block!important}</style><div id='pk-doc-zone'>" + docCartonsHtml(client, colis, {ori, n}, 'PK202611') + "</div>";
  }, [ori, n, client, long]);
  const mesurer = async (html) => {
    const q = await (await b.newContext()).newPage(); await q.setContent('<html><body style="margin:0">' + html + '</body></html>'); await q.waitForTimeout(150);
    const pdf = await q.pdf({preferCSSPageSize:true}); const feuilles = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const e = await q.evaluate(() => ({pages:document.querySelectorAll('.etqv-page').length, fiches:document.querySelectorAll('.etq').length,
      debord:[...document.querySelectorAll('.etqv-cell .etq')].filter(x => x.scrollHeight > x.clientHeight + 2 || x.scrollWidth > x.clientWidth + 2).length,
      ordre:[...document.querySelectorAll('.etq-num')].map(x => +x.textContent.replace(/\D/g, '')).join(',')}));
    await q.close(); return Object.assign(e, {feuilles});
  };
  for (const ori of ['portrait', 'landscape']) for (const n of [1, 2, 3, 4]) {
    const e = await mesurer(await doc(ori, n, 'NEOLYS', false)), att = Math.ceil(11 / n);
    ok(e.feuilles === att && e.pages === att && e.fiches === 11 && e.debord === 0 && e.ordre === '1,2,3,4,5,6,7,8,9,10,11',
      (ori === 'portrait' ? 'Portrait' : 'Paysage') + ', ' + n + ' par feuille : 11 fiches sur ' + e.feuilles + ' feuille(s) (attendu ' + att + '), sans débordement, dans l\'ordre');
  }
  for (const [ori, n] of [['portrait', 3], ['portrait', 4], ['landscape', 4], ['landscape', 3], ['portrait', 2]]) for (const cl of ['NEOLYS', 'ALLOGA']) {
    const e = await mesurer(await doc(ori, n, cl, true));
    ok(e.debord === 0 && e.fiches === 11 && e.feuilles === e.pages && e.feuilles <= Math.ceil(11 / n) + 2, (ori === 'portrait' ? 'Portrait' : 'Paysage') + ' ' + n + ' ' + cl + ' avec une fiche longue (12 tailles) : rien de coupé (' + e.feuilles + ' feuilles)');
  }
  // choix à l'écran, gardé sur l'appareil
  await p.evaluate(() => { const z = document.createElement('div'); z.id = 'zz'; document.body.appendChild(z); window.render = () => { z.innerHTML = ''; z.appendChild(etqChoixUI()); }; render(); });
  ok(await p.evaluate(() => JSON.stringify(etqChoix())) === '{"ori":"landscape","n":4}', 'par défaut : paysage, 4 par feuille');
  await p.click('#zz button:has-text("Portrait")'); await p.click('#zz button:has-text("3")');
  ok(await p.evaluate(() => JSON.stringify(etqChoix()) === '{"ori":"portrait","n":3}' && etqFormat() === 'A4 portrait' && /portrait/.test(localStorage.getItem('pk_etq'))), 'choix Portrait + 3 gardé (format A4 portrait)');
  ok(await p.evaluate(() => [...document.querySelectorAll('#zz button.on')].map(x => x.textContent).join('|')) === 'Portrait|3', 'boutons allumés : Portrait, 3');
  ok(await p.evaluate(() => JSON.stringify(etqNorm('4L')) + JSON.stringify(etqNorm(2))) === '{"ori":"landscape","n":4}{"ori":"portrait","n":2}', 'anciens réglages (4 paysage, 2) repris');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
