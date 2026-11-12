#!/usr/bin/env node
// Assistant GTM (chatbot) : réponses calculées sur les données, sans IA externe ni réseau ; aide si la question
// n'est pas comprise ; ancienne clé Gemini effacée de l'appareil. Données inventées (assistant-ia-page.html).
// Lancement (dans tests/) : npm run assistant-ia
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8794), b = await chromium.launch(), ctx = await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true});
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  const externes = []; p.on('request', rq => { if (!rq.url().startsWith('http://localhost')) externes.push(rq.url()); });
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('deja')){ localStorage.setItem('gtm_ia_cle_gemini', 'AIzaANCIENNE'); sessionStorage.setItem('deja', '1'); } } catch(e){} });
  await p.goto('http://localhost:8794/tests/assistant-ia-page.html'); await p.waitForFunction(() => typeof assistantOuvrir === 'function');
  const r = [];
  r.push(['ancienne clé Gemini effacée de l\'appareil', await p.evaluate(() => localStorage.getItem('gtm_ia_cle_gemini') === null)]);
  await p.evaluate(() => { document.getElementById('barre').innerHTML = assistantBouton(); });
  r.push(['bouton 🤖 dans la barre', await p.locator('.ia-btn').count() === 1]);
  await p.click('.ia-btn'); await p.waitForTimeout(100);
  r.push(['conversation ouverte directement, 7 suggestions, pas de réglages', await p.locator('#ia-msgs').count() === 1 && await p.locator('#ia-sugg button').count() === 7 && await p.locator('[aria-label="Réglages"]').count() === 0]);
  await p.locator('#ia-sugg button', {hasText: 'Où en est la commande'}).click(); await p.waitForTimeout(150);
  let m = await p.locator('.ia-m.b').last().textContent();
  r.push(['« Où en est la commande ? » : commandé, expédié, reste, livraison', /1 490 commandées/.test(m) && /1 157 expédiées/.test(m) && /reste à livrer 333/.test(m) && /30\/11\/2026/.test(m) && /Emballées, prêtes à expédier : 223/.test(m) && /Calculé à partir des données/.test(m)]);
  await p.fill('#ia-q', 'Reste à produire en tee-shirt sport homme XL ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(150);
  m = await p.locator('.ia-m.b').last().textContent();
  r.push(['article + taille : reste à produire XL = 10', /Tee-shirt Sport homme noir · taille XL : 10 pièces/.test(m)]);
  await p.fill('#ia-q', 'Résumé de l\'export en cours'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(150);
  m = await p.locator('.ia-m.b').last().textContent();
  r.push(['export en cours : cartons et pièces', /Export N°1/.test(m) && /2 carton\(s\)/.test(m) && /180 pièces/.test(m)]);
  const html = await p.locator('.ia-m.b').last().innerHTML();
  r.push(['mise en forme : gras et listes', /<b>/.test(html) && /<li>/.test(html)]);
  await p.fill('#ia-q', 'Écris-moi un poème'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(150);
  r.push(['question non reconnue : aide proposée', /Je n'ai pas compris/.test(await p.locator('.ia-m.b').last().textContent())]);
  r.push(['texte échappé (pas de HTML injecté)', await p.evaluate(() => !gtmIA.miseEnForme('<img src=x onerror=alert(1)>').includes('<img'))]);
  await p.click('[aria-label="Nouvelle conversation"]'); await p.waitForTimeout(100);
  r.push(['nouvelle conversation : messages effacés, suggestions revenues', await p.locator('.ia-m.u').count() === 0 && await p.locator('#ia-sugg button').count() === 7]);
  await p.click('[aria-label="Fermer"]'); r.push(['fermeture', await p.locator('#ia-fond').count() === 0]);
  r.push(['aucun appel hors de l\'application', externes.length === 0]);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
