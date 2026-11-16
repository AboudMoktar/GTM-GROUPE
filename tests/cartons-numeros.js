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
  // ordinateur : c'est la page qui défile ; la ligne des tailles reste collée sous le bandeau du carton
  await p.waitForTimeout(100);
  const fixe = await p.evaluate(() => { const vw = document.getElementById('view'), th = document.querySelector('.xp-fixe thead th:nth-child(3)'), bd = document.querySelector('.xp-sticky');
    const max = vw.scrollHeight - vw.clientHeight; vw.scrollTop = Math.min(700, max - 50);
    const a = th.getBoundingClientRect(), b = bd.getBoundingClientRect(), lignes = [...document.querySelectorAll('.xp-fixe tbody tr')].map(t => t.getBoundingClientRect());
    return {defile:vw.scrollTop > 300, sousBandeau:Math.abs(a.top - b.bottom) <= 3, texte:th.textContent, dessus:lignes.some(r => r.top < a.bottom - 5 && r.bottom > a.top), couvre:document.elementFromPoint(a.left + 5, a.top + 5) === th}; });
  ok(fixe.defile && fixe.sousBandeau && fixe.texte === 'S' && fixe.couvre, 'les tailles restent visibles sous le bandeau quand la page défile — ' + JSON.stringify(fixe));
  await p.evaluate(() => { document.getElementById('view').scrollTop = 0; });
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
  // 6. carton disparu (mouvements restés sans leur carton) : alerte détaillée, remise en place ou libération
  await p.evaluate(() => { const e = S.exports[0], c = e.cartons.find(x => x.n === 2); e.cartons = e.cartons.filter(x => x !== c); window.__ct = c.id; ui.xp = null; render(); });
  const al = await p.locator('.xp-disparu').innerText();
  ok(/Carton N°2 de l'export N°1/.test(al) && /Modèle Essai Gris · taille XS/.test(al) && /commande PKT/.test(al) && /7 pièce/.test(al), 'carton disparu : numéro, export, modèle, taille, commande et quantité indiqués');
  await p.click('.xp-disparu [data-disparu="recreer"]');
  ok(await p.evaluate(() => { const c = S.exports[0].cartons.find(x => x.id === window.__ct); return !!c && c.n === 2 && c.it.length === 1 && c.it[0][1] === 7 && pkExports.mvtsOrphelins().length === 0; }) && await p.locator('.xp-disparu').count() === 0, 'remettre le carton : il revient dans l\'export avec son numéro et ses pièces');
  await p.evaluate(() => { const e = S.exports[0]; e.cartons = e.cartons.filter(x => x.id !== window.__ct); ui.xp = null; render(); });
  await p.click('.xp-disparu [data-disparu="retirer"]');
  ok(await p.evaluate(() => !S.moves.some(m => m.ct === window.__ct)) && await p.locator('.xp-disparu').count() === 0, 'libérer les pièces : elles ne sont plus comptées comme emballées');
  // 7. état de commande ouvert depuis un export pas encore parti : « prévu », pas « exporté »
  const tit = await p.evaluate(() => { const e = S.exports[0], sv = pkExports.suiviCommande(e, 'PKT'); return sv.cols.map(c => sv.titreCol(c)).join(' | '); });
  ok(/Export prévu le 21\/11/.test(tit) && !/Exporté/.test(tit), 'export en cours : colonne « Export prévu le 21/11 » — ' + tit);
  ok(await p.evaluate(() => { const e = S.exports[0]; e.st = 'fini'; const sv = pkExports.suiviCommande(e, 'PKT'), t = sv.cols.map(c => sv.titreCol(c)).join(' | '); e.st = 'cours'; return /Exporté 21\/11/.test(t); }), 'export validé : colonne « Exporté 21/11 »');
  await p.evaluate(() => { ui.xp = {id:'E1'}; render(); });
  // 5. dernier carton : simple confirmation, pas de question sur les numéros
  await p.locator('.xp-carton', {hasText:'Carton N°4'}).getByText('Supprimer').click();
  ok(await p.locator('.xp-choix').count() === 0 && await ns() === '1,3', 'dernier carton : suppression directe');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur'); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
