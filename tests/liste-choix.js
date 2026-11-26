#!/usr/bin/env node
// Listes de choix (<input list> + <datalist>) : sur téléphone, toucher le champ affiche la liste ; filtre pendant la saisie
// (sans accents) ; choix au doigt ; saisie libre gardée ; champs créés plus tard aussi. Données inventées.
// Lancement (dans tests/) : node liste-choix.js
'use strict';
const {chromium, devices} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8835), b = await chromium.launch(), r = [], err = [];
  const p = await (await b.newContext({...devices['Pixel 7'], serviceWorkers: 'block'})).newPage();
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
  await p.goto('http://localhost:8835/index.html'); await p.waitForFunction(() => !!window.GTM_LISTE_CHOIX, null, {timeout: 20000});
  await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = '<label>Client <input id="essai" list="dl-essai" placeholder="Nom du client"></label><datalist id="dl-essai"><option value="Société Élan"></option><option value="Bonnet Frères"></option><option value="Atelier Sud"></option></datalist><span id="chg"></span>';
    document.body.prepend(d); document.getElementById('essai').addEventListener('change', e => { document.getElementById('chg').textContent = e.target.value; }); });
  await p.waitForTimeout(200);
  r.push(['champ équipé (liste du navigateur retirée)', await p.evaluate(() => !document.getElementById('essai').hasAttribute('list') && document.getElementById('essai').classList.contains('lc-champ'))]);
  await p.tap('#essai'); await p.waitForTimeout(300);
  const n = await p.locator('.lc-panneau:not([hidden]) .lc-opt').count();
  r.push(['toucher le champ : les 3 choix s\'affichent', n === 3]);
  await p.fill('#essai', 'ela'); await p.waitForTimeout(200);
  r.push(['filtre sans accents (« ela » → Société Élan)', await p.locator('.lc-panneau:not([hidden]) .lc-opt').count() === 1 && /Élan/.test(await p.locator('.lc-panneau .lc-opt').first().textContent())]);
  await p.locator('.lc-panneau .lc-opt').first().tap(); await p.waitForTimeout(200);
  r.push(['choix au doigt : valeur mise et « change » envoyé', (await p.inputValue('#essai')) === 'Société Élan' && (await p.textContent('#chg')) === 'Société Élan' && await p.evaluate(() => document.querySelector('.lc-panneau').hidden)]);
  await p.tap('#essai'); await p.waitForTimeout(200);
  r.push(['valeur déjà choisie : toucher réaffiche toute la liste', await p.locator('.lc-panneau:not([hidden]) .lc-opt').count() === 3]);
  await p.fill('#essai', 'Nouveau client'); await p.waitForTimeout(200);
  r.push(['saisie libre gardée (aucun choix ne correspond)', (await p.inputValue('#essai')) === 'Nouveau client' && /saisie libre/.test(await p.textContent('.lc-panneau'))]);
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'tard'; i.setAttribute('list', 'dl-essai'); document.body.prepend(i); }); await p.waitForTimeout(200);
  r.push(['champ ajouté plus tard : équipé aussi', await p.evaluate(() => document.getElementById('tard').hasAttribute('data-lc-liste') && !document.getElementById('tard').hasAttribute('list'))]);
  r.push(['aucune erreur', err.length === 0]);
  let k = 0; r.forEach(x => { if (!x[1]) k++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); }); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(k ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
