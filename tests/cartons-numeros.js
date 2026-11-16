#!/usr/bin/env node
// Suivi PERCKO, export : numéros de cartons (trou signalé, recréé ou renuméroté), deux façons de supprimer,
// modèles en couleur et tailles toujours visibles dans la saisie d'un carton. Données d'essai, sans base.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8789), b = await chromium.launch(), p = await b.newPage({viewport:{width:1280, height:700}}); const err = []; p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8789/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof render === 'function' && typeof pkExports === 'object' && typeof pkExports.numeroLibre === 'function');
  await p.evaluate(() => {
    const tailles = ['XS', 'S', 'M', 'L', 'XL'], libs = ['Modèle essai noir', 'Modèle essai rose', 'Modèle essai sable', 'Modèle essai gris'];
    for (let k = 0; k < 24; k++) libs.push('Modèle essai gris ' + k);
    libs.forEach((lib, i) => tailles.forEach((z, j) => { const id = 'L' + i + '_' + j; S.lines.push({id, lot:'PKT', client:'NEOLYS', model:'M' + i, lib, size:z, qty:200, cc:0});
      ['cp', 'gadh', 'asm', 'ret'].forEach((st, q) => S.moves.push({id:'M' + id + q, date:'2026-11-10', lineId:id, stage:st, qty:200, nc:0, note:''})); }));
    S.exports = [{id:'E1', n:1, d:'2026-11-21', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', com:'', cartons:[]}];
    const e = S.exports[0];
    [1, 2, 3, 4, 5].forEach(n => pkExports.enregistrerCartonExport(e, {id:'C' + n, n, kg:null, com:'', it:[['L0_1', 10, 'PKT', 'Modèle essai noir', 'S']]}));
    ui.lot = 'PKT'; ui.tab = 'exp'; ui.xp = {id:'E1'}; render();
  });
  const ns = () => p.evaluate(() => S.exports[0].cartons.map(c => c.n).sort((a, b) => a - b).join(','));
  // 1. suppression : fenêtre à deux choix
  await p.locator('.xp-carton', {hasText:'Carton N°3'}).getByText('Supprimer').click();
  ok(await p.locator('.xp-choix [data-choix="renumeroter"]').count() === 1 && await p.locator('.xp-choix [data-choix="garder"]').count() === 1, 'suppression : deux choix proposés (renuméroter / garder les numéros)');
  await p.click('.xp-choix [data-choix="garder"]');
  ok(await ns() === '1,2,4,5', 'garder les numéros : le N°3 reste libre');
  ok(await p.evaluate(() => !S.moves.some(m => m.ct === 'C3')), 'les pièces du carton supprimé sont libérées');
  ok(await p.locator('.xp-manq').getAttribute('data-manq') === '3', 'fiche de l\'export : numéro manquant signalé');
  // 2. recréer le manquant
  await p.locator('.xp-manq button', {hasText:'Créer le carton N°3'}).click();
  ok(/Carton N°3 \(nouveau\)/.test(await p.locator('.xp-cnum').innerText()), 'le carton manquant s\'ouvre avec son numéro');
  // couleurs et tailles visibles pendant le défilement
  const c = await p.evaluate(() => { const g = t => getComputedStyle([...document.querySelectorAll('.xp-mx td.m')].find(x => x.textContent.toLowerCase().indexOf(t) >= 0)).backgroundColor; return {noir:g('noir'), rose:g('rose'), sable:g('sable')}; });
  ok(c.noir === 'rgb(89, 89, 89)' && c.rose === 'rgb(255, 192, 203)' && c.sable === 'rgb(222, 220, 134)', 'modèles colorés comme la commande');
  const fixe = await p.evaluate(() => { const w = document.querySelector('.xp-fixe'), th = w.querySelector('thead th:nth-child(3)'); w.scrollTop = 600; const a = th.getBoundingClientRect(), r = w.getBoundingClientRect(), der = [...w.querySelectorAll('tbody tr')].pop().getBoundingClientRect();
    return {defile:w.scrollHeight > w.clientHeight + 100, visible:a.top >= r.top - 1 && a.bottom <= r.bottom, texte:th.textContent, haut:Math.round(a.top - r.top)}; });
  ok(fixe.defile && fixe.visible && fixe.haut <= 2 && fixe.texte === 'S', 'les tailles restent visibles quand on fait défiler les modèles');
  await p.evaluate(() => { document.querySelector('.xp-fixe').scrollTop = 0; });
  await p.locator('.xp-mx input').first().fill('7');
  await p.locator('button.sx-go', {hasText:'Valider le carton N°3'}).click();
  ok(await ns() === '1,2,3,4,5' && await p.locator('.xp-manq').count() === 0, 'carton N°3 recréé : plus de trou, plus d\'alerte');
  // 3. suppression avec renumérotation
  await p.locator('.xp-carton', {hasText:'Carton N°2'}).getByText('Supprimer').click();
  await p.click('.xp-choix [data-choix="renumeroter"]');
  ok(await ns() === '1,2,3,4' && await p.locator('.xp-manq').count() === 0, 'renuméroter : les suivants reculent, aucun trou');
  ok(await p.evaluate(() => S.exports[0].cartons.every(c => S.moves.filter(m => m.ct === c.id).every(m => m.note.indexOf('carton N°' + c.n) >= 0))), 'les mouvements portent le nouveau numéro');
  // 4. trou existant (données anciennes) : « Renuméroter sans trou », et un nouveau carton prend le premier numéro libre
  await p.evaluate(() => { S.exports[0].cartons.find(c => c.n === 4).n = 6; render(); });
  ok(await p.locator('.xp-manq').getAttribute('data-manq') === '4,5', 'trou existant signalé');
  ok(await p.evaluate(() => pkExports.numeroLibre(S.exports[0])) === 4, 'le prochain carton prend le premier numéro libre');
  await p.locator('.xp-manq button', {hasText:'Renuméroter sans trou'}).click();
  ok(await ns() === '1,2,3,4', '« Renuméroter sans trou » : 1, 2, 3, 4');
  // 5. dernier carton : simple confirmation, pas de question sur les numéros
  await p.locator('.xp-carton', {hasText:'Carton N°4'}).getByText('Supprimer').click();
  ok(await p.locator('.xp-choix').count() === 0 && await ns() === '1,2,3', 'dernier carton : suppression directe');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur'); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
