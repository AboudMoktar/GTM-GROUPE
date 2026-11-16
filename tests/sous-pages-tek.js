#!/usr/bin/env node
// Pages intérieures TEK-TREND dans le style des écrans d'accueil (modules-tek.css) : chaque onglet de chaque module
// garde sa colonne « GTM GROUPE », l'onglet actif en bleu électrique, le fil d'Ariane TEK-TREND / module / onglet,
// sans débordement horizontal ; GADH et le thème sombre ne changent pas. Lancement (dans tests/) : npm run sous-pages-tek
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8802), b = await chromium.launch(), r = [], err = [];
  const ouvrir = async (w, h) => { const p = await (await b.newContext({viewport: {width: w, height: h}, serviceWorkers: 'block'})).newPage();
    p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
    await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
    await p.goto('http://localhost:8802/index.html'); await p.waitForFunction(() => typeof renderShell === 'function' && typeof gtmhNomGroupe === 'function', null, {timeout: 20000});
    await p.evaluate(() => { currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; });
    return p; };
  let p = await ouvrir(1366, 768);
  const MODS = ['tek-dashboard', 'rendement', 'chaine', 'rh', 'commandes', 'factures'];
  let pages = 0, ko = [];
  for (const m of MODS) {
    await p.evaluate(m => { activeSociete = 'tek'; activeModule = m; renderShell(); }, m); await p.waitForTimeout(500);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.sidebar nav button[data-tab]')].map(x => x.getAttribute('data-tab')));
    for (const t of tabs) {
      await p.evaluate(t => nav(t), t); await p.waitForTimeout(m === 'commandes' ? 1200 : 350);
      const e = await p.evaluate(() => { const a = document.querySelector('.sidebar nav button.active'), de = document.documentElement;
        return {wm: !!document.querySelector('.sidebar .gtmh-wm') && document.querySelector('.sidebar .gtmh-wm').offsetHeight > 0,
          actif: a ? getComputedStyle(a).backgroundImage.indexOf('rgb(35, 137, 245)') >= 0 : false,
          fil: (document.getElementById('tb-titre') || {}).textContent || '', maison: !!document.querySelector('.topbar .tb-maison'),
          fond: getComputedStyle(document.body).backgroundColor, dx: de.scrollWidth - de.clientWidth,
          btn: (() => { const x = document.querySelector('main .btn-primary'); return x ? getComputedStyle(x).backgroundImage.indexOf('rgb(35, 137, 245)') >= 0 : true; })()}; });
      pages++;
      if (!(e.wm && e.actif && /^TEK-TREND/.test(e.fil) && e.maison && e.fond === 'rgb(245, 247, 251)' && e.dx === 0 && e.btn)) ko.push(m + '/' + t + ' ' + JSON.stringify(e));
    }
  }
  r.push(['TEK-TREND : ' + pages + ' onglets (6 modules) — colonne GTM GROUPE, onglet actif bleu, fil d\'Ariane, fond clair, boutons bleus, sans débordement', ko.length === 0 && pages >= 20]);
  if (ko.length) console.log(ko.join('\n'));
  // fil d'Ariane complet
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'rendement'; renderShell(); nav('historique'); }); await p.waitForTimeout(300);
  r.push(['fil d\'Ariane « TEK-TREND / Gestion Rendement / Historique »', await p.evaluate(() => [...document.querySelectorAll('#tb-titre > span:not(.tb-sep)')].map(x => x.textContent).join(' / ') === 'TEK-TREND / Gestion Rendement / Historique')]);
  // la maison ramène au choix du module, les liens du bas restent
  await p.click('.topbar .tb-maison'); await p.waitForTimeout(400);
  r.push(['la maison ramène au choix du module TEK-TREND', await p.evaluate(() => !!document.querySelector('.gtmh-mod') && activeSociete === 'tek')]);
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'rh'; renderShell(); }); await p.waitForTimeout(300);
  r.push(['« Changer de module » et « Déconnexion » toujours dans la colonne', await p.evaluate(() => /Changer de module/.test(document.querySelector('.sidebar').textContent) && !!document.querySelector('.sidebar [onclick^="logout"]'))]);
  // GADH inchangé
  await p.evaluate(() => { activeSociete = 'gadh'; activeModule = 'gadh-rh'; renderShell(); }); await p.waitForTimeout(500);
  r.push(['GADH inchangé : ni colonne GTM GROUPE, ni maison, couleur GADH', await p.evaluate(() => !document.querySelector('.sidebar .gtmh-wm') && !document.querySelector('.topbar .tb-maison') && getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase() === '#A3285D')]);
  // thème sombre TEK : couleurs sombres d'origine conservées
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'rh'; renderShell(); document.documentElement.setAttribute('data-theme', 'dark'); }); await p.waitForTimeout(300);
  r.push(['TEK thème sombre : couleurs sombres d\'origine conservées', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase() === '#4FB8C6')]);
  await p.close();
  // téléphone
  p = await ouvrir(390, 844);
  let dxMax = 0;
  for (const m of MODS) { await p.evaluate(m => { document.documentElement.setAttribute('data-theme', 'light'); activeSociete = 'tek'; activeModule = m; renderShell(); }, m); await p.waitForTimeout(m === 'commandes' ? 1200 : 400);
    dxMax = Math.max(dxMax, await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
  r.push(['téléphone : 6 modules sans débordement, barre du haut bleu nuit, onglet du bas actif en bleu', dxMax === 0 && await p.evaluate(() => getComputedStyle(document.querySelector('.topbar')).backgroundImage.indexOf('rgb(13, 46, 92)') >= 0 && getComputedStyle(document.querySelector('.bottomnav button.active')).color === 'rgb(22, 119, 232)')]);
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  const css = require('fs').readFileSync(__dirname + '/../modules-tek.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  r.push(['modules-tek.css compatible Windows 7 (ni color-mix, ni :has, ni @container)', !/color-mix\(|:has\(|@container|:is\(|:where\(/.test(css)]);
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
