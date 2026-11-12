#!/usr/bin/env node
// Assistant IA (chatbot Gemini) : clé gardée sur l'appareil, résumé des commandes envoyé, réponse affichée,
// erreurs claires (clé refusée, limite gratuite). Gemini est simulé (aucun appel réel, aucune clé).
// Lancement (dans tests/) : npm run assistant-ia
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8794), b = await chromium.launch(), ctx = await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true});
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  const appels = []; let mode = 'ok';
  await p.route('https://generativelanguage.googleapis.com/**', async rt => {
    const req = rt.request(); appels.push({url: req.url(), cle: req.headers()['x-goog-api-key'], corps: JSON.parse(req.postData())});
    if (mode === '503' && /gemini-3\.8-flash:/.test(req.url())) return rt.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: {message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'}})});
    if (mode === '503tous') return rt.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: {message: 'This model is currently experiencing high demand.'}})});
    if (mode === '429') return rt.fulfill({status: 429, contentType: 'application/json', body: JSON.stringify({error: {message: 'quota'}})});
    if (mode === 'cle') return rt.fulfill({status: 400, contentType: 'application/json', body: JSON.stringify({error: {message: 'API key not valid. Please pass a valid API key.'}})});
    return rt.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({candidates: [{content: {parts: [{text: 'Il reste **30** pièces XL.\n\n| Taille | Reste |\n|---|---|\n| XL | 30 |\n\n- point 1\n- point 2'}]}}]})});
  });
  await p.goto('http://localhost:8794/tests/assistant-ia-page.html'); await p.waitForFunction(() => typeof assistantOuvrir === 'function');
  const r = [];
  await p.evaluate(() => { document.getElementById('barre').innerHTML = assistantBouton(); });
  r.push(['bouton 🤖 dans la barre', await p.locator('.ia-btn').count() === 1]);
  await p.click('.ia-btn'); await p.waitForTimeout(100);
  r.push(['sans clé : réglages ouverts, lien AI Studio, avertissement Google', await p.locator('#ia-cle').count() === 1 && /aistudio\.google\.com\/apikey/.test(await p.innerHTML('#ia-regl')) && /améliorer ses modèles/.test(await p.textContent('#ia-regl'))]);
  await p.fill('#ia-cle', 'AIzaTEST'); await p.click('#ia-ok'); await p.waitForTimeout(100);
  r.push(['clé gardée sur l\'appareil seulement (localStorage), pas dans les données', await p.evaluate(() => localStorage.getItem('gtm_ia_cle_gemini') === 'AIzaTEST' && !window.__setJSON.length)]);
  r.push(['suggestions proposées', await p.locator('#ia-sugg button').count() === 4]);
  await p.fill('#ia-q', 'Combien reste-t-il en XL ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(400);
  const a = appels[0] || {corps: {}}, sys = ((a.corps.systemInstruction || {}).parts || [{}])[0].text || '';
  r.push(['appel Gemini : modèle, clé en en-tête (pas dans l\'adresse)', /models\/gemini-3\.8-flash:generateContent$/.test(a.url) && a.cle === 'AIzaTEST' && !/AIzaTEST/.test(a.url)]);
  r.push(['résumé envoyé : ligne XL avec les bons chiffres', /Tee-shirt Sport homme noir;XL;190;210;210;210;210;210;190;180;0;0;0;0;0;20;10;180;190/.test(sys)]);
  r.push(['résumé envoyé : export en cours et expéditions hors export', /Export N°1 · NEOLYS · date 21\/11\/2026 · EN COURS/.test(sys) && /PK202611-1 · Tee-shirt Sport homme noir · XL : 180/.test(sys) && /07\/11\/2026 : 1157 pièces/.test(sys)]);
  r.push(['question envoyée', JSON.stringify(a.corps.contents).includes('Combien reste-t-il en XL ?')]);
  const rep = await p.innerHTML('#ia-msgs');
  r.push(['réponse affichée : gras, tableau, liste', /<b>30<\/b>/.test(rep) && /<table class="ia-tab">/.test(rep) && /<li>point 1<\/li>/.test(rep)]);
  await p.fill('#ia-q', 'Et en L ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(400);
  r.push(['conversation suivie (question précédente renvoyée)', appels.length === 2 && appels[1].corps.contents.length === 3 && appels[1].corps.contents[1].role === 'model']);
  // Gemini saturé (503) : nouvel essai, puis autre modèle automatiquement
  mode = '503'; const n0 = appels.length; await p.fill('#ia-q', 'Saturé ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(3500);
  const essais = appels.slice(n0).map(x => (x.url.match(/models\/([^:]+)/) || [])[1]);
  r.push(['modèle saturé : réessai puis Flash-Lite, réponse affichée', essais.join(',') === 'gemini-3.8-flash,gemini-3.8-flash,gemini-3.5-flash-lite' && /<b>30<\/b>/.test((await p.locator('.ia-m.b').last().innerHTML()))]);
  mode = '503tous'; await p.fill('#ia-q', 'Tous saturés ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(8000);
  r.push(['tous saturés : message clair en français', /Gemini est surchargé en ce moment/.test(await p.textContent('#ia-msgs')) && !/high demand/.test(await p.textContent('#ia-msgs'))]);
  mode = '429'; await p.fill('#ia-q', 'Encore ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(400);
  r.push(['limite gratuite : message clair', /Limite gratuite de Gemini atteinte/.test(await p.textContent('#ia-msgs'))]);
  mode = 'cle'; await p.fill('#ia-q', 'Test ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(400);
  r.push(['clé refusée : message clair', /Clé Gemini refusée/.test(await p.textContent('#ia-msgs'))]);
  r.push(['texte de Gemini échappé (pas de HTML injecté)', await p.evaluate(() => !gtmIA.miseEnForme('<img src=x onerror=alert(1)>').includes('<img'))]);
  await p.click('text=✕'); r.push(['fermeture', await p.locator('#ia-fond').count() === 0]);
  // mémoire du site pleine (copie locale des données) : la clé est quand même gardée, et retrouvée après réouverture
  await p.evaluate(() => { localStorage.clear(); let t = 1000000, i = 0; while (t >= 16 && i < 2000){ try { localStorage.setItem('plein' + (i++), 'x'.repeat(t)); } catch(e){ t = Math.floor(t / 2); } } let plein = false; try { localStorage.setItem('gtm_essai', 'AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'); } catch(e){ plein = true; } window.__plein = plein; });
  r.push(['essai : mémoire du site pleine', await p.evaluate(() => window.__plein)]);
  await p.evaluate(() => { document.getElementById('barre').innerHTML = assistantBouton(); }); await p.click('.ia-btn'); await p.waitForTimeout(300);
  r.push(['clé effacée de la mémoire pleine : réglages demandés', await p.locator('#ia-cle').count() === 1 || await p.locator('#ia-msgs').count() === 1]);
  if (await p.locator('#ia-cle').count() === 0) await p.click('[aria-label="Réglages"]');
  await p.fill('#ia-cle', 'AIzaGARDEE'); await p.click('#ia-ok'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForFunction(() => typeof assistantOuvrir === 'function');
  await p.evaluate(() => { document.getElementById('barre').innerHTML = assistantBouton(); }); await p.click('.ia-btn'); await p.waitForTimeout(400);
  r.push(['après réouverture : clé retrouvée, pas besoin de la ressaisir', await p.locator('#ia-msgs').count() === 1 && await p.locator('#ia-cle').count() === 0]);
  mode = 'ok'; await p.fill('#ia-q', 'Bonjour ?'); await p.press('#ia-q', 'Enter'); await p.waitForTimeout(400);
  r.push(['question envoyée avec la clé gardée', appels[appels.length - 1].cle === 'AIzaGARDEE']);
  await p.evaluate(() => localStorage.clear());
  r.push(['aucune erreur JavaScript', err.length === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
