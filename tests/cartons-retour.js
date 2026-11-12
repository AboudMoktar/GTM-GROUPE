#!/usr/bin/env node
// Suivi PERCKO, emballage : une pièce ne va en carton que si elle est revenue de la GADH (données d'essai, sans base).
// Lancement (dans tests/) : npm run cartons
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof enregistrerCarton === 'function');
  const r = await p.evaluate(() => {
    const out = [], essai = (f) => { try { f(); return ''; } catch(e) { return e.message; } };
    S.lines.push({id:'LXS', lot:'PKT', client:'NEOLYS', model:'Pro Homme', lib:'LYNE PRO homme gris', size:'XS', qty:10, cc:0});
    S.lines.push({id:'LS', lot:'PKT', client:'NEOLYS', model:'Pro Homme', lib:'LYNE PRO homme gris', size:'S', qty:115, cc:0});
    ['cp', 'gadh', 'asm', 'ret', 'conf'].forEach((st, i) => { S.moves.push({id:'MX' + i, date:'2026-11-04', lineId:'LXS', stage:st, qty:13, nc:0, note:''}); S.moves.push({id:'MS' + i, date:'2026-11-04', lineId:'LS', stage:st, qty:118, nc:0, note:''}); });
    const C = (id, n, it) => ({id, n, cl:'NEOLYS', d:'2026-11-04', it, kg:null});
    out.push(['carton dans la limite du retour accepté', essai(() => enregistrerCarton('PKT', C('C1', 1, [['LXS', 12], ['LS', 38]]))) === '']);
    const e2 = essai(() => enregistrerCarton('PKT', C('C2', 2, [['LXS', 10], ['LS', 40]])));
    out.push(['carton au-delà du retour refusé (13 revenues, 12 déjà en carton)', /retour GADH 13, déjà en carton ou expédié 12 — il reste 1 pièce/.test(e2)]);
    out.push(['rien d\'enregistré après le refus', S.cartons.PKT.length === 1 && !S.moves.some(m => m.ct === 'C2')]);
    out.push(['dernière pièce acceptée', essai(() => enregistrerCarton('PKT', C('C2', 2, [['LXS', 1], ['LS', 40]]))) === '']);
    out.push(['modification d\'un carton : son ancien contenu ne compte pas', essai(() => enregistrerCarton('PKT', C('C1', 1, [['LXS', 12], ['LS', 30]]))) === '']);
    out.push(['modification au-delà du retour refusée', /il reste 12 pièce/.test(essai(() => enregistrerCarton('PKT', C('C1', 1, [['LXS', 13]]))))]);
    out.push(['reste à emballer', dispoRetour('PKT', 'LXS', null) === 0 && dispoRetour('PKT', 'LS', null) === 48]);
    S.moves.push({id:'M3', date:'2026-11-04', lineId:'LS', stage:'ret', qty:-118, nc:0, note:''});
    out.push(['sans retour GADH saisi : message clair', /saisissez d'abord le retour GADH/.test(essai(() => enregistrerCarton('PKT', C('C3', 3, [['LS', 5]]))))]);
    S.moves.pop();
    // « Tout valider » : contrôle de l'ensemble avant tout enregistrement
    const avant = S.cartons.PKT.length;
    const et = essai(() => verifierRetour('PKT', [C('C4', 4, [['LS', 30]]), C('C5', 5, [['LS', 30]])]));
    out.push(['plusieurs cartons contrôlés ensemble', /il reste 48 pièce/.test(et) && S.cartons.PKT.length === avant]);
    return out;
  });
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
