#!/usr/bin/env node
// Pages intérieures TEK-TREND, GADH et MGT dans le style des écrans d'accueil (modules-charte.css) : chaque onglet de chaque module
// garde sa colonne « GTM GROUPE », l'onglet actif en bleu électrique, le fil d'Ariane TEK-TREND / module / onglet,
// sans débordement horizontal ; le thème sombre ne change pas. Lancement (dans tests/) : npm run sous-pages
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
  const LISTE = MODS.map(m => ['tek', m]).concat(['gadh-tableau', 'gadh', 'gadh-rh', 'gadh-commandes', 'machines', 'factures'].map(m => ['gadh', m]));
  let pages = 0, ko = [];
  for (const [soc, m] of LISTE) {
    await p.evaluate(([soc, m]) => { activeSociete = soc; activeModule = m; renderShell(); }, [soc, m]); await p.waitForTimeout(500);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.sidebar nav button[data-tab]')].map(x => x.getAttribute('data-tab')));
    for (const t of tabs) {
      await p.evaluate(t => nav(t), t); await p.waitForTimeout(m === 'commandes' || (soc === 'gadh' && t === 'commandes-home') ? 1200 : 350);
      const e = await p.evaluate(() => { const a = document.querySelector('.sidebar nav button.active'), de = document.documentElement;
        return {wm: !!document.querySelector('.sidebar .gtmh-wm') && document.querySelector('.sidebar .gtmh-wm').offsetHeight > 0,
          actif: a ? getComputedStyle(a).backgroundImage.indexOf('rgb(35, 137, 245)') >= 0 : false,
          fil: (document.getElementById('tb-titre') || {}).textContent || '', maison: !!document.querySelector('.topbar .tb-maison'),
          fond: getComputedStyle(document.body).backgroundColor, photo: document.body.classList.contains('fond-tek') && /fond-tek\.jpg/.test(getComputedStyle(document.querySelector('.app-body'), '::before').backgroundImage), dx: de.scrollWidth - de.clientWidth,
          btn: (() => { const x = document.querySelector('main .btn-primary'); return x ? getComputedStyle(x).backgroundImage.indexOf('rgb(35, 137, 245)') >= 0 : true; })()}; });
      pages++;
      if (!(e.wm && e.actif && (soc === 'tek' ? /^TEK-TREND/ : /^GADH TUNISIA/).test(e.fil) && e.maison && (soc === 'tek' ? e.photo : e.fond === 'rgb(245, 247, 251)') && e.dx === 0 && e.btn)) ko.push(soc + '/' + m + '/' + t + ' ' + JSON.stringify(e));
    }
  }
  r.push(['TEK-TREND + GADH : ' + pages + ' onglets (12 modules) — colonne GTM GROUPE, onglet actif bleu, fil d\'Ariane, fond clair (photo de l\'atelier pour TEK-TREND), boutons bleus, sans débordement', ko.length === 0 && pages >= 45]);
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
  r.push(['GADH : colonne GTM GROUPE, maison, bleu électrique, fil « GADH TUNISIA / Ressources humaines / … »', await p.evaluate(() => !!document.querySelector('.sidebar .gtmh-wm') && !!document.querySelector('.topbar .tb-maison') && getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase() === '#1677E8' && /^GADH TUNISIA \/ Ressources humaines \//.test([...document.querySelectorAll('#tb-titre > span:not(.tb-sep)')].map(x => x.textContent).join(' / ')))]);
  // thème sombre TEK : couleurs sombres d'origine conservées
  // thème sombre (GADH ; TEK-TREND garde volontairement le thème clair de l'application d'origine)
  await p.evaluate(() => { localStorage.setItem('gtm_theme', 'dark'); activeSociete = 'gadh'; activeModule = 'gadh-rh'; renderShell(); themeAppliquer('dark'); }); await p.waitForTimeout(300);
  r.push(['thème sombre : couleurs sombres d\'origine conservées (pas de bleu électrique ni de fond clair)', await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark' && getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase() !== '#1677E8' && getComputedStyle(document.body).backgroundColor !== 'rgb(245, 247, 251)')]);
  await p.evaluate(() => { localStorage.setItem('gtm_theme', 'light'); themeAppliquer('light'); });
  await p.close();
  // téléphone
  p = await ouvrir(390, 844);
  let dxMax = 0;
  for (const m of MODS) { await p.evaluate(m => { document.documentElement.setAttribute('data-theme', 'light'); activeSociete = 'tek'; activeModule = m; renderShell(); }, m); await p.waitForTimeout(m === 'commandes' ? 1200 : 400);
    dxMax = Math.max(dxMax, await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
  r.push(['téléphone : 6 modules sans débordement, barre du haut bleu nuit, onglet du bas actif en bleu', dxMax === 0 && await p.evaluate(() => getComputedStyle(document.querySelector('.topbar')).backgroundImage.indexOf('rgb(13, 46, 92)') >= 0 && getComputedStyle(document.querySelector('.bottomnav button.active')).color === 'rgb(22, 119, 232)')]);
  await p.close();
  // MGT : application CRM aux couleurs GTM GROUPE (thème clair par défaut, bleu électrique, plus d'orange hors logo)
  p = await (await b.newContext({viewport: {width: 1366, height: 768}, serviceWorkers: 'block'})).newPage();
  p.on('pageerror', e => err.push('MGT ' + e.message));
  await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
  await p.goto('http://localhost:8802/mgt-crm-app.html'); await p.waitForTimeout(2500);
  const orange = () => p.evaluate(() => { const o = []; const est = v => (v.match(/rgba?\(\d+, \d+, \d+/g) || []).some(x => { const [r, g, b] = x.match(/\d+/g).map(Number); return r > 200 && g > 60 && g < 150 && b < 110; });
    for (const el of document.querySelectorAll('body *')) { if (!el.offsetWidth || el.tagName === 'IMG' || /relance/.test(String(el.className))) continue; /* « Relances » : couleur de catégorie du calendrier (orange voulu) */ const cs = getComputedStyle(el);
      for (const pr of ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor']) if (est(cs[pr])) o.push((el.id || el.className || el.tagName) + ':' + pr); }
    return o; });
  const sections = await p.evaluate(() => document.querySelectorAll('#mgtHomeDashboard .mgtHomeCard').length);
  let oranges = await orange();
  for (let i = 0; i < sections; i++) {
    await p.evaluate(i => document.querySelectorAll('#mgtHomeDashboard .mgtHomeCard')[i].click(), i); await p.waitForTimeout(700);
    oranges = oranges.concat(await orange());
    await p.evaluate(() => { const h = document.querySelector('.mgtBackHomeBtn'); if (h) h.click(); }); await p.waitForTimeout(400);
  }
  r.push(['MGT : thème clair par défaut, bleu électrique, ' + sections + ' rubriques ouvertes sans orange (hors logo)', sections >= 8 && oranges.length === 0
    && await p.evaluate(() => document.documentElement.getAttribute('data-mgt-theme') === 'light' && getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase() === '#1677E8')]);
  if (oranges.length) console.log([...new Set(oranges)].slice(0, 10));
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  const css = require('fs').readFileSync(__dirname + '/../modules-charte.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  r.push(['modules-charte.css compatible Windows 7 (ni color-mix, ni :has, ni @container)', !/color-mix\(|:has\(|@container|:is\(|:where\(/.test(css)]);
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
