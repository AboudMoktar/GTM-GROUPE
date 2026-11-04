#!/usr/bin/env node
// Affichage de cet écran : contraste renforcé automatique sous Windows 7, réglable, appliqué aux pages ouvertes en cadre.
// Lancement (dans tests/) : npm run affichage
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const W7 = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), r = [], err = [];
  const attr = (p) => p.evaluate(() => document.documentElement.getAttribute('data-affichage'));
  // Windows 7 : renforcé par défaut
  const c7 = await b.newContext({userAgent: W7, serviceWorkers: 'block'}); const p7 = await c7.newPage(); p7.on('pageerror', e => err.push(e.message));
  await p7.goto('http://localhost:8790/suivi-commandes.html'); await p7.waitForFunction(() => window.gtmAffichage);
  r.push(['Windows 7 : contraste renforcé automatique', await attr(p7) === 'renforce']);
  r.push(['textes secondaires plus foncés', await p7.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mut').trim().toLowerCase() === '#334155')]);
  await p7.evaluate(() => window.gtmAffichage.regler('normal'));
  r.push(['réglage « normal » respecté', await attr(p7) === null]);
  await c7.close();
  // Autre appareil : normal par défaut ; le réglage s'applique aussi à une page ouverte en cadre
  const c = await b.newContext({serviceWorkers: 'block'}); const p = await c.newPage(); p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => window.gtmAffichage);
  r.push(['autre appareil : normal par défaut', await attr(p) === null]);
  await p.evaluate(() => { const f = document.createElement('iframe'); f.src = 'suivi-commandes.html'; f.id = 'cadre'; document.body.appendChild(f); });
  const fr = await (await p.waitForSelector('#cadre')).contentFrame(); await fr.waitForFunction(() => window.gtmAffichage);
  await p.evaluate(() => window.gtmAffichage.regler('renforce')); await p.waitForTimeout(300);
  r.push(['renforcé : page et cadre', await attr(p) === 'renforce' && await fr.evaluate(() => document.documentElement.getAttribute('data-affichage')) === 'renforce']);
  await p.reload(); await p.waitForFunction(() => window.gtmAffichage);
  r.push(['réglage gardé sur l\'appareil', await attr(p) === 'renforce']);
  await c.close();
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
