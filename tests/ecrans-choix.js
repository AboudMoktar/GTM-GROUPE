#!/usr/bin/env node
// Écrans de choix (société, module) : carte étroite et compacte, boutons Vue direction / Administration présents,
// tout tient sans défilement sur un écran 1024 × 768. Lancement (dans tests/) : npm run ecrans-choix
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8801), b = await chromium.launch(), p = await (await b.newContext({viewport: {width: 1024, height: 768}, serviceWorkers: 'block'})).newPage();
  await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
  await p.goto('http://localhost:8801/index.html'); await p.waitForFunction(() => typeof renderModuleSelect === 'function' && typeof renderSocieteSelect === 'function', null, {timeout: 20000});
  const r = [];
  await p.evaluate(() => { currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; renderSocieteSelect(); });
  await p.waitForTimeout(300);
  const m = () => p.evaluate(() => { const c = document.querySelector('.login-card.choix'), rc = c.getBoundingClientRect(); return {w: Math.round(rc.width), bas: Math.round(rc.bottom), n: c.querySelectorAll('.soc-card').length, forts: [...c.querySelectorAll('.choix-fort')].map(x => x.textContent.trim().slice(0, 14)), sous: getComputedStyle(c.querySelector('.soc-sous')).fontSize}; });
  let d = await m();
  r.push(['société : carte compacte (≤ 560 px), 3 sociétés', d.w <= 560 && d.n === 3]);
  r.push(['société : « Vue direction » et « Administration » présents', d.forts.length === 2 && /Vue direction/.test(d.forts[0]) && /Administration/.test(d.forts[1])]);
  r.push(['société : tient sur un écran 1024 × 768', d.bas <= 768]);
  await p.evaluate(() => { activeSociete = 'gadh'; renderModuleSelect(); }); await p.waitForTimeout(300); d = await m();
  r.push(['modules GADH : carte étroite, 6 modules, texte secondaire ≥ 13 px', d.w <= 560 && d.n === 6 && parseFloat(d.sous) >= 13]);
  r.push(['modules GADH : tient sur un écran 1024 × 768', d.bas <= 768]);
  r.push(['boutons « Changer de société » et « Déconnexion »', await p.locator('.choix-bas .btn').count() === 2]);
  await p.click('.soc-card >> nth=0'); await p.waitForTimeout(300);
  r.push(['un clic ouvre le module', await p.locator('.login-card.choix').count() === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
