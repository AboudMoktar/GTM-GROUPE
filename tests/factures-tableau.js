#!/usr/bin/env node
// Factures TEK-TREND, vue « Tableau » (23/11/2026) : comme le classeur « Facture Percko » — une ligne par facture
// de l'année (numéro, mois, date, valeur, état, reste, pièces sous-vêtement / exosquelette / brassière), totaux.
// Données inventées. Lancement (dans tests/) : node factures-tableau.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const CAPTURES = process.env.CAPTURES || '';
(async () => {
  const s = serveur.demarrer(8815), b = await chromium.launch(), r = [], err = [];
  for (const [w, h, mob] of [[1440, 900, 0], [390, 844, 1]]) {
    const p = await (await b.newContext({viewport: {width: w, height: h}, isMobile: !!mob, hasTouch: !!mob, serviceWorkers: 'block'})).newPage();
    p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
    await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
    await p.goto('http://localhost:8815/index.html'); await p.waitForFunction(() => typeof renderShell === 'function' && typeof percTarif === 'function', null, {timeout: 20000});
    await p.evaluate(() => {
      currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; activeSociete = 'tek'; activeModule = 'factures';
      const L = (ref, des, q, pu) => ({ref, designation:des, qte:q, pu, remise:0});
      const f = {
        a:{type:'facture', numero:'FA26/001', statut:'emise', date:'2026-01-09', clientId:'', client:{nom:'PERCKO'}, lignes:[L('ART001', 'PHARMA-HOMME', 100, 10), L('', 'Transport', 1, 50)], paiements:[{montant:1050, date:'2026-01-20'}], tva:0, timbre:0, devise:'EUR'},
        b:{type:'facture', numero:'FA26/002', statut:'emise', date:'2026-01-17', clientId:'', client:{nom:'PERCKO'}, lignes:[L('ART001', 'PHARMA-HOMME', 50, 10), L('', 'EXOSQUELETTE', 3, 100), L('', 'Soutien-gorge M A-B', 20, 5)], paiements:[], tva:0, timbre:0, devise:'EUR'},
        c:{type:'facture', numero:'FA26/003', statut:'emise', date:'2026-02-06', clientId:'', client:{nom:'PERCKO'}, lignes:[L('', 'Retour', 0, 0)], paiements:[], tva:0, timbre:0, devise:'EUR'},
        d:{type:'facture', numero:'FA25/040', statut:'emise', date:'2025-12-20', clientId:'', client:{nom:'PERCKO'}, lignes:[L('ART001', 'x', 1, 1)], paiements:[], tva:0, timbre:0, devise:'EUR'}};
      localStorage.setItem(CACHE_PREFIX + factCle('tek', 'factures'), JSON.stringify(f));
      try { localStorage.setItem('gtm_fact_vue', 'liste'); } catch(e) {}
      renderShell(); nav('fact-liste'); percVueSet('tableau');
    });
    await p.waitForTimeout(500);
    const t = await p.evaluate(() => ({
      th: Array.from(document.querySelectorAll('.pt-t thead th')).map(x => x.textContent),
      rows: Array.from(document.querySelectorAll('.pt-t tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim())),
      foot: Array.from(document.querySelectorAll('.pt-t tfoot td')).map(td => td.textContent.trim()),
      liste: !!document.querySelector('.fact-ligne') && document.querySelector('.fact-ligne').offsetParent !== null,
      dx: document.documentElement.scrollWidth - document.documentElement.clientWidth}));
    const tag = mob ? 'téléphone' : 'ordinateur';
    if (!mob) {
      r.push(['colonnes comme le classeur', t.th.join('|') === 'Facture N°|Mois|Date|Valeur|État|Reste|Sous-vêtement|Exosquelette|Brassière']);
      r.push(['année en cours seulement, triée par numéro', t.rows.length === 3 && t.rows[0][0] === 'FA26/001' && t.rows[2][0] === 'FA26/003']);
      r.push(['mois affiché à la première facture du mois', t.rows[0][1] === 'Janvier' && t.rows[1][1] === '' && t.rows[2][1] === 'Février']);
      r.push(['état : payé / non payé ; facture à 0 « Sans valeur »', t.rows[0][4] === 'payé' && /non payé|en retard/.test(t.rows[1][4]) && t.rows[2][3] === 'Sans valeur']);
      r.push(['pièces par famille (le transport ne compte pas)', t.rows[0][6] === '100' && t.rows[1][6] === '50' && t.rows[1][7] === '3' && t.rows[1][8] === '20']);
      r.push(['totaux en bas', t.foot[4] === '150' && t.foot[5] === '3' && t.foot[6] === '20']);
      r.push(['la liste est cachée en vue Tableau', !t.liste]);
    }
    r.push([tag + ' : aucun débordement de la page', t.dx === 0]);
    if (CAPTURES) await p.screenshot({path: CAPTURES + '/factures-tableau-' + w + '.png'});
    // retour à la liste
    await p.evaluate(() => percVueSet('liste')); await p.waitForTimeout(300);
    if (!mob) {
      const k = await p.evaluate(() => Array.from(document.querySelectorAll('.fact-kpis .kpi-mini')).map(x => x.innerText.replace(/\s+/g, ' ').trim()));
      r.push(['en-tête : total de l\'année, reste à encaisser, retards (montant et nombre), ce mois', k.length === 4 && /^1 950,00 € facturés en 2026 3 facture\(s\) · payé 1 050,00 €$/.test(k[0]) && /^901,00 € reste à encaisser 2 facture\(s\)$/.test(k[1]) && /^901,00 € en retard 2 facture\(s\)/.test(k[2])]);
    }
    if (CAPTURES) await p.screenshot({path: CAPTURES + '/factures-liste-' + w + '.png'});
    if (!mob) r.push(['retour à la vue Liste', await p.evaluate(() => !document.querySelector('.pt-t') && !!document.querySelector('.fact-ligne'))]);
    await p.close();
  }
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
