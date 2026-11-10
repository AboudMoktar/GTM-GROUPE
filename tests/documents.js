#!/usr/bin/env node
// Suivi PERCKO, onglet « Documents » : tous les documents de la commande (aperçu, PDF, Excel), A4 pleine page ; vue GADH.
// Lancement (dans tests/) : npm run documents
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
async function page(b, url){
  const p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.__imp = 0; window.print = () => { window.__imp++; }; });
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
    if (await p.locator('#pk-apercu').count()) await p.click('#pk-apercu [data-ap="Fermer"]');
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
  // une seule page : commande de ~100 lignes (15 références × 7 tailles, 2 clients)
  const une = await p.evaluate(() => {
    const SZ = ['XS','S','M','L','XL','XXL','XXXL']; let n = 0;
    FM.forEach((m, i) => SZ.forEach((z, j) => ['NEOLYS','ALLOGA'].forEach(cl => { if (cl === 'ALLOGA' && i % 3) return; S.lines.push({id:'G' + (n++), lot:'PK202611', year:2026, client:cl, model:modelOf(m[0]) || 'M', lib:m[0], size:z, qty:50 + 10 * j, cc:0}); })));
    const pages = (gs) => { const d = Array.from(pdfBuild(gs)).map(c => String.fromCharCode(c)).join(''); return +(/\/Count (\d+)/.exec(d) || [])[1]; };
    const gc = commandeGrid('PK202611', 2026, '*'), ge = pkExports.etatCommandeGrid(null, 'PK202611'), gf = ficheGrid('PK202611', '*', 'c', true, 'PROGES');
    const x = new TextDecoder().decode(xlsxBuild([{name:'C', grid:commandeGrid('PK202611', 2026, '*'), first:1}]));
    const html = pkExports.grilleHtml(commandeGrid('PK202611', 2026, '*'));
    return {n:gc.rows.length, c:pages([gc]), e:pages([ge]), f:pages([gf]), fOri:gf.landscape, x:/fitToHeight="1"/.test(x), h:/grl-1p/.test(html) && /white-space:nowrap/.test(html)};
  });
  r.push(['une seule page : fiche de commande (' + une.n + ' lignes), état de commande, fiche de coupe', une.n > 100 && une.c === 1 && une.e === 1 && une.f === 1]);
  r.push(['fiche de coupe très longue : passe en portrait pour rester lisible', une.fOri === false]);
  r.push(['Excel : une page en hauteur ; aperçu : lignes resserrées', une.x && une.h]);
  // aperçu plein écran, lisible (à la largeur de l'écran), imprimable
  await p.evaluate(() => { ui.lot = 'PK202611'; render(); }); await p.waitForTimeout(200);
  await p.locator('.dc-d[data-doc="Fiche de commande"] button', {hasText: 'Aperçu'}).click(); await p.waitForTimeout(500);
  const ap = await p.evaluate(() => { const o = document.getElementById('pk-apercu'), f = o && o.querySelector('iframe'), d = f && f.contentDocument, z = d && d.getElementById('pk-doc-zone');
    const R = o ? o.getBoundingClientRect() : {}; return {plein: !!o && R.width === innerWidth && R.height === innerHeight, tab: !!z && !!z.querySelector('table.grl'), zoom: z ? parseFloat(z.style.zoom) : 0,
      larg: z ? Math.round(z.getBoundingClientRect().width) : 0, ecran: f ? f.clientWidth : 0}; });
  r.push(['aperçu : plein écran, document à la largeur de l\'écran', ap.plein && ap.tab && ap.zoom > 1 && (Math.abs(ap.larg - ap.ecran) < 40 || Math.abs(ap.larg * ap.zoom - ap.ecran) < 40)]);
  await p.click('#pk-apercu [data-ap="Agrandir"]'); await p.waitForTimeout(100);
  const z2 = await p.evaluate(() => parseFloat(document.querySelector('#pk-apercu iframe').contentDocument.getElementById('pk-doc-zone').style.zoom));
  r.push(['aperçu : zoom + / − / ajuster', Math.abs(z2 - ap.zoom * 1.2) < 0.01]);
  await p.click('#pk-apercu [data-ap="Imprimer"]'); await p.waitForTimeout(300);
  r.push(['aperçu : bouton Imprimer (une page A4)', await p.evaluate(() => window.__imp === 1 && !!document.getElementById('pk-doc-zone') && /grl-1p/.test(document.getElementById('pk-doc-zone').innerHTML))]);
  await p.click('#pk-apercu [data-ap="Fermer"]');
  r.push(['aperçu : fermé', await p.locator('#pk-apercu').count() === 0]);
  // orientation au choix (retenue sur l'appareil)
  await p.evaluate(() => { localStorage.removeItem('pk_doc_ori'); ui.lot = 'PK202612-1'; render(); }); await p.waitForTimeout(200);
  const blocCmd = p.locator('.dc-d[data-doc="Fiche de commande"]');
  r.push(['boutons Portrait / Paysage (sauf fiches cartons)', await blocCmd.locator('.dc-o button').count() === 2 && await p.locator('.dc-d[data-doc="Fiches cartons"] .dc-o').count() === 0 && await p.locator('.dc-d[data-doc="Liste de colisage"] .dc-o').count() === 1]);
  await blocCmd.locator('.dc-o button[data-ori="landscape"]').click(); await p.waitForTimeout(150);
  await p.evaluate(() => { window.__f = []; });
  await p.locator('.dc-d[data-doc="Fiche de commande"] button', {hasText: 'PDF'}).click(); await p.waitForTimeout(250);
  await p.locator('.dc-d[data-doc="Fiche de commande"] button', {hasText: 'Excel'}).click(); await p.waitForTimeout(300);
  const fo = await p.evaluate(() => window.__f.map(x => /\.pdf$/.test(x.n) ? (/MediaBox \[0 0 841\.89 595\.28\]/.test(x.d) ? 'pdf-paysage' : 'pdf-portrait') : (/orientation="landscape"/.test(x.d) ? 'xls-paysage' : 'xls-portrait')));
  r.push(['fiche de commande en paysage (PDF et Excel)', fo.join() === 'pdf-paysage,xls-paysage' && /paysage/.test(await p.locator('.dc-d[data-doc="Fiche de commande"] .dc-f').textContent())]);
  await p.locator('.dc-d[data-doc="Fiche de commande"] button', {hasText: 'Aperçu'}).click(); await p.waitForTimeout(250);
  r.push(['aperçu en paysage', await p.evaluate(() => /size:A4 landscape/.test((document.getElementById('pk-doc-zone') || {}).innerHTML || ''))]);
  await p.click('#pk-apercu [data-ap="Fermer"]');
  r.push(['choix retenu sur l\'appareil', await p.evaluate(() => JSON.parse(localStorage.getItem('pk_doc_ori'))['Fiche de commande'] === 'landscape')]);
  await p.evaluate(() => { window.__f = []; const z = document.getElementById('pk-doc-zone'); if (z) z.remove(); });
  await p.locator('.dc-d[data-doc="État des commandes"] .dc-o button[data-ori="landscape"]').click(); await p.waitForTimeout(150);
  await p.locator('.dc-d[data-doc="État des commandes"] button', {hasText: 'PDF'}).click(); await p.waitForTimeout(250);
  r.push(['export : état des commandes en paysage', await p.evaluate(() => window.__f.length === 1 && /MediaBox \[0 0 841\.89 595\.28\]/.test(window.__f[0].d))]);
  // vue GADH
  const g = await page(b, 'http://localhost:8790/suivi-commandes.html?vue=gadh');
  const tg = await g.p.$$eval('.dc-d', ds => ds.map(d => d.getAttribute('data-doc')));
  r.push(['GADH : fiche d\'assemblage, rapport, pilotage (rien d\'autre)', JSON.stringify(tg) === JSON.stringify(['Fiche d\'assemblage (GADH)', 'Rapport de commande', 'Pilotage de la commande'])]);
  r.push(['aucune erreur', err.length === 0 && g.err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length || g.err.length) console.log(err, g.err);
  res.filter(x => !x[1]).forEach(x => console.log('  détail', x));
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
