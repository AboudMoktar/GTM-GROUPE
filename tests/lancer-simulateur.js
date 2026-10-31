#!/usr/bin/env node
// Lance les scénarios sur le simulateur local : node tests/lancer-simulateur.js
'use strict';
const {Simulateur} = require('./simulateur-regles.js');
const {SCENARIOS, donneesInitiales, MAINTENANT} = require('./scenarios.js');
// Option : node tests/lancer-simulateur.js database.rules.json  → mesure l'exposition des règles actuelles.
const fichier = process.argv[2];
const regles = fichier ? JSON.parse(require('fs').readFileSync(fichier, 'utf8')) : require('../outils/generer-regles.js').generer();

let ok = 0; const echecs = [];
SCENARIOS.forEach(([lib, compte, op, chemin, val, attendu]) => {
  const sim = new Simulateur(regles); sim.charger(donneesInitiales()); sim.maintenant = () => MAINTENANT;
  const auth = compte ? {uid:compte} : null;
  let r;
  if(op === 'lire') r = sim.lire(chemin, auth);
  else if(op === 'requete') r = sim.lire(chemin, auth, val);
  else if(op === 'ecrire') r = sim.ecrire(chemin, val, auth);
  else if(op === 'supprimer') r = sim.ecrire(chemin, null, auth);
  if(r === attendu) ok++; else echecs.push(`${lib} → obtenu ${r ? 'AUTORISÉ' : 'REFUSÉ'}, attendu ${attendu ? 'AUTORISÉ' : 'REFUSÉ'}`);
});
console.log(`Simulateur (${fichier || 'règles V2 générées'}) : ${ok}/${SCENARIOS.length} scénarios conformes`);
echecs.forEach(e => console.log('  ÉCHEC  ' + e));
process.exit(echecs.length ? 1 : 0);
