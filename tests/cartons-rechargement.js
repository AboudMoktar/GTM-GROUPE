#!/usr/bin/env node
// Suivi PERCKO dans l'application (cadre) : une mise à jour reçue du serveur pendant qu'un carton est ouvert
// ne doit pas faire disparaître ce carton à l'enregistrement (pièces comptées, carton absent de l'export).
// Reproduit l'anomalie des 16/11/2026 (carton N°45 disparu, N°33 manquant). Données d'essai, sans base.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8788), b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:1366, height:768}, serviceWorkers:'block'}); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8788/index.html'); await p.waitForFunction(() => typeof renderShell === 'function');
  await p.evaluate(() => { hlEcritureAutorisee = () => true;
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}};
    activeSociete = 'tek'; activeModule = 'commandes'; renderShell(); nav('commandes-home'); });
  await p.waitForTimeout(1200);
  const fr = p.frames().find(f => /suivi-commandes/.test(f.url()));
  await fr.waitForFunction(() => typeof S === 'object' && typeof render === 'function' && typeof pkExports === 'object');
  await fr.evaluate(() => {
    ['XS', 'S', 'M'].forEach((z, j) => { const id = 'L0_' + j; S.lines.push({id, lot:'PKT', client:'NEOLYS', model:'M0', lib:'Modèle essai noir', size:z, qty:200, cc:0});
      ['cp', 'gadh', 'asm', 'ret'].forEach((st, q) => S.moves.push({id:'M' + id + q, date:'2026-11-10', lineId:id, stage:st, qty:200, nc:0, note:''})); });
    S.exports = [{id:'E1', n:1, d:'2026-11-21', cl:'NEOLYS', nat:'NEOLYS', dest:null, st:'cours', dv:'', com:'', cartons:[]}];
    pkExports.enregistrerCartonExport(S.exports[0], {id:'C1', n:1, kg:null, com:'', it:[['L0_1', 10, 'PKT', 'Modèle essai noir', 'S']]});
    persist(); });
  await p.waitForTimeout(900);
  // un nouveau carton est ouvert…
  await fr.evaluate(() => { ui.lot = 'PKT'; ui.tab = 'exp'; ui.xp = {id:'E1', carton:{nouveau:true}}; render(); });
  await fr.waitForSelector('.xp-mx input');
  // … et une mise à jour arrive du serveur (ici l'écho de notre propre enregistrement : rien n'a changé)
  const ident = await fr.evaluate(() => { const e = S.exports[0], n = document.querySelector('.xp-mx input'); document.activeElement && document.activeElement.blur(); DERNIER_DEFIL = 0; window.suiviRecharger(); return {memeObjet:e === S.exports[0], memeEcran:n === document.querySelector('.xp-mx input')}; });
  ok(ident.memeObjet && ident.memeEcran, 'mise à jour sans nouveauté : rien n\'est remplacé en mémoire ni à l\'écran — ' + JSON.stringify(ident));
  await fr.locator('.xp-mx input').first().fill('7');
  await fr.locator('button.sx-go', {hasText:'Valider le carton N°2'}).click();
  await p.waitForTimeout(900);
  const r = await fr.evaluate(() => ({cartons:S.exports[0].cartons.map(c => c.n).join(','), orphelins:pkExports.mvtsOrphelins().length, emb:S.moves.filter(m => m.stage === 'emb').reduce((a, m) => a + m.qty, 0)}));
  ok(r.cartons === '1,2' && r.orphelins === 0 && r.emb === 17, 'carton validé après une mise à jour reçue : présent dans l\'export, aucune pièce orpheline — ' + JSON.stringify(r));
  const hote = await p.evaluate(() => { const d = getJSON('suivi_d_exports', null); return d && d.liste ? d.liste[0].cartons.length : -1; });
  ok(hote === 2, 'l\'export enregistré contient bien les 2 cartons');
  // une vraie modification venue d'ailleurs pendant qu'un carton est ouvert : le carton validé ensuite n'est pas perdu
  await fr.evaluate(() => { ui.xp = {id:'E1', carton:{nouveau:true}}; render(); });
  await fr.waitForSelector('.xp-mx input');
  await p.evaluate(() => { const d = JSON.parse(JSON.stringify(getJSON('suivi_d_exports'))); d.liste[0].com = 'modifié ailleurs'; memoryCache['grp1_suivi_d_exports'] = d; });
  await fr.evaluate(() => { document.activeElement && document.activeElement.blur(); DERNIER_DEFIL = 0; window.suiviRecharger(); });
  await fr.waitForSelector('.xp-mx input');
  await fr.locator('.xp-mx input').first().fill('5');
  await fr.locator('button.sx-go', {hasText:'Valider le carton N°3'}).click();
  await p.waitForTimeout(900);
  const r2 = await fr.evaluate(() => ({cartons:S.exports[0].cartons.map(c => c.n).join(','), orphelins:pkExports.mvtsOrphelins().length, com:S.exports[0].com}));
  ok(r2.cartons === '1,2,3' && r2.orphelins === 0 && r2.com === 'modifié ailleurs', 'modification reçue d\'un autre appareil : conservée, et le carton validé ensuite est bien enregistré — ' + JSON.stringify(r2));
  // garde-fou : même si l'export est remplacé en mémoire sans que l'écran soit redessiné, le carton va dans le bon export
  await fr.evaluate(() => { ui.xp = {id:'E1', carton:{nouveau:true}}; render(); });
  await fr.waitForSelector('.xp-mx input');
  await fr.evaluate(() => { S.exports = S.exports.map(e => Object.assign({}, e, {cartons:e.cartons.slice()})); });
  await fr.locator('.xp-mx input').first().fill('3');
  await fr.locator('button.sx-go', {hasText:'Valider le carton N°4'}).click();
  await p.waitForTimeout(900);
  const r3 = await fr.evaluate(() => ({cartons:S.exports[0].cartons.map(c => c.n).join(','), orphelins:pkExports.mvtsOrphelins().length}));
  ok(r3.cartons === '1,2,3,4' && r3.orphelins === 0, 'export remplacé en mémoire pendant la saisie : le carton est quand même enregistré — ' + JSON.stringify(r3));
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur'); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
