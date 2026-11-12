#!/usr/bin/env node
// Suivi PERCKO, onglet Exports : le disponible (chiffre gris) retire les pièces déjà expédiées hors export
// (passages « Expédition » de Flux ou Pilotage) ; dépasser reste permis (données d'essai, sans base).
// Lancement (dans tests/) : npm run export-dispo
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), p = await (await b.newContext({viewport: {width: 1300, height: 900}})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof vExports === 'function');
  const r = [];
  const d = await p.evaluate(() => {
    const L = (id, sz, q) => ({id, lot:'PK202611', year:2026, client:'NEOLYS', model:'M', lib:'LYNE PRO homme gris', size:sz, qty:q, cc:0});
    S.lines.push(L('S1', 'S', 100), L('M1', 'M', 100));
    ['cp', 'gadh', 'asm', 'ret', 'conf'].forEach((st, k) => { S.moves.push({id:'a' + k, date:'2026-11-01', lineId:'S1', stage:st, qty:80, nc:0, note:''}); S.moves.push({id:'b' + k, date:'2026-11-01', lineId:'M1', stage:st, qty:50, nc:0, note:''}); });
    /* 30 pièces S déjà expédiées depuis Pilotage (sans export) */
    ['ctl', 'emb', 'exp'].forEach((st, k) => S.moves.push({id:'e' + k, date:'2026-11-05', lineId:'S1', stage:st, qty:30, nc:0, note:'Pilotage'}));
    S.lots.PK202611 = {ready:true};
    S.exports = [{id:'X1', n:1, cl:'NEOLYS', d:'2026-11-21', st:'cours', cartons:[]}];
    ui.tab = 'exp'; ui.xp = {id:'X1', carton:{nouveau:true}}; render();
    return {s:dispoRetour('PK202611', 'S1', null), m:dispoRetour('PK202611', 'M1', null)};
  });
  r.push(['disponible = retour − déjà expédié', d.s === 50 && d.m === 50]);
  const cell = (sz) => p.locator('.xp-mx input[title^="Lyne Pro Homme Gris · ' + sz + ' "]');
  r.push(['chiffre gris = disponible', await cell('S').getAttribute('placeholder') === '50' && await cell('M').getAttribute('placeholder') === '50']);
  r.push(['info : déjà emballé ou expédié', /déjà emballé ou expédié 30, disponible 50/.test(await cell('S').getAttribute('title'))]);
  await cell('S').fill('70'); await cell('M').fill('20');
  r.push(['dépassement signalé en rouge', await cell('S').getAttribute('class') === 'trop' && await cell('M').getAttribute('class') === 'plein']);
  await p.locator('button', {hasText: 'Valider et carton suivant'}).click(); await p.waitForTimeout(500);
  r.push(['dépassement permis : carton enregistré', await p.evaluate(() => S.exports[0].cartons.length === 1)]);
  r.push(['carton suivant : disponible recalculé', await cell('S').getAttribute('placeholder') === '' && await cell('M').getAttribute('placeholder') === '30']);
  // pièces mises en carton : « Emballée, prête à expédier » ; état de commande : une seule colonne « Emballés, prêts à expédier »
  const st = await p.evaluate(() => { const t = stageTotals(); return {s:t.S1, m:t.M1, col:(() => { const g = pkExports.etatCommandeGrid(null, 'PK202611'), h = g.rows[2].cells.map(x => x ? x.v : ''), i = h.indexOf('Emballés,\nprêts à expédier\nle 21/11'), rS = g.rows.find(r => r.cells[2] && r.cells[2].v === 'S'); return i > 0 && !h.some(v => /^Prêt à expédier le/.test(String(v))) && rS.cells[i].v === 70; })()}; });
  r.push(['carton enregistré : pièces « Emballée, prête à expédier »', st.s.emb === 100 && st.m.emb === 20 && !st.s.pret && !st.m.pret]);
  r.push(['état de commande : carton en cours dans « Emballés, prêts à expédier » (S : 70), titre sur 3 lignes avec la date prévue', st.col]);
  r.push(['date prévue : suit la date de l\'export', await p.evaluate(() => { const e = S.exports[0], d0 = e.d; e.d = '2026-11-25'; const ok = pkExports.etatCommandeGrid(null, 'PK202611').rows[2].cells.some(x => x && x.v === 'Emballés,\nprêts à expédier\nle 25/11'); e.d = d0; return ok; })]);
  // parcours : quantité exacte à chaque étape (une pièce comptée une seule fois)
  await p.evaluate(() => { ui.lot = 'PK202611'; ui.client = '*'; ui.tab = 'flux'; ui.fmode = 'detail'; ui.stage = 'emb'; ui.xp = null; render(); });
  const etape = async (nom) => (await p.locator('.step', {hasText: nom}).first().locator('.qt').textContent()).replace(/\s/g, '');
  r.push(['parcours : Emballée, prête à expédier 90, Expédiée 30, plus d\'étape « Prêt à expédier » à part', await etape('Emballée') === '90' && await etape('Expédiée') === '30' && await p.locator('.step', {hasText: /^\d+Prêt à expédier/}).count() === 0]);
  r.push(['parcours : Contrôle et Confection exacts', await etape('Contrôle') === '0' && await etape('En confection') === '30']);
  // pièces déjà contrôlées : le carton les prend, sans contrôle en plus ni étapes d'avant gonflées (cas Tee-shirt XL, 12/11)
  const dc = await p.evaluate(() => {
    S.lines.push({id:'XL', lot:'PK202611', year:2026, client:'NEOLYS', model:'M', lib:'Tee-shirt Sport homme noir', size:'XL', qty:190, cc:0});
    ['cp', 'gadh', 'asm', 'ret', 'conf'].forEach((st, k) => S.moves.push({id:'x' + k, date:'2026-11-02', lineId:'XL', stage:st, qty:200, nc:0, note:''}));
    S.moves.push({id:'xc', date:'2026-11-06', lineId:'XL', stage:'ctl', qty:190, nc:0, note:''});
    const e = S.exports[0], av = JSON.stringify(stageTotals().XL);
    [1, 2].forEach(n => commit(() => pkExports.enregistrerCartonExport(e, {id:'XLC' + n, n:10 + n, kg:null, com:'', it:[['XL', 90]]})));
    const t = stageTotals().XL, d3 = dispoRetour('PK202611', 'XL', null);
    /* 3e carton de 30 : 10 contrôlées restantes + 20 sans contrôle → contrôle auto de 20 seulement */
    commit(() => pkExports.enregistrerCartonExport(e, {id:'XLC3', n:13, kg:null, com:'', it:[['XL', 30]]}));
    const t3 = stageTotals().XL;
    /* modifier le carton 1 (90 → 80) : rien d'autre ne bouge */
    commit(() => pkExports.enregistrerCartonExport(e, {id:'XLC1', n:11, kg:null, com:'', it:[['XL', 80]]}));
    return {t, d3, t3, t4:stageTotals().XL, av};
  });
  r.push(['2 cartons de 90 sur 190 contrôlées : contrôle 190, emballée 180, coupe et retour inchangés', dc.t.ctl === 190 && dc.t.emb === 180 && dc.t.cp === 200 && dc.t.ret === 200 && dc.t.conf === 200]);
  r.push(['disponible ensuite : 200 − 180 = 20', dc.d3 === 20]);
  r.push(['carton au-delà du contrôle : contrôle auto du manque seulement', dc.t3.ctl === 210 && dc.t3.emb === 210 && dc.t3.conf === 210 && dc.t3.ret === 210]);
  r.push(['carton modifié : seules ses pièces changent', dc.t4.emb === 200 && dc.t4.ctl === 210]);
  // carton fantôme (mouvements d'un carton qui n'existe plus) : signalé, retiré en un bouton
  await p.evaluate(() => { S.moves.push({id:'og1', date:'2026-11-21', lineId:'XL', stage:'emb', qty:5, nc:0, note:'', ct:'XCfantome'}); ui.tab = 'exp'; ui.xp = {id:'X1'}; render(); });
  r.push(['carton fantôme signalé', /5 pièce\(s\) d'un carton qui n'existe plus/.test(await p.locator('#view').textContent())]);
  await p.click('text=Retirer ces pièces'); await p.waitForTimeout(300);
  r.push(['carton fantôme retiré', await p.evaluate(() => !S.moves.some(m => m.ct === 'XCfantome') && pkExports.mvtsOrphelins().length === 0)]);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
