#!/usr/bin/env node
// Suivi PERCKO (24/11/2026) : Flux s'ouvre sur le tableau de la commande, le même que Suivi → Pilotage, au format
// de la commande Excel (Model | LIBELLE en couleur | Taille…). Passage d'étape et correction à n'importe quelle
// étape en tapant le bon total, puis Valider. Données d'essai.
// Lancement (dans tests/) : node flux-tableau.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8846), b = await chromium.launch(), p = await b.newPage({viewport:{width:1366, height:1000}}); const err = []; p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8846/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof render === 'function' && typeof vPilotage === 'function');
  await p.evaluate(() => {
    try { localStorage.removeItem('pk_fmode3'); } catch (e) {}
    const lot = 'PKF-1'; let n = 0, i = 0;
    ['XS', 'S', 'M'].forEach((z, k) => { const l = {id:'L' + (++n), lot, year:2099, client:'NEOLYS', model:'LYNE PRO-HOMME', lib:'LYNE PRO homme noir', size:z, qty:100, cc:0}; S.lines.push(l);
      ['cp', 'gadh', 'asm', 'ret', 'ctl'].forEach(st => S.moves.push({id:'M' + (++i), date:'2099-11-10', lineId:l.id, stage:st, qty:80, nc:0, note:''})); });
    S.lots[lot] = {received:'2099-11-01', ready:'2099-11-02'};
    ui.lot = lot; ui.tab = 'flux'; ui.fmode = null; render();
  });
  await p.waitForTimeout(250);
  const t = await p.evaluate(() => { const th = [...document.querySelectorAll('.ph-t thead th')].map(x => x.textContent.trim()); const lib = document.querySelector('.ph-t td.lib');
    return {onglet:(document.querySelector('.dp-onglets button.on') || {}).textContent, th:th.slice(1, 4).join('|'), couleur:lib ? getComputedStyle(lib).backgroundColor : '', coul:th.indexOf('Couleur')}; });
  ok(/Tableau de la commande/.test(t.onglet) && t.th === 'Model|LIBELLE|Taille' && t.coul < 0 && t.couleur === 'rgb(89, 89, 89)', 'Flux s\'ouvre sur le tableau de la commande : Model | LIBELLE (en couleur) | Taille, sans colonne Couleur (' + JSON.stringify(t) + ')');
  // passage : 10 pièces emballées sur XS ; correction : contrôle S ramené de 80 à 75
  const saisir = async (taille, colonne, v) => p.evaluate(([taille, colonne, v]) => {
    const tr = [...document.querySelectorAll('.ph-t tbody tr')].find(r => [...r.cells].some(c => c.textContent.trim() === taille && c.style.fontWeight === '800'));
    const ths = [...document.querySelectorAll('.ph-t thead th')].map(x => x.textContent.trim()), idx = ths.indexOf(colonne);
    const cells = []; let c = 0; [...tr.cells].forEach(td => { cells[c] = td; c += td.colSpan || 1; });
    const decal = ths.length - [...tr.cells].reduce((n, td) => n + (td.colSpan || 1), 0);   /* Model fusionné (rowspan) */
    const inp = cells[idx - decal].querySelector('input'); inp.focus(); inp.value = String(v); inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); inp.blur(); inp.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  }, [taille, colonne, v]);
  await saisir('XS', 'Emballée', 10); await saisir('S', 'Contrôlée', 75); await p.waitForTimeout(200);
  const att = await p.evaluate(() => (document.querySelector('.ph-attente') || {}).textContent || '');
  ok(/2 modification\(s\) en attente/.test(att), 'deux saisies en attente avant validation (' + att.slice(0, 60) + ')');
  await p.evaluate(() => [...document.querySelectorAll('.ph-attente button')].find(x => /Valider/.test(x.textContent)).click()); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Confirmer et enregistrer/.test(x.textContent)).click()); await p.waitForTimeout(300);
  const tot = await p.evaluate(() => { const T = stageTotals(); return {embXS:T.L1.emb || 0, ctlS:T.L2.ctl || 0}; });
  ok(tot.embXS === 10 && tot.ctlS === 75, 'passage (10 emballées) et correction (contrôle 80 → 75) enregistrés (' + JSON.stringify(tot) + ')');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
