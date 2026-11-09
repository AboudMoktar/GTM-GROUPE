#!/usr/bin/env node
// Suivi PERCKO : fiches de consommation (PROGES / GADH) et commande en Excel / PDF, seulement les modèles et tailles avec quantité.
// Lancement (dans tests/) : npm run fiches-compactes
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof ficheGrid === 'function');
  const r = await p.evaluate(() => {
    const out = [], L = (id, lib, sz, q) => ({id, lot:'PK209912', year:2026, client:'ALLOGA', model:'PHARMA-HOMME', lib, size:sz, qty:q, cc:0});
    S.lines.push(L('F1', 'PHARMA_HOMME COL V SABLE', 'XS', 45), L('F2', 'PHARMA_HOMME COL V SABLE', 'S', 90), L('F4', 'PHARMA_HOMME COL V GRIS', 'L', 25));
    ui.lot = 'PK209912'; ui.client = 'ALLOGA';
    const lignes = (g, col) => g.rows.slice(3, g.screenRows).filter(x => x.cells[col] && x.cells[col].v && x.cells[4] && x.cells[4].v).map(x => x.cells[2].v + ' ' + x.cells[4].v);
    const plein = ficheGrid('PK209912', 'ALLOGA', 'c'), compact = grilleFiche('c');
    const lp = lignes(plein, 2), lc = lignes(compact, 2);
    out.push(['écran : fiche complète (toutes les références)', lp.length > 10 && lp.some(x => /COL V NOIR XS/.test(x))]);
    out.push(['fiche Excel/PDF : seulement les tailles avec quantité', JSON.stringify(lc) === JSON.stringify(['PHARMA_HOMME COL V SABLE XS', 'PHARMA_HOMME COL V SABLE S', 'PHARMA_HOMME COL V GRIS L'])]);
    const qte = compact.rows.slice(3, compact.screenRows).filter(x => x.cells[5] && x.cells[5].st && x.cells[5].st.fg === 'FF0000').map(x => x.cells[5].v);
    out.push(['totaux des modèles gardés', JSON.stringify(qte.filter(Boolean)) === JSON.stringify([145, 30])]);
    let nom = null; const sv = window.saveFile; window.saveFile = (n) => { nom = n; };
    exportFichesPdf('c'); const pdfOk = /^Consommation_PROGES_PK209912_\d{8}\.pdf$/.test(nom); exportFiches('a'); const xOk = /^Consommation_GADH_PK209912_\d{8}\.xlsx$/.test(nom); window.saveFile = sv;
    out.push(['fiches en PDF et en Excel', pdfOk && xOk]);
    const cg = commandeGrid('PK209912', 2026, 'ALLOGA'), lcg = cg.rows.slice(3, -1).map(x => x.cells[1].v + ' ' + x.cells[2].v + ' ' + x.cells[3].v);
    out.push(['commande Excel : seulement les modèles et tailles commandés', JSON.stringify(lcg) === JSON.stringify(['PHARMA_HOMME COL V GRIS L 25', 'PHARMA_HOMME COL V SABLE XS 45', 'PHARMA_HOMME COL V SABLE S 90'])]);
    const ct = commandeGrid('PK209912', 2026, '*'), tete = ct.rows[2].cells.map(x => x ? x.v : '').join('|'), t0 = ct.rows[0].cells.map(x => x ? x.v : '').filter(Boolean).join('|');
    out.push(['fiche de commande au format initial (Commande: MOIS | LOT | ANNEE ; Model | LIBELLE | Taille | clients | Total | Total)', /^Commande: \S+\|LOT\|ANNEE$/.test(t0) && tete === 'Model|LIBELLE|Taille|NEOLYS|ALLOGA|FLÉCHÉS|VESTIAIRES|Total|Total' && ct.rows[1].cells[3].v === '2026']);
    out.push(['fiche de commande : ligne TOTAL et une seule page', ct.rows[ct.rows.length - 1].cells[0].v === 'TOTAL' && ct.onePage === true]);
    return out;
  });
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
