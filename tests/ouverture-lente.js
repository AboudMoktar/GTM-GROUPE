#!/usr/bin/env node
// Ouverture avec un réseau lent ou bloqué : le service worker doit afficher l'application
// depuis le cache au bout de quelques secondes au lieu de laisser la fenêtre vide.
// Lancement (dans tests/) : npm run ouverture-lente
'use strict';
const {chromium} = require('playwright'); const http = require('http'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8803); let lent = false;
  // relais devant le serveur de test : en mode « lent », il ne répond qu'après 25 s
  const relais = http.createServer((req, res) => {
    const go = () => { const r = http.request({host:'127.0.0.1', port:8803, path:req.url, method:req.method, headers:req.headers}, rr => { res.writeHead(rr.statusCode, rr.headers); rr.pipe(res); }); r.on('error', () => { try { res.destroy(); } catch(e){} }); req.pipe(r); };
    if (lent) setTimeout(go, 25000); else go();
  }).listen(8804);
  const b = await chromium.launch(), r = [];
  const ctx = await b.newContext({viewport:{width:1366, height:768}});
  await ctx.route(u => !/^http:\/\/(localhost|127\.0\.0\.1):8804/.test(String(u)), rt => rt.abort());
  const p = await ctx.newPage();
  await p.goto('http://localhost:8804/index.html');
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || false, null, {timeout:30000}).catch(() => {});
  if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) { await p.reload(); await p.waitForTimeout(1500); }
  await p.waitForFunction(() => caches.keys().then(k => k.some(x => /^groupe-v/.test(x))), null, {timeout:30000});
  await p.waitForTimeout(3000);   // mise en cache complète
  r.push(['service worker actif et application en cache', await p.evaluate(() => !!navigator.serviceWorker.controller)]);
  lent = true;
  const t0 = Date.now();
  await p.goto('http://localhost:8804/index.html', {waitUntil:'commit', timeout:60000}).catch(() => {});
  let visible = false;
  try { await p.waitForFunction(() => { const a = document.getElementById('app'); return a && a.offsetHeight > 0 && document.body.innerText.trim().length > 0; }, null, {timeout:15000}); visible = true; } catch(e) {}
  const duree = Date.now() - t0;
  r.push(['réseau bloqué 25 s : l\'application s\'affiche quand même depuis le cache (' + (visible ? Math.round(duree / 100) / 10 + ' s' : 'rien après 15 s') + ')', visible && duree < 14000]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); relais.close(); process.exit(ko ? 1 : 0);
})();
