#!/usr/bin/env node
// Suivi PERCKO, onglet « Documents » : tous les documents de la commande (aperçu, PDF, Excel), A4 pleine page ; vue GADH.
// Lancement (dans tests/) : npm run documents
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
async function page(b, url){
  const p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.print = () => {}; });
  await p.goto(url); await p.waitForFunction(() => typeof vDocuments === 'function' && typeof S === 'object');
  await p.evaluate(() => {
    const L = (id, cl, lib, sz, q) => ({id, lot:'PK202612-1', year:2026, client:cl, model:modelOf(lib) || 'M', lib, size:sz, qty:q, cc:0});
    S.lines.push(L('A', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'M', 120), L('B', 'ALLOGA', 'PHARMA_HOMME COL V NOIR', 'M', 60), L('C', 'NEOLYS', 'Tee-shirt Sport homme noir', 'L', 40));
    [['A', 'cp', 125], ['A', 'gadh', 125], ['A', 'asm', 125], ['A', 'ret', 120], ['A', 'conf', 120]].forEach((x, i) => S.moves.push({id:'M' + i, date:'2026-12-02', lineId:x[0], stage:x[1], qty:x[2], nc:0, note:''}));
    S.lots['PK202612-1'] = {ready:'2026-12-01'};
    S.exports = [{id:'X1', n:1, d:'2026-12-05', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', com:'', cartons:[{id:'C1', n:1, kg:null, com:'', it:[['A', 20, 'PK202612-1', 'PHARMA_HOMME COL V NOIR', 'M']]}]}];
    ui.lot = 'PK202612-1'; ui.client = '*'; ui.tab = 'doc'; render();
    window.__f = []; window.saveFile = (n, d) => { window.__f.push({n, d: Array.from(d).map(c => String.fromCharCode(c)).join('')}); };
  });
  await p.waitForTimeout(200);
  return {p, err};
}
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), r = [];
  const {p, err} = await page(b, 'http://localhost:8790/suivi-commandes.html');
  r.push(['onglet Documents', await p.locator('#tabs button', {hasText: 'Documents'}).count() === 1 && /Documents — commande PK202612-1/.test(await p.locator('#view').textContent())]);
  const titres = await p.$$eval('.dc-d', ds => ds.map(d => d.getAttribute('data-doc')));
  r.push(['tous les documents de la commande', ['Fiche de commande', 'État de commande', 'Fiche de coupe (PROGES)', 'Fiche d\'assemblage (GADH)', 'Consommation de toute la commande', 'Rapport de commande', 'Pilotage de la commande', 'Fiches cartons', 'Liste de colisage', 'Liste total', 'État des commandes', 'État de stock PERCKO', 'Fiche de stock TEK-TREND'].every(t => titres.includes(t))]);
  r.push(['export de la commande regroupé', /Export N°1 du 05\/12\/2026/.test(await p.locator('#view').textContent())]);
  const res = [];
  for (let i = 0; i < titres.length; i++) {
    const row = p.locator('.dc-d').nth(i), t = titres[i];
    await p.evaluate(() => { const z = document.getElementById('pk-doc-zone'); if (z) z.remove(); document.getElementById('toast').textContent = ''; window.__f = []; });
    await row.locator('button', {hasText: 'Aperçu'}).click(); await p.waitForTimeout(250);
    const ap = await p.evaluate(() => { const z = document.getElementById('pk-doc-zone'); return z ? z.innerHTML.length : 0; });
    const toastAp = await p.locator('#toast').textContent();
    await row.locator('button', {hasText: 'PDF'}).click(); await p.waitForTimeout(250);
    await row.locator('button', {hasText: 'Excel'}).click(); await p.waitForTimeout(400);
    const f = await p.evaluate(() => window.__f.map(x => ({n: x.n, pdf: x.d.startsWith('%PDF'), xl: x.d.startsWith('PK'), land: /MediaBox \[0 0 841\.89 595\.28\]/.test(x.d), port: /MediaBox \[0 0 595\.28 841\.89\]/.test(x.d)})));
    const toast = await p.locator('#toast').textContent();
    const stock = /stock/i.test(t);
    const ok = (ap > 200 || (stock && /Aucun article/.test(toastAp))) && ((f.some(x => /\.pdf$/.test(x.n) && x.pdf) && f.some(x => /\.xlsx$/.test(x.n) && x.xl)) || (stock && /Aucun article/.test(toast)));
    res.push([t, ok, f.map(x => x.n + (x.land ? ' paysage' : x.port ? ' portrait' : '')).join(', ')]);
  }
  res.forEach(([t, ok, f]) => r.push(['« ' + t + ' » : aperçu, PDF, Excel', ok]));
  const pdfs = await p.evaluate(() => { window.__f = []; return null; });
  await p.locator('.dc-d[data-doc="Fiche de commande"] button', {hasText: 'PDF'}).click(); await p.waitForTimeout(200);
  await p.locator('.dc-d[data-doc="Rapport de commande"] button', {hasText: 'PDF'}).click(); await p.waitForTimeout(200);
  const o = await p.evaluate(() => window.__f.map(x => /MediaBox \[0 0 595\.28 841\.89\]/.test(x.d) ? 'portrait' : /MediaBox \[0 0 841\.89 595\.28\]/.test(x.d) ? 'paysage' : '?'));
  r.push(['A4 portrait ou paysage selon le document', o[0] === 'portrait' && o[1] === 'paysage']);
  r.push(['pleine page : le tableau prend toute la largeur', await p.evaluate(() => { const g = commandeGrid('PK202612-1', 2026, 'NEOLYS'); return !!g.plein; })]);
  // vue GADH
  const g = await page(b, 'http://localhost:8790/suivi-commandes.html?vue=gadh');
  const tg = await g.p.$$eval('.dc-d', ds => ds.map(d => d.getAttribute('data-doc')));
  r.push(['GADH : fiche d\'assemblage, rapport, pilotage (rien d\'autre)', JSON.stringify(tg) === JSON.stringify(['Fiche d\'assemblage (GADH)', 'Rapport de commande', 'Pilotage de la commande'])]);
  r.push(['aucune erreur', err.length === 0 && g.err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length || g.err.length) console.log(err, g.err);
  res.filter(x => !x[1]).forEach(x => console.log('  détail', x));
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
