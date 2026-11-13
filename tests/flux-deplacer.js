#!/usr/bin/env node
// Suivi PERCKO, onglet Flux : « Déplacer des pièces » — un seul écran pour faire passer des pièces d'un statut à un autre,
// en avant ou en arrière (étapes intermédiaires ajoutées / retirées), à une date choisie ; pièces des cartons d'export bloquées ;
// « Retour GADH » et « Confection » = une seule étape. Données inventées. Lancement (dans tests/) : npm run flux-deplacer
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8791), b = await chromium.launch(), p = await (await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8791/suivi-commandes.html'); await p.waitForFunction(() => typeof vFlux === 'function' && typeof S === 'object');
  await p.evaluate(() => {
    try { localStorage.removeItem('pk_fmode2'); } catch(e){}
    const L = (id, sz, q) => ({id, lot:'PK202611-1', year:2026, client:'NEOLYS', model:'M', lib:'Tee-shirt Sport homme noir', size:sz, qty:q, cc:0});
    S.lines.push(L('A', 'M', 100), L('B', 'L', 100), L('C', 'XL', 50), L('D', 'S', 60));
    const pas = {A: {cp:100, gadh:100, asm:100, ret:100, ctl:100, emb:100, exp:90}, B: {cp:100, gadh:100, asm:100, ret:100, ctl:80, emb:60}, C: {cp:50, gadh:50, asm:50, ret:50, ctl:50, emb:50}, D: {cp:60, gadh:20}};
    let n = 0; Object.keys(pas).forEach(id => Object.keys(pas[id]).forEach(st => S.moves.push({id:'M' + (n++), date:'2026-11-05', lineId:id, stage:st, qty:pas[id][st], nc:0, note:''})));
    S.exports = [{id:'X1', n:1, cl:'NEOLYS', d:'2026-11-21', st:'cours', cartons:[{id:'XC1', n:1, kg:null, com:'', it:[['C', 20]]}]}];
    S.moves.push({id:'MX1', date:'2026-11-21', lineId:'C', stage:'ctl', qty:20, nc:0, note:'', ct:'XC1'}, {id:'MX2', date:'2026-11-21', lineId:'C', stage:'emb', qty:20, nc:0, note:'', ct:'XC1'});
    S.lots['PK202611-1'] = {ready:'2026-11-01'};
    ui.lot = 'PK202611-1'; ui.client = '*'; ui.tab = 'flux'; ui.fmode = null; ui.dp = null; render();
  });
  const r = [], T = (id) => p.evaluate((id) => stageTotals()[id] || {}, id), champ = (id) => p.locator('input[data-dp="' + id + '"]');
  const de = (k) => p.click('button[data-de="' + k + '"]'), vers = (k) => p.click('button[data-vers="' + k + '"]');
  const deplacer = async () => { await p.click('button[data-dp-go]'); await p.waitForTimeout(150); const t = await p.locator('.sx-modal').textContent(); await p.click('button[data-dp-oui]'); await p.waitForTimeout(250); return t; };
  r.push(['Flux s\'ouvre sur « Déplacer des pièces », avec les 3 onglets', /Déplacer des pièces/.test(await p.locator('#view').textContent()) && await p.locator('.dp-onglets button').count() === 3]);
  r.push(['statuts avec leur nombre de pièces (Confection = retour GADH)', /Confection\s*20/.test((await p.locator('button[data-de="ret"]').textContent()).replace(/\s+/g, ' ')) && /GADH\s*20/.test(await p.locator('button[data-de="gadh"]').textContent())]);
  // en avant : confection → contrôlées
  await de('ret'); await vers('ctl');
  r.push(['effet annoncé : en avant, étape ajoutée', /En avant.*Étape\(s\) ajoutée\(s\) : Contrôle/.test(await p.locator('#view').textContent())]);
  await champ('B').fill('15');
  let t = await deplacer();
  r.push(['confirmation claire', /Déplacer 15 pièce/.test(t) && /En confection/.test(t) && /Contrôlées/.test(t)]);
  r.push(['B : 15 contrôlées de plus', (await T('B')).ctl === 95]);
  // en arrière : emballées → contrôlées
  await de('emb'); await vers('ctl');
  r.push(['en arrière annoncé (étape retirée : Emballée)', /En arrière.*Emballée/.test(await p.locator('#view').textContent())]);
  r.push(['carton d\'export : C 70 dont 20 en carton → 50 déplaçables', await champ('C').getAttribute('max') === '50' && /dont 20 en carton d'export/.test(await p.locator('#view').textContent())]);
  r.push(['A : 10 emballées non expédiées', await champ('A').getAttribute('max') === '10']);
  await champ('A').fill('999');
  r.push(['quantité limitée à ce qui est là', await champ('A').inputValue() === '10']);
  await champ('A').fill('4'); await deplacer();
  r.push(['A : emballage −4, contrôle inchangé', (await T('A')).emb === 96 && (await T('A')).ctl === 100 && (await T('A')).exp === 90]);
  // en arrière de plusieurs étapes : emballées → en confection (retire emballage et contrôle)
  await de('emb'); await vers('ret');
  await p.locator('tr', {has: champ('B')}).locator('text=Tout').click();
  r.push(['bouton « Tout »', await champ('B').inputValue() === '60']);
  await deplacer();
  const tb = await T('B');
  r.push(['B : 60 renvoyées en confection (emballage et contrôle retirés)', tb.emb === 0 && tb.ctl === 35 && tb.ret === 100]);
  // en avant de plusieurs étapes, à une date choisie : chez la GADH → contrôlées (assemblage + retour + contrôle)
  await de('gadh'); await vers('ctl');
  await p.fill('.dp-date', '2026-11-10'); await p.dispatchEvent('.dp-date', 'change');
  await champ('D').fill('20'); await deplacer();
  const td = await T('D');
  r.push(['D : GADH → contrôlées (assemblage, retour, contrôle ajoutés)', td.asm === 20 && td.ret === 20 && td.ctl === 20]);
  r.push(['date choisie et note « Déplacé » dans le journal', await p.evaluate(() => S.moves.filter(m => m.lineId === 'D' && m.date === '2026-11-10' && /^Déplacé : Chez la GADH → Contrôlées/.test(m.note)).length === 3)]);
  r.push(['aucune étape « conf » créée', await p.evaluate(() => !S.moves.some(m => m.stage === 'conf'))]);
  // autres onglets
  await p.click('button[data-fmode="simple"]'); await p.waitForTimeout(150);
  r.push(['onglet « Saisie par étape » : sans « Confection » séparée', await p.locator('.dp-onglets').count() === 1 && !/\bConfection\b(?!\s*,)/.test((await p.locator('#view').textContent()).replace('Retour GADH, confection', ''))]);
  await p.click('button[data-fmode="detail"]'); await p.waitForTimeout(150);
  r.push(['onglet « Détaillé » : plus de bouton « Renvoyer » séparé', await p.locator('button[data-renvoi-ouvrir]').count() === 0 && await p.locator('[data-corr]').count() >= 1]);
  r.push(['choix mémorisé', await p.evaluate(() => localStorage.getItem('pk_fmode2') === 'detail')]);
  // vue GADH : pas de « Déplacer »
  await p.evaluate(() => { VUE = 'gadh'; ui.fmode = 'deplacer'; render(); });
  r.push(['vue GADH : pas d\'écran « Déplacer »', await p.locator('.dp-card').count() === 0 && await p.locator('.dp-onglets').count() === 0]);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
