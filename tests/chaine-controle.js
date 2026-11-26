#!/usr/bin/env node
// Suivi chaîne (TEK-TREND) : pour le moment, objectif, goulot et pièces de la chaîne = poste CONTRÔLE (comme la Gestion Rendement) ;
// sans poste Contrôle : pièces = dernier poste, objectif = goulot (règle générale). Données inventées.
// Lancement (dans tests/) : node chaine-controle.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = {console, document: {addEventListener(){}, getElementById(){ return null; }, createElement(){ return {}; }, head: {appendChild(){}}}, window: {}, esc: (s) => String(s)};
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'fiche-chaine-module.js'), 'utf8'), ctx);
const r = [];
function essai(postes){
  const ent = []; postes.forEach(([nom, q, o, n]) => { for(let i = 0; i < (n || 1); i++) ent.push({key: nom + i, id: nom + i, e: {}, mid: null, mnom: '', i: 0, poste: nom, q: q / (n || 1), o: o / (n || 1)}); });
  vm.runInContext('fcAff = () => null; fcPostesOrdre = () => ORD; fcEntries = () => ENT; fcCalcul = (en) => ({qty: en.q, obj: en.o, pertes: 0, etat: {cls: "good"}});', Object.assign(ctx, {ORD: postes.map(p => p[0]), ENT: ent}));
  return vm.runInContext('fcTotaux("2026-11-26", {})', ctx);
}
let T = essai([['EMBALLAGE', 0, 170], ['SUR MACHINE', 100, 2310, 14], ['FINITION', 300, 680, 4], ['CONTROLE', 250, 340, 2], ['FEMME DE MENAGE', 0, 170], ['DISTRIBUTRICE', 0, 0]]);
r.push(['avec un poste Contrôle : objectif = contrôle (340), pas l\'emballage (170)', T.o === 340]);
r.push(['goulot = CONTROLE', T.goulot && T.goulot.nom === 'CONTROLE']);
r.push(['pièces chaîne = pièces du contrôle (250), rendement 74 %', T.q === 250 && Math.round(T.rend) === 74]);
r.push(['« Contrôle » avec accent reconnu', essai([['Contrôle', 10, 20], ['Emballage', 5, 8]]).o === 20]);
T = essai([['COUPE', 50, 100], ['FINITION', 40, 60], ['EMBALLAGE', 30, 80]]);
r.push(['sans poste Contrôle : règle générale (dernier poste 30 / goulot 60)', T.q === 30 && T.o === 60 && T.goulot.nom === 'FINITION']);
r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); process.exit(r.every(x => x[1]) ? 0 : 1);
