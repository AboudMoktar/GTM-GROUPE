#!/usr/bin/env node
// Suivi des commandes (23/11/2026) : tableaux « comme la commande Excel » — modèle, référence et couleur écrits
// une seule fois par groupe de tailles (cases conservées, traits effacés), « Article XS » séparé en Article + Taille,
// aperçus de documents non touchés. Données inventées. Lancement (dans tests/) : node tableaux-fusion.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8833), b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1366, height:1600}})).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8833/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof pkFusionnerTableaux === 'function');
  await p.evaluate(() => {
    const lot = 'PK209911-1'; let n = 0, i = 0;
    const L = (model, lib, sz, q) => { const l = {id:'L' + (++n), lot, year:2099, client:'NEOLYS', model, lib, size:sz, qty:q, cc:0}; S.lines.push(l); return l; };
    const ls = []; ['XS', 'S', 'M', 'L', 'XL'].forEach((z, k) => { ls.push(L('LYNE PRO-HOMME', 'LYNE PRO homme noir', z, 100 + k)); ls.push(L('LYNE PRO-HOMME', 'LYNE PRO homme gris', z, 50 + k)); ls.push(L('PHARMA-FEMME', 'PHARMA_FEMME COL V ROSE', z, 40 + k)); });
    S.lots[lot] = {received:'2099-11-01', ready:'2099-11-02'};
    ls.forEach(l => ['cp', 'gadh', 'asm', 'ret'].forEach(st => S.moves.push({id:'M' + (++i), date:'2099-11-10', lineId:l.id, stage:st, qty:l.qty, nc:0, note:''})));
    ui.lot = lot; ui.tab = 'suivi'; render();
  });
  const attendre = () => p.waitForTimeout(250);
  await attendre();
  const pil = await p.evaluate(() => { const t = document.querySelector('.ph-t'); const lib = [...t.querySelectorAll('tbody td.g')];
    return {n:lib.length, cache:lib.filter(c => c.classList.contains('fz-cache')).length, vus:lib.filter(c => c.classList.contains('fz') && !c.classList.contains('fz-cache')).map(c => c.textContent), texte:lib.every(c => c.textContent.trim())}; });
  ok(pil.n >= 15 && pil.cache === 12 && pil.vus.length === 3 && pil.texte, 'suivi : 15 cases de référence conservées, la référence écrite une fois sur ses 5 tailles (' + JSON.stringify(pil) + ')');
  await p.evaluate(() => { ui.tab = 'cmd'; render(); }); await attendre();
  const cmd = await p.evaluate(() => { const c = [...document.querySelectorAll('table.cmdT td.lib')]; return {n:c.length, cache:c.filter(x => x.classList.contains('fz-cache')).length}; });
  ok(cmd.n === 15 && cmd.cache === 12, 'commandes : libellé écrit une fois par groupe de tailles (' + JSON.stringify(cmd) + ')');
  await p.evaluate(() => { ui.tab = 'fiche'; render(); }); await attendre();
  ok(await p.evaluate(() => document.querySelectorAll('table.xl:not(.cmdT) td.fz').length === 0 && document.querySelectorAll('table.xl:not(.cmdT)').length > 0), 'fiches (aperçu des documents) : inchangées');
  await p.evaluate(() => { ui.tab = 'flux'; ui.fmode = 'saisie'; ui.stage = 'emb'; ui.sxOpen = true; render(); }); await attendre();
  const def = await p.evaluate(() => { const t = [...document.querySelectorAll('table')].find(x => /Retour GADH/.test(x.tHead ? x.tHead.textContent : ''));
    if (!t) return null; return {th:[...t.tHead.rows[0].cells].map(c => c.textContent).join('|'), l1:[...t.tBodies[0].rows[0].cells].slice(0, 2).map(c => c.textContent).join('|'), tot:t.tBodies[0].rows[t.tBodies[0].rows.length - 1].cells[0].colSpan}; });
  ok(def && /^Article\|Taille\|/.test(def.th) && /^Lyne Pro Homme (Gris|Noir)\|XS$/.test(def.l1) && def.tot === 2, 'pièces défectueuses : « Article XS » séparé en Article + Taille, total sur les deux colonnes (' + JSON.stringify(def) + ')');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
