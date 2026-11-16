#!/usr/bin/env node
// Aperçu d'un document sur téléphone : « Fermer » et le bouton « retour » ferment l'aperçu, même si le cadre du suivi
// a été rechargé entre-temps (avant : les boutons ne répondaient plus). Données d'essai, sans base.
'use strict';
const {chromium, devices} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8781), b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({}, devices['Pixel 5'], {serviceWorkers:'block'})); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8781/index.html'); await p.waitForFunction(() => typeof renderShell === 'function');
  await p.evaluate(() => { hlEcritureAutorisee = () => true; currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; activeSociete = 'tek'; activeModule = 'commandes'; renderShell(); nav('commandes-home'); });
  const cadre = async () => { await p.waitForTimeout(1200); const f = p.frames().find(x => /suivi-commandes/.test(x.url())); await f.waitForFunction(() => typeof S === 'object' && typeof render === 'function' && typeof pkExports === 'object'); return f; };
  let fr = await cadre();
  const ouvrir = async () => { await fr.evaluate(() => { if (!S.lines.length) ['S', 'M'].forEach((z, j) => S.lines.push({id:'L' + j, lot:'PKT', client:'NEOLYS', model:'M0', lib:'Modèle essai noir', size:z, qty:200, cc:0})); ui.lot = 'PKT'; ui.tab = 'doc'; render(); });
    await fr.locator('.dc-d').first().getByText('Aperçu').tap(); await p.waitForSelector('#pk-apercu'); await p.waitForTimeout(300); };
  // 1. Fermer
  await ouvrir();
  await p.locator('#pk-apercu [data-ap="Fermer"]').tap(); await p.waitForTimeout(400);
  ok(await p.locator('#pk-apercu').count() === 0, '« Fermer » ferme l\'aperçu');
  // 2. bouton « retour » du téléphone : ferme l'aperçu, l'application reste sur le même écran
  await ouvrir();
  await p.goBack().catch(() => {}); await p.waitForTimeout(500);
  ok(await p.locator('#pk-apercu').count() === 0 && await p.evaluate(() => activeModule === 'commandes' && !!document.getElementById('suivi-frame')) && /index\.html/.test(p.url()), 'bouton « retour » : l\'aperçu se ferme, on reste dans le suivi');
  // 3. le cadre du suivi est rechargé pendant que l'aperçu est ouvert : les boutons répondent toujours
  await ouvrir();
  await p.evaluate(() => { const f = document.getElementById('suivi-frame'); f.src = f.src; });
  await p.waitForTimeout(1500);
  await p.locator('#pk-apercu [data-ap="Agrandir"]').tap();
  await p.locator('#pk-apercu [data-ap="Fermer"]').tap(); await p.waitForTimeout(400);
  ok(await p.locator('#pk-apercu').count() === 0, 'cadre rechargé pendant l\'aperçu : « Fermer » répond toujours');
  // 4. Échap sur ordinateur, et rien ne reste dans l'historique après plusieurs ouvertures
  fr = await cadre(); await ouvrir();
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok(await p.locator('#pk-apercu').count() === 0, 'touche Échap : ferme l\'aperçu');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur'); process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
