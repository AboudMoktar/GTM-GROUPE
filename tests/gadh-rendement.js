#!/usr/bin/env node
// Rendement GADH = pièces retournées (conformes + NC) ÷ (cadence GADH × heures travaillées) ; cadence 80/h par défaut, réglable.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8799), b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const err = []; p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) err.push(e.message); });
  await p.goto('http://localhost:8799/index.html'); await p.waitForFunction(() => typeof gadhDayTotals === 'function' && typeof suiviRetoursParRefDuJour === 'function', null, {timeout:20000});
  const r = await p.evaluate(() => {
    const J = '2099-03-02'; // lundi : 08h-17h, pause 12h-12h30 → 8,5 h
    window.suiviRetoursParRefDuJour = d => d === J ? {pk_a:300, pk_b:180} : {};
    const a = gadhDayTotals(J); const cad0 = gadhCadenceGlobale();
    saveGadhCadences(Object.assign(getGadhCadences(), {'*':100})); const c = gadhDayTotals(J), cad1 = gadhCadenceGlobale();
    saveGadhCadences({});
    return {cad0, cad1, h:a.heures, reel:a.totalReel, obj:a.totalObj, r:Math.round(a.rendement), r2:Math.round(c.rendement)};
  });
  ok(r.cad0 === 80, 'cadence par défaut 80 pcs/h');
  ok(r.reel === 480 && r.obj === Math.round(80 * r.h), 'objectif du jour = 80 × heures (' + JSON.stringify(r) + ')');
  ok(r.r === Math.round(480 / (80 * r.h) * 100), 'rendement = retournées ÷ objectif');
  ok(r.cad1 === 100 && r.r2 === Math.round(480 / (100 * r.h) * 100), 'cadence réglable (100 pcs/h)');
  const nc = await p.evaluate(() => { delete window.suiviRetoursParRefDuJour; return typeof suiviCleRef === 'function'; });
  ok(nc, 'module suivi chargé');
  ok(!err.length, 'aucune erreur JavaScript ' + err.join(' / '));
  await b.close(); process.exit(echecs ? 1 : 0);
})();
