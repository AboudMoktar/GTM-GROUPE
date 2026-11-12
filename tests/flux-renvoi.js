#!/usr/bin/env node
// Suivi PERCKO, onglet Flux : renvoyer des pièces à une étape précédente (ex. emballées → à recontrôler,
// ou → retour en confection), hors cartons d'export ; rien n'est effacé (mouvements « Renvoi » dans le journal).
// Lancement (dans tests/) : npm run flux-renvoi
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8791), b = await chromium.launch(), p = await (await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8791/suivi-commandes.html'); await p.waitForFunction(() => typeof vFlux === 'function' && typeof S === 'object');
  await p.evaluate(() => {
    const L = (id, sz, q) => ({id, lot:'PK202611-1', year:2026, client:'NEOLYS', model:'M', lib:'Tee-shirt Sport homme noir', size:sz, qty:q, cc:0});
    S.lines.push(L('A', 'M', 100), L('B', 'L', 100), L('C', 'XL', 50));
    const pas = {A: {cp:100, gadh:100, asm:100, ret:100, conf:100, ctl:100, emb:100, exp:90}, B: {cp:100, gadh:100, asm:100, ret:100, conf:100, ctl:80, emb:60}, C: {cp:50, gadh:50, asm:50, ret:50, conf:50, ctl:50, emb:50}};
    let n = 0; Object.keys(pas).forEach(id => Object.keys(pas[id]).forEach(st => S.moves.push({id:'M' + (n++), date:'2026-11-05', lineId:id, stage:st, qty:pas[id][st], nc:0, note:''})));
    /* 20 pièces C dans un carton d'export en cours : on ne peut pas les renvoyer */
    S.exports = [{id:'X1', n:1, cl:'NEOLYS', d:'2026-11-21', st:'cours', cartons:[{id:'XC1', n:1, kg:null, com:'', it:[['C', 20]]}]}];
    S.moves.push({id:'MX1', date:'2026-11-21', lineId:'C', stage:'ctl', qty:20, nc:0, note:'', ct:'XC1'}, {id:'MX2', date:'2026-11-21', lineId:'C', stage:'emb', qty:20, nc:0, note:'', ct:'XC1'});
    S.lots['PK202611-1'] = {ready:'2026-11-01'};
    ui.lot = 'PK202611-1'; ui.client = '*'; ui.tab = 'flux'; ui.fmode = 'detail'; ui.stage = 'emb'; render();
  });
  const r = [], T = (id) => p.evaluate((id) => stageTotals()[id] || {}, id);
  const champ = (id) => p.locator('input[data-renvoi="' + id + '"]');
  r.push(['bouton « Renvoyer à une étape précédente »', await p.locator('button[data-renvoi-ouvrir]').count() === 1]);
  await p.click('button[data-renvoi-ouvrir]'); await p.waitForTimeout(150);
  r.push(['par défaut : à refaire « Contrôle »', /✓ Contrôle/.test(await p.locator('.sx-chip.on').textContent())]);
  r.push(['pièces à l\'étape : A 10 (100 − 90 prêtes), B 60', await champ('A').getAttribute('max') === '10' && await champ('B').getAttribute('max') === '60']);
  r.push(['carton d\'export : C 70 dont 20 en carton → 50 renvoyables', await champ('C').getAttribute('max') === '50' && /dont 20 en carton d'export/.test(await p.locator('#view').textContent())]);
  await champ('B').fill('999');
  r.push(['quantité limitée à ce qui est à l\'étape', await champ('B').inputValue() === '60']);
  await champ('B').fill('15'); await champ('A').fill('4');
  await p.getByRole('button', {name: '↩ Renvoyer', exact: true}).first().click(); await p.waitForTimeout(200);
  r.push(['confirmation claire', /Renvoyer 19 pièce/.test(await p.locator('.sx-box').textContent()) && /repasser par « Contrôle »/.test(await p.locator('.sx-box').textContent())]);
  await p.click('text=✔ Oui, renvoyer'); await p.waitForTimeout(250);
  const a = await T('A'), bb = await T('B');
  r.push(['renvoi au contrôle : contrôle et emballage baissés', bb.ctl === 65 && bb.emb === 45 && a.ctl === 96 && a.emb === 96 && a.exp === 90 && bb.conf === 100]);
  r.push(['noté dans le journal', await p.evaluate(() => S.moves.filter(m => /^Renvoi : Emballée, prête à expédier → à refaire « Contrôle »/.test(m.note)).length === 4)]);
  // renvoi en confection (chaîne)
  await p.click('button[data-renvoi-ouvrir]'); await p.waitForTimeout(150);
  await p.locator('.sx-chip', {hasText: 'En confection'}).click(); await p.waitForTimeout(150);
  r.push(['effet annoncé : étapes retirées', /En confection », « Contrôle », « Emballée, prête à expédier/.test(await p.locator('#view').textContent())]);
  await p.locator('tr', {has: champ('B')}).locator('text=Tout').click();
  r.push(['bouton « Tout »', await champ('B').inputValue() === '45']);
  await p.getByRole('button', {name: '↩ Renvoyer', exact: true}).first().click(); await p.waitForTimeout(200); await p.click('text=✔ Oui, renvoyer'); await p.waitForTimeout(250);
  const b2 = await T('B');
  r.push(['renvoi en confection : confection, contrôle, emballage baissés', b2.conf === 55 && b2.ctl === 20 && b2.emb === 0 && b2.ret === 100]);
  r.push(['les pièces sont de nouveau disponibles à l\'étape choisie', await p.evaluate(() => { ui.stage = 'conf'; ui.fren = null; render(); return true; }) && /45/.test(await p.locator('table.flux').first().textContent())]);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
