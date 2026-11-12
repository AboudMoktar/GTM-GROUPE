#!/usr/bin/env node
// Assistant GTM, réponses calculées (sans IA externe) : intentions, filtres (article, taille, client, commande),
// chiffres exacts. Données inventées. Lancement (dans tests/) : npm run assistant-reponses
'use strict';
const R = require('../assistant-reponses.js');
const L = (id, cl, lib, sz, q) => [id, 2026, cl, 'M', lib, sz, q, 0];
const lines = [L('A', 'NEOLYS', 'PHARMA_FEMME COL V NOIR', 'M', 100), L('B', 'NEOLYS', 'PHARMA_FEMME COL ROND NOIR', 'M', 50), L('C', 'ALLOGA', 'PHARMA_FEMME COL V NOIR', 'L', 60),
  L('D', 'NEOLYS', 'Tee-shirt Sport homme noir', 'XL', 190), L('E', 'NEOLYS', 'Gilet femme noir', 'S', 40)];
const mv = []; let n = 0; const M = (d, l, st, q, nc, ct) => { const a = ['M' + (n++), d, l, st, q, '', nc || 0]; if (ct) a.push('', ct); mv.push(a); };
['cp', 'gadh'].forEach(s => M('2026-11-02', 'A', s, 100)); ['asm', 'ret', 'conf'].forEach(s => M('2026-11-04', 'A', s, 70)); M('2026-11-06', 'A', 'ctl', 60, 2); M('2026-11-06', 'A', 'emb', 50); M('2026-11-07', 'A', 'exp', 40);
['cp', 'gadh'].forEach(s => M('2026-11-02', 'B', s, 30));
['cp', 'gadh', 'asm', 'ret', 'conf'].forEach(s => M('2026-11-02', 'D', s, 210)); M('2026-11-06', 'D', 'ctl', 190); M('2026-11-21', 'D', 'emb', 90, 0, 'XC1'); M('2026-11-21', 'D', 'emb', 90, 0, 'XC2');
['cp', 'gadh', 'asm', 'ret', 'conf'].forEach(s => M('2026-11-02', 'E', s, 50));
const docs = {'lines-PK1': {lot: 'PK202611-1', lines}, 'moves-PK1-0': {lot: 'PK202611-1', k: 0, moves: mv}, cfg: {lots: {'PK202611-1': {livraison: '2026-11-10'}}},
  exports: {liste: [{id: 'X1', n: 1, cl: 'NEOLYS', nat: 'NEOLYS', d: '2026-11-21', st: 'cours', cartons: [{id: 'XC1', n: 1, it: [['D', 90, 'PK202611-1', 'Tee-shirt Sport homme noir', 'XL']]}, {id: 'XC2', n: 2, it: [['D', 90, 'PK202611-1', 'Tee-shirt Sport homme noir', 'XL']]}]}]}};
const q = (t) => R.repondre(t, docs, '2026-11-12') || '';
const r = [];
let a = q('Où en est la commande ?');
r.push(['état : commandé 440, expédié 40, reste 400', /440\*\* commandées/.test(a) && /\*\*40\*\* expédiées/.test(a) && /reste à livrer \*\*400\*\*/.test(a)]);
r.push(['état : livraison dépassée signalée', /en retard de 2 jours/.test(a)]);
r.push(['état : pièces actuellement (chez la GADH 30+30, emballées 10+180)', /Chez la GADH \(envoyées, pas revenues\) : \*\*60\*\*/.test(a) && /Emballées, prêtes à expédier : \*\*190\*\*/.test(a) && /Export N°1 en préparation/.test(a)]);
a = q('Reste à produire en pharma femme col v noir');
r.push(['« col v » : seulement COL V NOIR (pas COL ROND)', /PHARMA_FEMME COL V NOIR/.test(a) && !/COL ROND/.test(a) && /: 110 pièces/.test(a)]);
a = q('Reste à produire en col v pour ALLOGA');
r.push(['client compris : ALLOGA L 60', /ALLOGA : 60 pièces/.test(a) && /L 60/.test(a)]);
a = q("Résumé de l'export en cours");
r.push(['« l\'export » : pas de taille L ajoutée ; export 180 pièces', /Export N°1/.test(a) && /\*\*180\*\* pièces/.test(a) && /XL 180/.test(a)]);
a = q('Où sont les pièces de tee shirt sport homme XL ?');
r.push(['article + taille : XL en confection 20, contrôlées 10, emballées 180', /En confection : \*\*20\*\*/.test(a) && /Contrôlées, pas encore emballées : \*\*10\*\*/.test(a) && /Emballées, prêtes à expédier : \*\*180\*\*/.test(a)]);
a = q('Reste à produire en tee-shirt XL');
r.push(['reste à produire XL = 190 − 180 = 10', /: 10 pièces/.test(a)]);
r.push(['prêt à expédier : 190', /Emballé, prêt à expédier : 190 pièces/.test(q('Qu\'est-ce qui est prêt à expédier ?'))]);
a = q('Combien d\'expédiés ?');
r.push(['expédié : 40, date du 07/11', /Expédié : 40 pièces/.test(a) && /07\/11\/2026/.test(a)]);
r.push(['chez la GADH : 60', /Chez la GADH \(envoyées, pas encore revenues\) : 60 pièces/.test(q('Chez la GADH ?'))]);
r.push(['non conformes : 2 au contrôle', /Non conformes \(NC\) : 2 pièces/.test(q('Non conformes ?')) && /Contrôle : \*\*2\*\*/.test(q('Non conformes ?'))]);
r.push(['livraison : en retard', /La date de livraison est dépassée/.test(q('Livraison ?'))]);
r.push(['article inconnu : dit clairement', /aucun article qui corresponde à « pantalon »/.test(q('Reste à produire en pantalon'))]);
r.push(['question libre non reconnue : null (aide ou Gemini)', R.repondre('Écris-moi un poème', docs, '2026-11-12') === null]);
r.push(['bonjour : présentation et exemples', /^Bonjour !/.test(q('Bonjour'))]);
r.push(['« tu » n\'est pas pris pour la taille TU', !/taille TU/.test(q('Est-ce que tu sais ce qui reste à produire ?'))]);
let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur'); process.exit(ko ? 1 : 0);
