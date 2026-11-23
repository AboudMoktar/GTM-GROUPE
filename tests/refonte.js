#!/usr/bin/env node
// Refonte de l'interface (23/11/2026) : barre du bas limitée à 5 boutons avec « Plus », pointage RH en lignes sur
// grand écran, cadre du suivi ajusté entre les barres du téléphone, petits indicateurs lisibles, CSS compatible
// Windows 7. Présentation seule. Lancement (dans tests/) : node refonte.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js'); const fs = require('fs');
(async () => {
  const s = serveur.demarrer(8812), b = await chromium.launch(), r = [], err = [];
  const ouvrir = async (w, h, mob) => { const p = await (await b.newContext({viewport: {width: w, height: h}, isMobile: !!mob, hasTouch: !!mob, serviceWorkers: 'block'})).newPage();
    p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
    await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
    await p.goto('http://localhost:8812/index.html'); await p.waitForFunction(() => typeof renderShell === 'function', null, {timeout: 20000});
    await p.evaluate(() => { currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; });
    return p; };

  // téléphone : RH TEK-TREND (7 onglets) → 4 + « Plus »
  let p = await ouvrir(390, 844, true);
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'rh'; renderShell(); }); await p.waitForTimeout(400);
  const bas = await p.evaluate(() => Array.from(document.querySelectorAll('.bottomnav > button')).map(x => x.innerText.trim()));
  r.push(['barre du bas : 5 boutons au plus, le dernier « Plus »', bas.length === 5 && bas[4] === 'Plus']);
  const tous = await p.evaluate(() => navItems().filter(i => i.bas !== false).map(i => i.label));
  await p.click('.bottomnav .bn-plus'); await p.waitForTimeout(300);
  const feuille = await p.evaluate(() => Array.from(document.querySelectorAll('.bn-feuille .bn-f-l')).map(x => x.textContent));
  r.push(['« Plus » ouvre les autres onglets (aucun onglet perdu)', feuille.length === tous.length - 4 && feuille.every(l => tous.indexOf(l) >= 4)]);
  await p.click('.bn-feuille .bn-f'); await p.waitForTimeout(400);
  r.push(['onglet choisi ouvert, « Plus » marqué actif', await p.evaluate(() => !document.querySelector('.bn-feuille') && document.querySelector('.bottomnav .bn-plus').classList.contains('active') && activeTab === window.navBasReste[0].tab)]);
  await p.evaluate(() => nav('rh-pointage')); await p.waitForTimeout(300);
  r.push(['onglet visible : « Plus » non marqué', await p.evaluate(() => !document.querySelector('.bottomnav .bn-plus').classList.contains('active'))]);
  // GADH Gestion des commandes : son propre « Plus » est gardé tel quel
  await p.evaluate(() => { activeSociete = 'gadh'; activeModule = 'gadh-commandes'; renderShell(); }); await p.waitForTimeout(800);
  r.push(['Gestion des commandes GADH : barre inchangée (Accueil, Clients, Fournisseurs, Stock, Plus)', await p.evaluate(() => Array.from(document.querySelectorAll('.bottomnav > button')).map(x => x.innerText.trim()).join('|')) === 'Accueil|Clients|Fournisseurs|Stock|Plus']);
  // suivi des commandes : le cadre tient entre la barre du haut et la barre du bas
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'commandes'; renderShell(); }); await p.waitForTimeout(1500);
  const g = await p.evaluate(() => { const f = document.querySelector('.suivi-frame').getBoundingClientRect(), t = document.querySelector('.topbar').getBoundingClientRect(), n = document.querySelector('.bottomnav').getBoundingClientRect(); return {haut: Math.round(f.top - t.bottom), bas: Math.round(n.top - f.bottom), dx: document.documentElement.scrollWidth - document.documentElement.clientWidth}; });
  r.push(['téléphone : suivi entre les deux barres, sans recouvrement ni débordement', Math.abs(g.haut) <= 2 && Math.abs(g.bas) <= 2 && g.dx === 0]);
  // onglets du suivi : noms complets
  const fr = p.frame({url: /suivi-commandes/});
  await fr.waitForSelector('#tabs button');
  const coupes = await fr.evaluate(() => Array.from(document.querySelectorAll('#tabs button span')).filter(x => x.scrollWidth > x.clientWidth + 1).length);
  r.push(['onglets du suivi : noms complets (défilement latéral)', coupes === 0]);
  // petits indicateurs RH : texte d'au moins 11 px
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'rh'; renderShell(); nav('rh-dashboard'); }); await p.waitForTimeout(500);
  const mini = await p.evaluate(() => Array.from(document.querySelectorAll('.kpi-mini-lbl')).map(x => parseFloat(getComputedStyle(x).fontSize)));
  r.push(['indicateurs RH : libellés d\'au moins 11 px', mini.length > 0 && Math.min.apply(null, mini) >= 11]);
  await p.close();

  // grand écran : pointage en lignes, en-tête collant
  p = await ouvrir(1440, 900);
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'rh'; renderShell();
    const e = {}; for (let i = 0; i < 6; i++) e['t' + i] = {nom:'Salarié ' + i, poste:'Opératrice'}; localStorage.setItem(CACHE_PREFIX + 'employees', JSON.stringify(e));
    nav('rh-pointage'); }); await p.waitForTimeout(600);
  const pt = await p.evaluate(() => { const c = Array.from(document.querySelectorAll('.ptg-carte')), m = document.querySelector('.ptg-liste');
    return {n: c.length, grille: c.length ? getComputedStyle(c[0]).display : '', pleine: c.every(x => Math.abs(x.getBoundingClientRect().width - m.getBoundingClientRect().width) < 2), haute: c.length ? Math.round(c[0].getBoundingClientRect().height) : 0,
      colle: getComputedStyle(document.querySelector('.ptg-entete')).position}; });
  r.push(['pointage (1440 px) : une ligne par salarié, pleine largeur, en-tête collant', pt.n > 0 && pt.grille === 'grid' && pt.pleine && pt.haute < 90 && pt.colle === 'sticky']);
  r.push(['grand écran : aucun débordement horizontal', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0]);
  // saisie du rendement : Entrée descend d'une case, horaires fixes à gauche
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'rendement'; saisieDate = '2026-11-23'; renderShell(); nav('saisie'); }); await p.waitForTimeout(600);
  const sg = await p.evaluate(() => { const ins = document.querySelectorAll('.saisie-grille tbody tr:nth-child(1) td.input-cell input, .saisie-grille tbody tr:nth-child(2) td.input-cell input');
    const t = document.querySelector('.saisie-grille tbody tr:first-child td:first-child'); return {n: ins.length, colle: t ? getComputedStyle(t).position : '', dis: ins.length ? ins[0].disabled : true}; });
  if (sg.n) {
    const a1 = '.saisie-grille tbody tr:nth-child(1) td:nth-child(2) input';
    await p.focus(a1); await p.keyboard.press('Enter');
    const desc = await p.evaluate(() => { const a = document.activeElement; return a && a.closest('tr') === document.querySelector('.saisie-grille tbody tr:nth-child(2)') && a.closest('td') === document.querySelector('.saisie-grille tbody tr:nth-child(2) td:nth-child(2)'); });
    r.push(['saisie du rendement : Entrée passe à la case du dessous, horaires fixes à gauche', sg.dis || (desc && sg.colle === 'sticky')]);
  } else r.push(['saisie du rendement : grille affichée', false]);
  // factures : nombre de factures sur chaque filtre
  await p.evaluate(() => { activeSociete = 'tek'; activeModule = 'factures'; renderShell(); const l = factToutes('tek'); l.t1 = {type:'facture', numero:'FA26/900', statut:'emise', date:'2026-01-02', echeance:'2026-01-10', clientId:'', client:{nom:'Client test'}, lignes:[{designation:'x', qte:1, pu:10}], paiements:[], tva:0, timbre:0}; localStorage.setItem(CACHE_PREFIX + factCle('tek', 'factures'), JSON.stringify(l)); factFiltre = 'tous'; nav('fact-liste'); }); await p.waitForTimeout(500);
  const ff = await p.evaluate(() => ({chips: Array.from(document.querySelectorAll('.fact-filtres .fact-chip')).map(b => b.textContent.trim()), dx: document.documentElement.scrollWidth - document.documentElement.clientWidth, ligne: !!document.querySelector('.fact-ligne[data-st="retard"]')}));
  r.push(['factures : nombre de factures sur les filtres, ligne en retard repérée, pas de débordement', ff.chips.some(c => /^Toutes\s*\d+$/.test(c)) && ff.chips.some(c => /^En retard\s*1$/.test(c)) && ff.ligne && ff.dx === 0]);
  await p.close();

  for (const f of ['refonte.css', 'suivi-refonte.css']) {
    const css = fs.readFileSync(__dirname + '/../' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    r.push([f + ' compatible Windows 7 (ni color-mix, ni :has, ni :is / :where, ni @container)', !/color-mix\(|:has\(|@container|:is\(|:where\(/.test(css)]);
  }
  const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');
  r.push(['hors ligne : les deux feuilles de style sont dans le cache de l\'application', /'\.\/refonte\.css'/.test(sw) && /'\.\/suivi-refonte\.css'/.test(sw)]);
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
