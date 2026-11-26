#!/usr/bin/env node
// Tableau de bord RH modernisé (maquette du 26/11/2026) : mêmes chiffres et mêmes actions, téléphone et ordinateur. Données inventées.
// Lancement (dans tests/) : node rh-tableau.js
'use strict';
const {chromium, devices} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8837), b = await chromium.launch(), r = [], err = [];
  for (const [nom, opt] of [['ordinateur', {viewport: {width: 1440, height: 950}}], ['téléphone', devices['Pixel 7']]]) {
    const p = await (await b.newContext({...opt, serviceWorkers: 'block'})).newPage();
    p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
    await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
    await p.goto('http://localhost:8837/index.html'); await p.waitForFunction(() => typeof renderShell === 'function');
    await p.evaluate(() => { currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; activeSociete = 'tek'; activeModule = 'rh';
      const e = {}; for (let i = 0; i < 10; i++) e['e' + i] = {nom:'Salariée ' + i, poste:'SUR MACHINE', statut:'actif'}; localStorage.setItem(CACHE_PREFIX + 'employees', JSON.stringify(e));
      const a = {}; Object.keys(e).forEach((k, i) => { a[k] = i < 8 ? {status:'present', in:'07:00'} : {status:'absent'}; }); localStorage.setItem(CACHE_PREFIX + 'attendance_' + getTodayISO(), JSON.stringify(a));
      renderShell(); nav('rh-dashboard'); });
    await p.waitForTimeout(600);
    const v = await p.evaluate(() => ({k: [...document.querySelectorAll('.rh2-k .kpi-mini-val')].map(x => x.textContent), donut: (document.querySelector('.rh2-donut b') || {}).textContent,
      h1: (document.querySelector('.rh2-hero h1') || {}).textContent, actions: document.querySelectorAll('.rh2-act').length, large: document.documentElement.scrollWidth <= innerWidth + 1, suite: !!document.querySelector('.rh2-suite #rh-sorties-zone')}));
    r.push([nom + ' : titre, 4 indicateurs (10 / 8 / 0 / 2) et total du graphique', v.h1 === 'Tableau de bord RH' && v.k.join() === '10,8,0,2' && v.donut === '10']);
    r.push([nom + ' : actions rapides et sections existantes conservées', v.actions === 4 && v.suite]);
    r.push([nom + ' : pas de défilement horizontal', v.large]);
    await p.click('.rh2-k.vert'); await p.waitForTimeout(300);
    r.push([nom + ' : clic sur « Présents » ouvre la liste (8)', /Présents \(8\)/.test(await p.evaluate(() => document.body.innerText))]);
  }
  r.push(['aucune erreur', err.length === 0]);
  let k = 0; r.forEach(x => { if (!x[1]) k++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); }); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(k ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
