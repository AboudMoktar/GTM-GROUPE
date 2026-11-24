#!/usr/bin/env node
// GADH (24/11/2026) : saisie simple du retour à TEK-TREND en tableau, comme la commande Excel (modèle à gauche,
// une ligne par taille, total par modèle). Mêmes règles que les cartes. Données inventées.
// Lancement (dans tests/) : node gadh-retour-tableau.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8842), b = await chromium.launch();
  for (const [W, nom] of [[1366, 'PC'], [390, 'téléphone']]){
    const p = await (await b.newContext({viewport:{width:W, height:1400}})).newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8842/suivi-commandes.html?vue=gadh'); await p.waitForFunction(() => typeof S === 'object' && typeof render === 'function');
    await p.evaluate(() => {
      const lot = 'PK209911-1'; let n = 0, i = 0;
      const L = (model, lib, sz, q) => { const l = {id:'L' + (++n), lot, year:2099, client:'NEOLYS', model, lib, size:sz, qty:q, cc:0}; S.lines.push(l); return l; };
      ['XS', 'S', 'M'].forEach((z, k) => { L('LYNE PRO-HOMME', 'LYNE PRO homme gris', z, 10 + k); L('PHARMA-FEMME', 'PHARMA_FEMME COL V ROSE', z, 20 + k); });
      S.lots[lot] = {received:'2099-11-01', ready:'2099-11-02'};
      S.lines.forEach(l => ['cp', 'gadh'].forEach(st => S.moves.push({id:'M' + (++i), date:'2099-11-10', lineId:l.id, stage:st, qty:l.qty, nc:0, note:''})));
      ui.lot = lot; ui.tab = 'flux'; ui.fmode = 'saisie'; ui.stage = 'ret'; render();
    });
    await p.waitForTimeout(200);
    const t = await p.evaluate(() => { const tb = document.querySelector('table.sxt'); if (!tb) return null;
      return {th:[...tb.tHead.rows[0].cells].map(c => c.textContent).join('|'), mod:[...tb.querySelectorAll('td.sxt-mod')].map(c => c.rowSpan + ':' + c.querySelector('b').textContent),
        ins:tb.querySelectorAll('td.sxt-in input').length, tot:[...tb.querySelectorAll('tr.sxt-tot')].map(r => r.textContent.replace(/\s+/g, '')), cartes:document.querySelectorAll('.sx-art').length,
        large:document.documentElement.scrollWidth <= innerWidth + 1}; });
    ok(t && t.th === 'Modèle|Taille|À faire|Retour|Défauts' && t.mod.length === 2 && t.mod.every(x => /^4:/.test(x)) && t.ins === 6 && t.cartes === 0, nom + ' : tableau Modèle | Taille | À faire | Retour | Défauts, modèle écrit une fois (' + JSON.stringify(t) + ')');
    ok(t && t.tot[0] === 'Total6363' && t.large, nom + ' : total par modèle, pas de débordement');
    // saisie : 5 au lieu de 10 sur la première taille, Entrée passe à la suivante, le total suit
    const r = await p.evaluate(() => { const i0 = document.querySelectorAll('table.sxt td.sxt-in input')[0]; i0.focus(); i0.value = '5'; i0.dispatchEvent(new Event('input')); i0.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      return {tot:document.querySelector('tr.sxt-tot').textContent.replace(/\s+/g, ''), focus:document.activeElement === document.querySelectorAll('table.sxt td.sxt-in input')[1], bar:document.querySelector('.sx-bartxt').textContent}; });
    ok(r.tot === 'Total6348' && r.focus && /^81/.test(r.bar), nom + ' : saisie, Entrée → taille suivante, totaux recalculés (' + JSON.stringify(r) + ')');
    await p.evaluate(() => document.querySelector('.sx-go').click()); await p.waitForTimeout(150);
    await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => /Oui, valider/.test(x.textContent)); if (b2) b2.click(); }); await p.waitForTimeout(250);
    const ret = await p.evaluate(() => S.moves.filter(m => m.stage === 'ret').reduce((s, m) => s + m.qty, 0));
    ok(ret === 81, nom + ' : validation, 81 pièces revenues enregistrées (' + ret + ')');
    ok(err.length === 0, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
    await p.context().close();
  }
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
