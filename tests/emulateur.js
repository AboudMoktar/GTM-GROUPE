#!/usr/bin/env node
// ============================================================
// Mêmes scénarios que le simulateur, sur l'émulateur Firebase officiel.
// ============================================================
// Prérequis (une fois, dans ce dossier tests/) : npm install
// Puis : npm run regles && npm run emulateur
// Le projet « demo-gtm-groupe » est fictif : rien ne touche la vraie base.
'use strict';
const fs = require('fs');
const path = require('path');
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('@firebase/rules-unit-testing');
const {ref, get, set, remove, query, orderByKey, startAt, endAt} = require('firebase/database');
const {SCENARIOS, donneesInitiales} = require('./scenarios.js');

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-gtm-groupe',
    database: {rules: fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8'), host: '127.0.0.1', port: 9000}
  });
  let ok = 0; const echecs = [];
  for(const [lib, compte, op, chemin, val, attendu] of SCENARIOS){
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async (ctx) => { await set(ref(ctx.database(), '/'), donneesInitiales()); });
    const ctx = compte ? env.authenticatedContext(compte) : env.unauthenticatedContext();
    const db = ctx.database();
    let promesse;
    if(op === 'lire') promesse = get(ref(db, chemin));
    else if(op === 'requete') promesse = get(query(ref(db, chemin), orderByKey(), startAt(val.startAt), endAt(val.endAt)));
    else if(op === 'ecrire') promesse = set(ref(db, chemin), val);
    else promesse = remove(ref(db, chemin));
    try { await (attendu ? assertSucceeds(promesse) : assertFails(promesse)); ok++; }
    catch(e){ echecs.push(lib + ' → attendu ' + (attendu ? 'AUTORISÉ' : 'REFUSÉ')); }
  }
  console.log(`Émulateur Firebase : ${ok}/${SCENARIOS.length} scénarios conformes`);
  echecs.forEach(e => console.log('  ÉCHEC  ' + e));
  await env.cleanup();
  process.exit(echecs.length ? 1 : 0);
})();
