#!/usr/bin/env node
// Suivi PERCKO, onglet Flux : corriger facilement les quantités déjà passées à une étape (données d'essai, sans base).
// Lancement (dans tests/) : npm run flux-corrections
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8791), b = await chromium.launch(), p = await (await b.newContext({viewport: {width: 1280, height: 860}})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8791/suivi-commandes.html'); await p.waitForFunction(() => typeof vFlux === 'function' && typeof S === 'object');
  await p.evaluate(() => {
    const L = (id, sz, q) => ({id, lot:'PK202611-1', year:2026, client:'NEOLYS', model:'M', lib:'Tee-shirt Sport homme noir', size:sz, qty:q, cc:0});
    S.lines.push(L('A', 'M', 100), L('B', 'L', 100), L('C', 'XL', 50));
    const pas = {A: {cp:100, gadh:100, asm:100, ret:100, conf:100, ctl:100, emb:100, pret:90, exp:90}, B: {cp:100, gadh:100, asm:100, ret:100, conf:100, ctl:80, emb:60}};
    let n = 0; Object.keys(pas).forEach(id => Object.keys(pas[id]).forEach(st => S.moves.push({id:'M' + (n++), date:'2026-11-05', lineId:id, stage:st, qty:pas[id][st], nc:0, note:''})));
    S.lots['PK202611-1'] = {ready:'2026-11-01'};
    ui.lot = 'PK202611-1'; ui.client = '*'; ui.tab = 'flux'; ui.fmode = 'detail'; ui.stage = 'emb'; render();
  });
  const r = [], T = (id) => p.evaluate((id) => stageTotals()[id] || {}, id), N = (id) => p.evaluate((id) => ncTotals()[id] || {}, id);
  const champ = (id, c) => p.locator('input[data-corr="' + id + '|' + c + '"]');
  r.push(['bouton « Corriger les quantités passées » sur l\'étape', await p.locator('button[data-corr="1"]').count() === 1]);
  await p.click('button[data-corr="1"]'); await p.waitForTimeout(150);
  r.push(['correction : cumuls déjà passés modifiables', await champ('A', 'q').inputValue() === '100' && await champ('B', 'q').inputValue() === '60' && await champ('A', 'n').inputValue() === '0']);
  r.push(['correction : tailles sans rien d\'arrivé masquées', await champ('C', 'q').count() === 0]);
  // baisse simple + NC
  await champ('B', 'q').fill('55'); await champ('B', 'n').fill('3');
  r.push(['case changée signalée', /chg/.test(await champ('B', 'q').getAttribute('class'))]);
  await p.click('text=✔ Enregistrer les corrections >> nth=0'); await p.waitForTimeout(200);
  r.push(['confirmation : avant → après', /Emballage · Tee-shirt Sport homme noir L/.test(await p.locator('.sx-cdet').textContent()) && /60 → 55 \+ 3 NC/.test(await p.locator('.sx-cdet').textContent())]);
  await p.click('text=✔ Oui, enregistrer les corrections'); await p.waitForTimeout(250);
  r.push(['correction enregistrée (conformes et NC), notée dans le journal', (await T('B')).emb === 55 && (await N('B')).emb === 3 && await p.evaluate(() => S.moves.some(m => m.lineId === 'B' && m.note === 'Correction (Flux)' && m.qty === -5 && m.nc === 3))]);
  r.push(['retour à l\'étape après enregistrement', await p.locator('button[data-corr="1"]').count() === 1 && await p.evaluate(() => !ui.fcorr)]);
  // baisse en cascade : contrôle de M 100 → 85 (emballage 100, prêt 90, expédié 90 suivent)
  await p.evaluate(() => { ui.stage = 'ctl'; render(); }); await p.waitForTimeout(100);
  await p.click('button[data-corr="1"]'); await p.waitForTimeout(150);
  await champ('A', 'q').fill('85');
  await p.click('text=✔ Enregistrer les corrections >> nth=0'); await p.waitForTimeout(200);
  const conf = await p.locator('.sx-cdet').textContent();
  r.push(['cascade : étapes suivantes baissées et montrées', /Emballage · Tee-shirt Sport homme noir M \(suit la correction\)100 → 85/.test(conf) && /Expédiée · Tee-shirt Sport homme noir M \(suit la correction\)90 → 85/.test(conf)]);
  await p.click('text=✔ Oui, enregistrer les corrections'); await p.waitForTimeout(250);
  const a = await T('A');
  r.push(['cascade enregistrée', a.ctl === 85 && a.emb === 85 && a.pret === 85 && a.exp === 85 && a.conf === 100]);
  // hausse impossible au-delà de l'étape précédente
  await p.evaluate(() => { ui.stage = 'emb'; render(); }); await p.click('button[data-corr="1"]'); await p.waitForTimeout(150);
  await champ('B', 'q').fill('90'); await p.click('text=✔ Enregistrer les corrections >> nth=0'); await p.waitForTimeout(200);
  r.push(['hausse au-delà de l\'étape précédente refusée (message clair)', await p.locator('.sx-cdet').count() === 0 && /dépasserait « Contrôle »/.test(await p.locator('#toast').textContent()) && (await T('B')).emb === 55]);
  await p.click('text=Annuler >> nth=0'); await p.waitForTimeout(100);
  r.push(['annuler : retour sans rien changer', await p.locator('button[data-corr="1"]').count() === 1 && (await T('B')).emb === 55]);
  // étape où tout est passé : le bouton est aussi dans le message « Rien à saisir »
  await p.evaluate(() => { S.lines = S.lines.filter(l => l.id === 'A'); ui.stage = 'exp'; render(); }); await p.waitForTimeout(100);
  r.push(['« Rien à saisir » : bouton de correction proposé', await p.locator('.msg button', {hasText: 'Corriger les quantités passées'}).count() === 1]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
