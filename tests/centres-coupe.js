#!/usr/bin/env node
// Suivi PERCKO : centre de coupe par modèle (PROGES ; brassières chez MMGT ; exosquelettes chez TEK-TREND), fiches de coupe par centre.
// Lancement (dans tests/) : npm run centres-coupe
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof centreCoupe === 'function' && typeof vDocuments === 'function');
  const r = await p.evaluate(() => {
    const out = [], noms = (g) => g.rows.slice(3, g.screenRows).map(x => x.cells[2] && x.cells[2].v).filter(Boolean);
    ['S', 'M', 'L', 'XL', 'XXL'].forEach(z => S.nomen.push({model:'BRASSIÈRE', lib:'BRASSIÈRE A-B', size:z, t1:'Renew Cult Noir', t2:'', cc:0, ca:0.287, ca2:0, colle:0}));
    S.nomen.push({model:'EXOSQUELETTE', lib:'EXOSQUELETTE', size:'TU', t1:'', t2:'', cc:0, ca:0, ca2:0, colle:0});
    const L = (id, lib, sz, q) => ({id, lot:'PKC', year:2026, client:'NEOLYS', model:modelOf(lib), lib, size:sz, qty:q, cc:0});
    S.lines.push(L('P', 'PHARMA_HOMME COL V NOIR', 'M', 100), L('B', 'BRASSIÈRE A-B', 'M', 50), L('E', 'EXOSQUELETTE', 'TU', 20));
    S.lots.PKC = {ready:'2026-11-01'}; ui.lot = 'PKC'; ui.client = '*';
    out.push(['centre par défaut : PROGES, brassière MMGT, exosquelette TEK-TREND', centreCoupe('PHARMA-HOMME') === 'PROGES' && centreCoupe('BRASSIÈRE') === 'MMGT' && centreCoupe('EXOSQUELETTE') === 'TEK-TREND']);
    const pc = ordreParCentre('PKC');
    out.push(['ordre de coupe par centre', JSON.stringify(pc.map(x => x[0])) === '["PROGES","MMGT","TEK-TREND"]' && pc[1][1] >= 50 && pc[2][1] >= 20]);
    const gP = ficheGrid('PKC', '*', 'c', true), gM = ficheGrid('PKC', '*', 'c', true, 'MMGT'), gT = ficheGrid('PKC', '*', 'c', true, 'TEK-TREND');
    out.push(['fiche PROGES : sans brassière ni exosquelette', noms(gP).every(n => /PHARMA/.test(n)) && noms(gP).length > 0 && /PROGES/.test(gP.rows[0].cells[3].v)]);
    out.push(['fiche MMGT : les brassières', noms(gM).length > 0 && noms(gM).every(n => /BRASSI/.test(n)) && /Consommation Tissu : MMGT/.test(gM.rows[0].cells[3].v)]);
    out.push(['fiche TEK-TREND : les exosquelettes', noms(gT).length > 0 && noms(gT).every(n => /EXOSQUELETTE/.test(n))]);
    const env = envoiCoupeCard('PKC', true).textContent;
    out.push(['envoi au centre de coupe : détail par centre et une fiche par centre', /PROGES \d+ pcs · MMGT \d+ pcs · TEK-TREND \d+ pcs \(coupe interne\)/.test(env) && /Fiche de coupe MMGT/.test(env) && /Fiche de coupe TEK-TREND/.test(env)]);
    ui.tab = 'fiche'; ui.fiche = 'c'; render();
    out.push(['onglet Fiches : autres centres de coupe', /Autres centres de coupe/.test(document.getElementById('view').textContent) && /Fiche MMGT \(PDF\)/.test(document.getElementById('view').textContent)]);
    ui.tab = 'doc'; render();
    const t = [...document.querySelectorAll('.dc-d')].map(d => d.getAttribute('data-doc'));
    out.push(['Documents : une fiche de coupe par centre', ['Fiche de coupe (PROGES)', 'Fiche de coupe (MMGT)', 'Fiche de coupe (TEK-TREND)'].every(x => t.includes(x))]);
    ui.tab = 'reg'; render();
    const sel = [...document.querySelectorAll('#view table select')].find(x => x.closest('tr').textContent.indexOf('BRASSIÈRE') === 0);
    out.push(['Réglages : centre de coupe par modèle', !!sel && sel.value === 'MMGT']);
    sel.value = 'PROGES'; sel.dispatchEvent(new Event('change'));
    out.push(['changement du centre : la fiche PROGES reprend les brassières', centreCoupe('BRASSIÈRE') === 'PROGES' && noms(ficheGrid('PKC', '*', 'c', true)).some(n => /BRASSI/.test(n))]);
    const d = desiredDocs(); S.centres = {}; applyDocs(d);
    out.push(['réglage enregistré', d.cfg.centres['BRASSIÈRE'] === 'PROGES' && centreCoupe('BRASSIÈRE') === 'PROGES']);
    return out;
  });
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
