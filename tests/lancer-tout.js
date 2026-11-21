#!/usr/bin/env node
// Lance TOUS les tests, l'un après l'autre, à lancer DANS l'émulateur Firebase :
//   cd tests && npx firebase emulators:exec --config firebase-tests.json --only auth,database \
//     --project demo-gtm-groupe "node lancer-tout.js"
// Avant chaque test, l'émulateur est remis à zéro (comptes + base) : sans cela, les comptes de test
// créés par un test faisaient échouer le suivant (« adresse déjà utilisée »).
// Option : node lancer-tout.js facture  → seulement les tests dont le nom contient « facture ».
'use strict';
const fs = require('fs'), path = require('path'), {spawnSync} = require('child_process');
const PROJET = 'demo-gtm-groupe';
// Fichiers d'aide (pas des tests) et tests demandant un émulateur supplémentaire.
const EXCLUS = new Set(['serveur.js', 'admin.js', 'lancer-tout.js', 'lancer-simulateur.js', 'emulateur.js', 'fonctions.js']);
const filtre = process.argv[2] || '';
const tests = fs.readdirSync(__dirname).filter(f => /\.js$/.test(f) && !EXCLUS.has(f) && f.indexOf(filtre) >= 0).sort();

// Appel à l'émulateur, réessayé : après un long test, la première requête peut tomber sur une
// connexion déjà fermée par l'émulateur (« fetch failed »).
async function appel(url, init){
  for(let k = 0; k < 4; k++){
    try { const r = await fetch(url, init); if(r.ok) return true; } catch(e) {}
    await new Promise(res => setTimeout(res, 300 * (k + 1)));
  }
  console.log('         (remise à zéro impossible : ' + url + ')'); return false;
}
async function remiseAZero(){
  const h = {Authorization: 'Bearer owner'};
  await appel(`http://127.0.0.1:9099/emulator/v1/projects/${PROJET}/accounts`, {method: 'DELETE', headers: h});
  await appel(`http://127.0.0.1:9000/.json?ns=${PROJET}`, {method: 'PUT', body: 'null', headers: h});
  // Règles ouvertes par défaut : un test qui a besoin des vraies règles (e2e-roles, e2e-factures…) les charge lui-même.
  await appel(`http://127.0.0.1:9000/.settings/rules.json?ns=${PROJET}`, {method: 'PUT', body: '{"rules":{".read":true,".write":true}}', headers: h});
}

(async () => {
  const resultats = [], debut = Date.now();
  for (const t of tests) {
    await remiseAZero();
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(__dirname, t)], {cwd: __dirname, encoding: 'utf8', timeout: 420000, env: process.env, maxBuffer: 64 * 1024 * 1024});
    const ok = r.status === 0, duree = Math.round((Date.now() - t0) / 1000);
    resultats.push({t, ok, duree});
    console.log(`${ok ? 'ok    ' : 'ÉCHEC '} ${t} (${duree} s)`);
    if (!ok) {
      const sortie = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => /ÉCHEC|Error|error|échec/.test(l)).slice(0, 8);
      sortie.forEach(l => console.log('         ' + l.slice(0, 220)));
      if (r.error) console.log('         ' + String(r.error).slice(0, 220));
    }
  }
  const ko = resultats.filter(r => !r.ok);
  console.log(`\n${resultats.length - ko.length}/${resultats.length} tests réussis en ${Math.round((Date.now() - debut) / 60000)} min` + (ko.length ? ' — en échec : ' + ko.map(r => r.t).join(', ') : ''));
  process.exit(ko.length ? 1 : 0);
})();
