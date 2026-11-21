#!/usr/bin/env node
// Photos lourdes réduites avant l'enregistrement (1 600 px max, JPEG 80 %) ; PDF et petites images intactes.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8801), b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) err.push(e.message); });
  await p.goto('http://localhost:8801/index.html'); await p.waitForFunction(() => typeof fichierCompresserPhoto === 'function', null, {timeout:20000});
  const r = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'), im = g.createImageData(3000, 2000);
    for (let i = 0; i < im.data.length; i++) im.data[i] = (i * 2654435761 >>> 24) & 255; g.putImageData(im, 0, 0);
    const gros = c.toDataURL('image/png'), sortie = await fichierCompresserPhoto(gros);
    const dims = await new Promise(res => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.src = sortie; });
    const petit = (() => { const d = document.createElement('canvas'); d.width = 40; d.height = 40; return d.toDataURL('image/png'); })();
    const pdf = 'data:application/pdf;base64,' + 'A'.repeat(800000);
    return {avant:gros.length, apres:sortie.length, type:sortie.slice(0, 15), dims, petitIntact:(await fichierCompresserPhoto(petit)) === petit, pdfIntact:(await fichierCompresserPhoto(pdf)) === pdf};
  });
  ok(r.type === 'data:image/jpeg' && r.apres < r.avant / 3, `photo réduite (${Math.round(r.avant / 1024)} Ko → ${Math.round(r.apres / 1024)} Ko)`);
  ok(Math.max(...r.dims) === 1600, '1 600 px au plus grand côté (' + r.dims.join('×') + ')');
  ok(r.petitIntact, 'petite image gardée telle quelle');
  ok(r.pdfIntact, 'PDF gardé tel quel');
  ok(!err.length, 'aucune erreur JavaScript ' + err.join(' / '));
  await b.close(); process.exit(echecs ? 1 : 0);
})();
