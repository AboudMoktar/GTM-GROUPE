#!/usr/bin/env node
// Coupe → assemblage automatique (23/11/2026) : sauf exosquelette et brassière, les pièces coupées passent d'elles-mêmes
// à l'assemblage (« Envoyée à la GADH »), à la date de leur coupe, anciennes coupes des commandes en cours comprises.
// Données inventées. Lancement (dans tests/) : node coupe-assemblage.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8816), b = await chromium.launch(), r = [], err = [];
  const p = await (await b.newContext({viewport: {width: 1280, height: 900}})).newPage();
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8816/suivi-commandes.html'); await p.waitForFunction(() => typeof normaliserAssemblage === 'function' && typeof S === 'object');
  const R = await p.evaluate(() => {
    const L = (id, lot, model, lib, qty) => ({id, lot, year:2026, client:'PERCKO', model, lib, size:'M', qty, cc:0});
    S.lines.push(L('P1', 'PK1', 'PHARMA-HOMME', 'PHARMA_HOMME COL V NOIR', 200), L('E1', 'PK1', 'EXOSQUELETTE', 'EXOSQUELETTE', 50), L('B1', 'PK1', 'BRASSIÈRE', 'BRASSIÈRE C-D', 50), L('F1', 'PK0', 'PHARMA-HOMME', 'PHARMA_HOMME COL V NOIR', 10));
    S.lots.PK1 = {ready:'2026-11-01'}; S.lots.PK0 = {ready:'2026-10-01', closed:'2026-10-30'};
    const mv = (id, st, q, d) => S.moves.push({id:nid('M'), date:d, lineId:id, stage:st, qty:q, nc:0, note:''});
    // anciennes saisies : 100 coupées le 10/11 dont 40 envoyées, 50 coupées le 12/11 ; exo et brassière coupés ; commande clôturée
    mv('P1', 'cp', 100, '2026-11-10'); mv('P1', 'gadh', 40, '2026-11-10'); mv('P1', 'cp', 50, '2026-11-12');
    mv('E1', 'cp', 30, '2026-11-10'); mv('B1', 'cp', 20, '2026-11-10'); mv('F1', 'cp', 10, '2026-10-05');
    const n = normaliserAssemblage(), g = S.moves.filter(m => m.lineId === 'P1' && m.stage === 'gadh').map(m => [m.date, m.qty]);
    const t = stageTotals();
    const res = {n, g, p1:t.P1.gadh, e1:t.E1.gadh || 0, b1:t.B1.gadh || 0, f1:t.F1.gadh || 0, deux:normaliserAssemblage()};
    // nouvelle coupe saisie : passe aussitôt à l'assemblage
    ui.lot = 'PK1'; commit(() => { modifierEtape('cp', {P1:180}, 'test', '2026-11-20'); });
    res.apres = stageTotals().P1.gadh; res.dateAuto = S.moves.filter(m => m.lineId === 'P1' && m.stage === 'gadh').pop().date;
    // coupe corrigée à la baisse : l'assemblage suit
    commit(() => { modifierEtape('cp', {P1:170}, 'test', '2026-11-21'); });
    res.baisse = stageTotals().P1.gadh;
    // confection saisie au-delà de la coupe : refusée
    let refus = false; try { checkMoves([{lineId:'P1', stage:'ret', qty:171}]); } catch (e) { refus = true; } res.refus = refus;
    // vue GADH : aucune écriture automatique
    S.moves.push({id:nid('M'), date:'2026-11-22', lineId:'P1', stage:'cp', qty:5, nc:0, note:''}); VUE = 'gadh'; res.gadhVue = normaliserAssemblage(); VUE = 'tek';
    return res;
  });
  r.push(['anciennes coupes : 60 + 50 passées à l\'assemblage, chacune à la date de sa coupe', JSON.stringify(R.g) === JSON.stringify([['2026-11-10', 40], ['2026-11-10', 60], ['2026-11-12', 50]]) && R.p1 === 150]);
  r.push(['exosquelette et brassière : rien d\'automatique', R.e1 === 0 && R.b1 === 0]);
  r.push(['commande terminée ou clôturée : inchangée', R.f1 === 0]);
  r.push(['une seule fois (rien à refaire ensuite)', R.deux === 0]);
  r.push(['nouvelle coupe : aussitôt à l\'assemblage, à sa date', R.apres === 180 && R.dateAuto === '2026-11-20']);
  r.push(['coupe corrigée à la baisse : l\'assemblage suit', R.baisse === 170]);
  r.push(['contrôle : confection au-delà de la coupe refusée', R.refus]);
  r.push(['vue GADH : aucune écriture automatique', R.gadhVue === 0]);
  // saisie par étape : l'étape « Envoi GADH » est automatique pour une commande sans exo / brassière
  await p.evaluate(() => { S.lines.push({id:'P2', lot:'PK2', year:2026, client:'PERCKO', model:'PHARMA-HOMME', lib:'PHARMA_HOMME COL V NOIR', size:'S', qty:10, cc:0}); S.lots.PK2 = {ready:'2026-11-01'}; ui.lot = 'PK2'; ui.client = '*'; ui.tab = 'flux'; ui.fmode = 'simple'; ui.sxOpen = false; render(); });
  await p.waitForTimeout(300);
  r.push(['saisie par étape : « Envoi GADH » automatique', /auto/.test(await p.locator('.sx-tile', {hasText: 'Envoi GADH'}).first().getAttribute('class') || '')]);
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
