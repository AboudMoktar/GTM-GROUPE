#!/usr/bin/env node
// ============================================================
// Serveur web local des tests (remplace « python3 -m http.server 8790 »).
//  - sert l'application depuis la racine du dépôt ;
//  - remplace firebase-config.js par la configuration des émulateurs ;
//  - adapte la politique de sécurité (balise <meta> CSP) : les adresses des émulateurs locaux
//    sont ajoutées à celles de Firebase, sinon la vraie politique bloquerait les émulateurs ;
//  - option gzip (comme GitHub Pages) et option « essai » (politique envoyée en Report-Only).
// Lancement seul : node tests/serveur.js        (port 8790)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..'), PROJET = 'demo-gtm-groupe';
const CONFIG = `const firebaseConfig = {apiKey:'demo-cle', authDomain:'localhost', databaseURL:'http://127.0.0.1:9000?ns=${PROJET}', projectId:'${PROJET}'};
(function(){ const init = firebase.initializeApp.bind(firebase); firebase.initializeApp = function(c, n){ const app = init(c, n);
  try { app.auth().useEmulator('http://127.0.0.1:9099', {disableWarnings:true}); } catch(e) {} try { app.database().useEmulator('127.0.0.1', 9000); } catch(e) {} return app; }; })();`;
const POLITIQUE = fs.readFileSync(path.join(__dirname, 'csp-politique.txt'), 'utf8').trim().replace(/\s*\n\s*/g, ' ');
const EMU = {'script-src':'http://127.0.0.1:9000', 'connect-src':'http://127.0.0.1:9000 ws://127.0.0.1:9000 http://127.0.0.1:9099', 'frame-src':'http://127.0.0.1:9099 http://127.0.0.1:9000'};
const avecEmulateurs = (pol) => pol.split(';').map(d => { const t = d.trim(), n = t.split(/\s+/)[0]; return EMU[n] ? t + ' ' + EMU[n] : t; }).join('; ');
const POLITIQUE_TEST = avecEmulateurs(POLITIQUE);
const PAGES = /^\/(index\.html|mgt-crm-app\.html|suivi-commandes\.html)$/;
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'application/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'};
const META = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;

function demarrer(port, options){
  const o = options || {};
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if(p.endsWith('/')) p += 'index.html';
    if(p === '/firebase-config.js'){ res.writeHead(200, {'Content-Type':'application/javascript'}); return res.end(CONFIG); }
    const f = path.join(RACINE, path.normalize(p));
    if(!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end(); }
    let corps = fs.readFileSync(f);
    const h = {'Content-Type':TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control':o.cache || 'no-cache'};
    if(PAGES.test(p)){
      let html = corps.toString('utf8');
      if(o.essai){ html = html.replace(META, ''); h['Content-Security-Policy-Report-Only'] = POLITIQUE_TEST; }
      else html = html.replace(META, (m, a, pol, z) => a + avecEmulateurs(pol) + z);
      corps = Buffer.from(html, 'utf8');
    }
    if(o.gzip && /gzip/.test(req.headers['accept-encoding'] || '')){ h['Content-Encoding'] = 'gzip'; corps = zlib.gzipSync(corps); }
    res.writeHead(200, h); res.end(corps);
  }).listen(port);
}
module.exports = {demarrer, POLITIQUE, POLITIQUE_TEST, META};
if(require.main === module){ const port = +(process.env.PORT || 8790); demarrer(port); console.log('Serveur de test : http://localhost:' + port + '/index.html'); }
