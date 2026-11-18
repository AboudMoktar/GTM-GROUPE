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
    activeSociete = null; activeModule = null; renderDirection();
  });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => ddChiffreAffaires('tek', getTodayISO().slice(0, 4)));
  ok(r.ca === 1700 && r.enc === 1200 && Math.abs(r.reste - 500) < 1e-6 && r.retard === 300 && r.nRet === 1 && r.n === 3, 'TEK : CA 1 700 (avoir déduit, brouillon et année passée exclus), encaissé 1 200, reste 500 (dont avoir 100 déduit), retard 300 (' + JSON.stringify(r) + ')');
  ok(Math.abs(r.enc + r.reste - r.ca) < 1e-6, 'encaissé + reste = chiffre d\'affaires');
  const t = await p.evaluate(() => { const c = document.querySelector('.dd-ca'); return c ? {titre:c.querySelector('h3').textContent, tots:[...c.querySelectorAll('.dd-ca-tots b')].map(x => x.textContent.replace(/\s/g, '')), lignes:c.querySelectorAll('.dd-ca-tab tbody tr').length} : null; });
  ok(t && /Chiffre d'affaires \d{4}/.test(t.titre) && t.lignes === 3, 'bloc « Chiffre d\'affaires » dans la vue direction, une ligne par société');
  ok(t && t.tots[0] === '1700,00€' && t.tots[1] === '1200,00€' && t.tots[2] === '500,00€' && t.tots[3] === '300,00€', 'totaux : CA, encaissé, reste, dont en retard (' + (t && t.tots.join(' | ')) + ')');
  if (process.env.CAPTURE) await p.locator('.dd-ca').screenshot({path:process.env.CAPTURE});
  await p.locator('.dd-ca-tab tbody tr').first().click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => activeSociete === 'tek' && activeModule === 'factures'), 'une ligne ouvre les factures de la société');
  const de = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(de === 0, 'pas de débordement horizontal');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' : ' + err[0] : ''));
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(echecs ? 1 : 0);
})();
