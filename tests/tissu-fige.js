#!/usr/bin/env node
// Suivi PERCKO : changement de tissu d'un modèle (Gilet noir → Renew Cult Noir, 13/11/2026) ; une commande déjà coupée
// garde son tissu d'avant (tissu figé par commande). Fiches de coupe / d'assemblage et consommations par commande.
// Données inventées. Lancement (dans tests/) : npm run tissu-fige
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8798), b = await chromium.launch(), p = await (await b.newContext()).newPage();
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8798/suivi-commandes.html'); await p.waitForFunction(() => typeof giletRenewCult === 'function' && typeof S === 'object');
  const d = await p.evaluate(() => {
    /* état d'avant : gilets en Caresse Noir */
    S.nomen.forEach(n => { if (/^Gilet (homme|femme) noir$/.test(n.lib)) n.t1 = 'Caresse Noir'; });
    S.ajouts = {}; S.lots = {};
    const L = (id, lot, lib, model, q) => ({id, lot, year:2026, client:'NEOLYS', model, lib, size:'M', qty:q, cc:0});
    S.lines.push(L('A', 'PK202611-1', 'Gilet homme noir', 'Gilet-H-Noir', 100), L('B', 'PK202611-1', 'Gilet femme noir', 'Gilet-F-Noir', 50), L('P', 'PK202611-1', 'PHARMA_HOMME COL V NOIR', 'PHARMA-HOMME', 100),
      L('C', 'PK202612-1', 'Gilet homme noir', 'Gilet-H-Noir', 200), L('E', 'PK202612-1', 'Gilet femme noir', 'Gilet-F-Noir', 80));
    S.moves.push({id:'m1', date:'2026-11-03', lineId:'A', stage:'cp', qty:105, nc:0, note:''}, {id:'m2', date:'2026-11-03', lineId:'B', stage:'cp', qty:52, nc:0, note:''});
    const fab = (lot) => { const o = {}; conso(lot, '*').fabs.forEach(f => { o[f.fabric] = [f.coupe, f.ass]; }); return o; };
    const avant = fab('PK202611-1');
    const fait = giletRenewCult(), refait = giletRenewCult();
    const txt = (g) => g.rows.map(r => (r.cells || []).map(c => c ? c.v : '').join('|')).join('\n');
    return {fait, refait, avant, apres: fab('PK202611-1'), nouv: fab('PK202612-1'), nomen: S.nomen.filter(n => /^Gilet/.test(n.lib)).every(n => n.t1 === 'Renew Cult Noir'),
      fige: JSON.stringify(S.lots['PK202611-1'].tissus), figeNouv: (S.lots['PK202612-1'] || {}).tissus || null, mat: Object.keys(S.mat).some(r => S.mat[r][0] === 'Renew Cult Noir'),
      j: (S.bomJ[S.bomJ.length - 1] || {}).t, coupeAnc: txt(ficheGrid('PK202611-1', '*', 'c', false, 'PROGES')), coupeNouv: txt(ficheGrid('PK202612-1', '*', 'c', false, 'PROGES')), assNouv: txt(ficheGrid('PK202612-1', '*', 'a'))};
  });
  const r = [];
  r.push(['changement appliqué une seule fois', d.fait === true && d.refait === false]);
  r.push(['nomenclature : Gilet homme et femme noir en Renew Cult Noir (matière présente)', d.nomen && d.mat]);
  r.push(['commande déjà coupée : tissu figé « Caresse Noir »', d.fige === '{"Gilet homme noir":"Caresse Noir","Gilet femme noir":"Caresse Noir"}' && d.figeNouv === null]);
  r.push(['commande déjà coupée : consommations inchangées', JSON.stringify(d.avant) === JSON.stringify(d.apres) && !d.apres['Renew Cult Noir']]);
  r.push(['nouvelle commande : gilets en Renew Cult Noir (coupe et assemblage)', !!d.nouv['Renew Cult Noir'] && d.nouv['Renew Cult Noir'][0] > 0 && d.nouv['Renew Cult Noir'][1] > 0 && !d.nouv['Caresse Noir']]);
  r.push(['fiche de coupe PROGES : ancien lot Caresse, nouveau lot Renew Cult', /Caresse Noir/i.test(d.coupeAnc) && !/Renew Cult/i.test(d.coupeAnc) && /Renew Cult Noir/i.test(d.coupeNouv)]);
  r.push(['fiche d\'assemblage GADH (nouveau lot) : Renew Cult Noir', /Renew Cult Noir/i.test(d.assNouv)]);
  r.push(['noté dans le journal de la nomenclature', /Gilet noir.*Renew Cult Noir.*PK202611-1/.test(d.j || '')]);
  r.push(['aucune erreur JavaScript', err.length === 0]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
