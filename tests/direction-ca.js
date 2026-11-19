#!/usr/bin/env node
// Vue direction : chiffre d'affaires de l'année par société (factures émises, avoirs déduits), encaissé, reste, en retard.
// Données inventées. Lancement (dans tests/) : npm run direction-ca
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
let echecs = 0; function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8791), b = await chromium.launch(); const W = +(process.env.LARGEUR || 1366);
  const p = await (await b.newContext({viewport:{width:W, height:900}, serviceWorkers:'block'})).newPage(); const err = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8791/index.html'); await p.waitForFunction(() => typeof renderDirection === 'function' && typeof ddChiffreAffaires === 'function');
  await p.evaluate(() => {
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}};
    const an = getTodayISO().slice(0, 4), L = (m) => [{designation:'x', qte:1, pu:m, remise:0}];
    const F = (n, d, m, pay, ech, extra) => Object.assign({type:'facture', numero:n, statut:'emise', date:an + d, echeance:ech || (an + d), clientId:'c', client:{nom:'C'}, lignes:L(m), tva:0, timbre:0, paiements:pay ? [{date:an + d, montant:pay}] : []}, extra || {});
    memoryCache['grp1_factures'] = {a:F('FA1', '-01-10', 1000, 1000), b:F('FA2', '-02-10', 500, 200, '2000-01-01'), c:F('FA3', '-03-10', 300, 0, '2999-01-01'),
      d:Object.assign(F('AV1', '-03-12', 100, 0), {type:'avoir', factureLiee:'c'}), e:Object.assign(F('B1', '-03-15', 9999, 0), {statut:'brouillon'}), f:F('OLD', '', 7777, 0)};
    memoryCache['grp1_factures'].f.date = (an - 1) + '-12-30';
    memoryCache['grp1_gadh_factures'] = {g:F('FG1', '-04-10', 200, 50, '2999-01-01')};
    const auj = getTodayISO();
    memoryCache['grp1_mgt_crm_clients'] = [{ID:'1', Societe:'A', Factures:[{number:'FA026-001', date:an + '-01-10', amount:400, paid:400, status:'Payée'}, {number:'FA026-002', date:an + '-01-12', amount:600, paid:0, status:'Impayée'}]},
      {ID:'2', Societe:'B', Factures:[{number:'FA026-003', date:auj, amount:250, paid:0, status:'Impayée'}, {number:'FA025-099', date:(an - 1) + '-11-10', amount:999, paid:0, status:'Impayée'}]}, {ID:'3', Societe:'C'}];
    activeSociete = null; activeModule = null; renderDirection();
  });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => ddChiffreAffaires('tek', getTodayISO().slice(0, 4)));
  ok(r.ca === 1700 && r.enc === 1200 && Math.abs(r.reste - 500) < 1e-6 && r.retard === 300 && r.nRet === 1 && r.n === 3, 'TEK : CA 1 700 (avoir déduit, brouillon et année passée exclus), encaissé 1 200, reste 500 (dont avoir 100 déduit), retard 300 (' + JSON.stringify(r) + ')');
  ok(Math.abs(r.enc + r.reste - r.ca) < 1e-6, 'encaissé + reste = chiffre d\'affaires');
  const t = await p.evaluate(() => { const c = document.querySelector('.dd-ca'); return c ? {titre:c.querySelector('h3').textContent, tots:[...c.querySelectorAll('.dd-ca-tots b')].map(x => x.textContent.replace(/\s/g, '')), lignes:c.querySelectorAll('.dd-ca-soc').length} : null; });
  ok(t && /Chiffre d'affaires \d{4}/.test(t.titre) && t.lignes === 3, 'bloc « Chiffre d\'affaires » dans la vue direction, un bloc par société');
  const g = await p.evaluate(() => [ddChiffreAffaires('gadh', getTodayISO().slice(0, 4)), ddChiffreAffaires('mgt', getTodayISO().slice(0, 4))]);
  ok(g[0].ca === 200 && g[0].enc === 50 && g[0].reste === 150 && g[0].n === 1, 'GADH : factures du module Facturation GADH comptées (' + JSON.stringify(g[0]) + ')');
  ok(g[1].ca === 1250 && g[1].enc === 400 && g[1].reste === 850 && g[1].retard === 600 && g[1].nRet === 1 && g[1].n === 3, 'MGT : factures du CRM (année passée exclue), impayée de plus de 30 jours en retard (' + JSON.stringify(g[1]) + ')');
  ok(t && t.tots.join('|') === '1700,00€|1200,00€|500,00€|300,00€|200,00€|50,00€|150,00€|0,00€|1250,00€|400,00€|850,00€|600,00€' && !t.tots.includes('3150,00€'), 'chaque société à part (TEK, GADH, MGT), aucun total additionné (' + (t && t.tots.join(' | ')) + ')');
  // instantané : une facture MGT payée dans le CRM → tableau à jour dès réception des données
  await p.evaluate(() => { const c = memoryCache['grp1_mgt_crm_clients']; c[0].Factures[1].paid = 600; c[0].Factures[1].status = 'Payée'; onFirebaseData(); });
  await p.waitForTimeout(800);
  const t2 = await p.evaluate(() => [...document.querySelectorAll('.dd-ca-tots b')].map(x => x.textContent.replace(/\s/g, '')));
  ok(t2[9] === '1000,00€' && t2[10] === '250,00€' && t2[11] === '0,00€' && t2[1] === '1200,00€', 'mise à jour automatique dès qu\'une facture est payée (' + t2.join(' | ') + ')');
  if (process.env.CAPTURE) await p.locator('.dd-ca').screenshot({path:process.env.CAPTURE});
  await p.locator('.dd-ca-soc').first().click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => activeSociete === 'tek' && activeModule === 'factures'), 'un bloc ouvre les factures de la société');
  const de = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(de === 0, 'pas de débordement horizontal');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
