#!/usr/bin/env node
// Nouvelle version publiée pendant que l'application est ouverte : la page ne doit PAS se recharger
// toute seule (saisie en cours perdue) ; un bandeau propose « Mettre à jour ». Lancement : npm run mise-a-jour
'use strict';
const {chromium} = require('playwright'); const http = require('http'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8805); let version = 'A';
  // relais : sw.js reçoit un suffixe de version pour simuler une publication
  const relais = http.createServer((req, res) => {
    const r = http.request({host:'127.0.0.1', port:8805, path:req.url, method:req.method, headers:Object.assign({}, req.headers, {'accept-encoding':'identity'})}, rr => {
      if (/\/sw\.js/.test(req.url)){ let b = ''; rr.setEncoding('utf8'); rr.on('data', d => b += d); rr.on('end', () => { const h = Object.assign({}, rr.headers); delete h['content-length']; res.writeHead(rr.statusCode, h); res.end(b + '\n// version de test ' + version + '\n'); }); }
      else { res.writeHead(rr.statusCode, rr.headers); rr.pipe(res); }
    }); r.on('error', () => res.destroy()); req.pipe(r);
  }).listen(8806);
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1280, height:800}});
  await ctx.route(u => !/^http:\/\/(localhost|127\.0\.0\.1):8806/.test(String(u)), rt => rt.abort());
  const p = await ctx.newPage(); let chargements = 0; p.on('load', () => chargements++);
  await p.goto('http://localhost:8806/index.html');
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout:30000}).catch(() => {});
  await p.waitForTimeout(1500);
  ok(chargements === 1, 'premier lancement : une seule ouverture (pas de fermeture / réouverture)');
  ok(!(await p.$('#gtm-maj')), 'premier lancement : pas de bandeau');
  // saisie en cours puis publication d'une nouvelle version
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'saisie'; document.body.appendChild(i); i.value = 'saisie en cours'; window.__marque = 1; });
  version = 'B';
  await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await p.waitForSelector('#gtm-maj', {timeout:20000}).catch(() => {});
  await p.waitForTimeout(1500);
  ok(chargements === 1 && await p.evaluate(() => window.__marque === 1 && document.getElementById('saisie').value === 'saisie en cours'), 'nouvelle version publiée : la page ne se recharge pas, la saisie reste');
  ok(!!(await p.$('#gtm-maj')) && /nouvelle version/.test(await p.textContent('#gtm-maj')), 'bandeau « Une nouvelle version de l\'application est prête »');
  await p.click('#gtm-maj-non'); ok(!(await p.$('#gtm-maj')), '« Plus tard » ferme le bandeau');
  // une autre version : « Mettre à jour » recharge
  version = 'C';
  await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await p.waitForSelector('#gtm-maj', {timeout:20000});
  await Promise.all([p.waitForEvent('load'), p.click('#gtm-maj-ok')]);
  await p.waitForTimeout(800);
  ok(chargements === 2 && await p.evaluate(() => window.__marque === undefined), '« Mettre à jour » recharge l\'application');
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); relais.close(); process.exit(echecs ? 1 : 0);
})();
