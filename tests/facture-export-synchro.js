#!/usr/bin/env node
// Facture d'export préparée en brouillon AVANT l'expédition : remise à jour sur les cartons actuels de l'export
// (quantités ajoutées après coup), lignes ajoutées à la main conservées, prix modifié conservé ; LYNE FLEX ≠ LYNE PRO.
// Quantités et prix inventés.
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8791), b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:1366, height:768}, serviceWorkers:'block'}); const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8791/index.html'); await p.waitForFunction(() => typeof percFacturerExport === 'function' && typeof percSynchroFactureExport === 'function');
  const R = await p.evaluate(() => { hlEcritureAutorisee = () => true;
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}};
    memoryCache['grp1_fact_params'] = {valeurPiece:2, valeurExo:7, tarifExport:percTarif().map((a, i) => ({code:a.code, prix:10 + i}))};
    memoryCache['grp1_fact_clients'] = {defaut:{nom:'PERCKO'}}; activeSociete = 'tek';
    const P = (lib, size, qte) => ({model:'', lib, size, client:'NEOLYS', qte});
    const o = {};
    const fam = l => { const a = percTarif().find(t => t.code === l.ref); return a ? a.fam : '?'; };
    const L1 = percLignesExport([P('LYNE FLEX homme gris', 'S', 5), P('LYNE PRO homme gris', 'L', 3), P('LYNE FLEX femme gris', 'XS', 2)]).lignes;
    o.flex = L1.map(l => fam(l) + ':' + l.qte).sort().join(',');
    const x1 = {exportId:'E9', n:9, d:'2026-11-21', nat:'NEOLYS', colis:2, poidsBrut:20, pieces:[P('PHARMA_HOMME COL V GRIS', 'S', 100), P('PHARMA_HOMME COL V GRIS', 'L', 50)]};
    const r = percFacturerExport(x1); o.ok = r.ok;
    const l = factToutes('tek'), f = l[r.id];
    f.lignes[0].pu = 99; f.lignes.push({designation:'Frais Bancaire', qte:1, pu:45, remise:0}); factEnregistrer('tek', l);
    // l'export continue : cartons ajoutés
    const x2 = Object.assign({}, x1, {colis:3, poidsBrut:31, pieces:[P('PHARMA_HOMME COL V GRIS', 'S', 105), P('PHARMA_HOMME COL V GRIS', 'L', 50), P('LYNE FLEX homme gris', 'M', 2)]});
    const ap = percFactureDunExport(x2); o.apercu = ap.f.lignes.map(l => l.qte).join(',');
    o.stockeAvant = factToutes('tek')[r.id].lignes.map(l => l.qte).join(',');
    const r2 = percFacturerExport(x2); o.existe = !!r2.existe;
    const g = factToutes('tek')[r.id];
    o.apres = g.lignes.map(l => (l.ref || '-') + ':' + l.qte + ':' + l.pu).join(',');
    o.percko = g.percko.colis + '|' + g.percko.poidsBrut + '|' + g.percko.valeurMatiere;
    o.total = factTotaux(g).ht;
    // facture émise : jamais modifiée
    g.statut = 'emise'; const l2 = factToutes('tek'); l2[r.id] = g; factEnregistrer('tek', l2);
    percFacturerExport(Object.assign({}, x2, {pieces:[P('PHARMA_HOMME COL V GRIS', 'S', 1)]}));
    o.emise = factToutes('tek')[r.id].lignes[0].qte;
    return o; });
  ok(R.flex === 'flex:2,flex:5,pro:3', 'LYNE FLEX facturé en Flex (pas en Pro) : ' + R.flex);
  ok(R.ok, 'brouillon créé depuis l\'export en cours');
  ok(R.apercu === '105,50,2,1' && R.stockeAvant === '100,50,1', 'Documents : aperçu à jour des cartons actuels sans rien enregistrer (' + R.apercu + ' / ' + R.stockeAvant + ')');
  ok(R.existe, 'facture existante proposée (pas de doublon)');
  ok(/^ART001:105:99,ART002:50:\d+,ART023:2:\d+,ART0002:1:45$/.test(R.apres), 'brouillon remis à jour : quantités actuelles, prix modifié gardé, Flex ajouté, frais gardés avec leur article ART0002 (' + R.apres + ')');
  ok(R.percko === '3|31|314', 'colis, poids et valeur matière recalculés (' + R.percko + ')');
  ok(R.emise === 105, 'facture émise jamais modifiée');
  // création automatique + article choisi à la main gardé
  await p.evaluate(() => { activeModule = 'factures'; renderShell(); nav('fact-liste'); });
  const A = await p.evaluate(() => { const P = (lib, size, qte) => ({model:'', lib, size, client:'NEOLYS', qte});
    const x = {exportId:'E10', n:10, d:'2026-11-25', nat:'NEOLYS', colis:1, poidsBrut:5, pieces:[P('PHARMA_HOMME COL V GRIS', 'S', 10), P('Inconnu bleu', 'M', 3)]};
    const n0 = percSynchroFactureExport(x, false), n1 = percSynchroFactureExport(x, true);
    const d = percFactureDeLExport('E10'); if(d.length !== 1) return 'pas créée ' + d.length;
    factId = d[0].id; const i = d[0].f.lignes.findIndex(l => /Inconnu/.test(l.designation)); factMajRef(i, 'art013');
    percSynchroFactureExport(Object.assign({}, x, {pieces:[P('PHARMA_HOMME COL V GRIS', 'S', 12), P('Inconnu bleu', 'M', 4)]}), true);
    const f = factToutes('tek')[d[0].id]; return [n0, n1, percFactureDeLExport('E10').length, f.statut, f.lignes.map(l => l.ref + ':' + l.qte + ':' + l.pu).join(',')].join('|'); });
  ok(/^0\|1\|1\|brouillon\|ART001:12:\d+,ART013:4:\d+$/.test(A) && !/ART013:4:0/.test(A), 'export en cours sans facture : brouillon créé tout seul ; article choisi à la main (ART013, prix rempli) gardé après synchro (' + A + ')');
  // écran : champ « Article » sur chaque ligne
  await p.evaluate(() => nav('fact-edit'));
  ok(await p.evaluate(() => document.querySelectorAll('.mgt-ligne input[data-ref]').length === factToutes('tek')[factId].lignes.length && !!document.querySelector('#fact-articles option[value="ART0002"]')), 'chaque ligne montre son article (liste ART001… / ART0002)');
  const pn = await p.evaluate(() => { const f = {numero:'FA26/099', date:'2026-11-20', statut:'brouillon', type:'facture', lignes:[{designation:'X', qte:1, pu:1}], client:{nom:'PERCKO'},
      percko:{destination:'NEOLYS', colis:100, poidsBrut:1250.5, poidsNet:'', valeurMatiere:'', composition:''}};
    const h = percFactureModeleHtml(f, false); return [percPoidsNet(f.percko), /Poids Brut: 1250.5 KG/.test(h), /Poids Net: 1150.5 KG/.test(h), /::/.test(h.replace(/https?:\/\//g, ''))].join('|'); });
  ok(pn === '1150.5|true|true|false', 'poids net = poids brut − nombre de cartons, imprimé ; « Poids Brut: » sans « :: » (' + pn + ')');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close(); console.log(echecs ? echecs + ' échec(s)' : 'aucune erreur'); process.exit(echecs ? 1 : 0);
})();
