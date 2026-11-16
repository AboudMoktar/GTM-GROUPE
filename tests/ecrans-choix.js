#!/usr/bin/env node
// Écrans d'accueil (société, module) — charte « Industrial Corporate Premium » (accueil.css).
// Vérifie : les trois logos officiels entiers et non déformés, les six modules TEK-TREND, la colonne de navigation,
// les droits (Vue direction / Administration / Changer de société masqués pour un compte simple), les actions inchangées,
// l'absence de défilement sur ordinateur et l'empilement sur téléphone. Lancement (dans tests/) : npm run ecrans-choix
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const ADMIN = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}};
(async () => {
  const s = serveur.demarrer(8801), b = await chromium.launch(); const r = [];
  const ouvrir = async (w, h) => { const p = await (await b.newContext({viewport: {width: w, height: h}, serviceWorkers: 'block'})).newPage();
    await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
    await p.goto('http://localhost:8801/index.html'); await p.waitForFunction(() => typeof renderModuleSelect === 'function' && typeof renderSocieteSelect === 'function' && typeof ouvrirAdmin === 'function', null, {timeout: 20000});
    return p; };
  const deborde = p => p.evaluate(() => { const de = document.documentElement; return {dx: de.scrollWidth - de.clientWidth, dy: de.scrollHeight - de.clientHeight}; });
  const logos = p => p.evaluate(async () => { const out = [];
    for (const im of document.querySelectorAll('.gtmh-centre .gtmh-logo img')) { if (!im.complete) await new Promise(f => { im.onload = im.onerror = f; });
      const rc = im.getBoundingClientRect(), cs = getComputedStyle(im), par = im.parentElement.getBoundingClientRect();
      out.push({src: im.getAttribute('src'), ok: im.naturalWidth > 0, ecart: Math.abs(rc.width / rc.height - im.naturalWidth / im.naturalHeight), fit: cs.objectFit, filtre: cs.filter, opacite: cs.opacity,
        dedans: rc.left >= par.left - 1 && rc.right <= par.right + 1 && rc.top >= par.top - 1 && rc.bottom <= par.bottom + 1, h: Math.round(rc.height)}); }
    return out; });
  const logosIntacts = l => l.every(x => x.ok && x.ecart < 0.02 && x.fit === 'contain' && x.filtre === 'none' && x.opacite === '1' && x.dedans);

  // ---------- Ordinateur 1366 × 768 : écran des sociétés ----------
  let p = await ouvrir(1366, 768);
  await p.evaluate(u => { currentUser = u; renderSocieteSelect(); }, ADMIN); await p.waitForTimeout(400);
  let l = await logos(p);
  r.push(['société : les trois logos officiels du projet (fichiers d\'origine)', l.map(x => x.src).join() === './logo-tek.png,./logo-gadh.png,./logo-mgt.png']);
  r.push(['société : logos entiers, proportions d\'origine, ni filtre ni recadrage', logosIntacts(l) && l.every(x => x.h >= 90)]);
  r.push(['société : trois grandes cartes côte à côte (nom ≥ 20 px, activité affichée)', await p.evaluate(() => { const c = [...document.querySelectorAll('.gtmh-soc-carte')];
    return c.length === 3 && new Set(c.map(x => Math.round(x.getBoundingClientRect().top))).size === 1 && c.every(x => x.getBoundingClientRect().height >= 250 && parseFloat(getComputedStyle(x.querySelector('.gtmh-nom')).fontSize) >= 20 && x.querySelector('.gtmh-sous').textContent.trim().length > 5); })]);
  r.push(['société : titre et utilisateur connecté', await p.evaluate(() => /Quelle société voulez-vous ouvrir/.test(document.querySelector('.gtmh h1').textContent) && /Administrateur/.test(document.querySelector('.gtmh-qui').textContent) && /Administrateur/.test(document.querySelector('.gtmh-user').textContent))]);
  r.push(['société : « Vue direction », « Administration » (une seule fois) et « Déconnexion » présents', await p.evaluate(() => { const t = [...document.querySelectorAll('.gtmh-tuile')].map(x => x.querySelector('.gtmh-nom').textContent);
    return t.join() === 'Vue direction,Administration' && document.querySelectorAll('.gtmh [onclick="logout()"]').length >= 1; })]);
  let d = await deborde(p);
  r.push(['société : tient sur 1366 × 768 sans défilement', d.dx === 0 && d.dy === 0]);
  r.push(['palette de la charte (bleu nuit, bleu électrique, fond, cartes blanches)', await p.evaluate(() => { const c = e => getComputedStyle(document.querySelector(e));
    return c('.gtmh-cote').backgroundColor === 'rgb(11, 31, 58)' && c('.gtmh').backgroundColor === 'rgb(245, 247, 251)' && c('.gtmh-soc-carte').backgroundColor === 'rgb(255, 255, 255)' && c('.gtmh-tuile.fort .gtmh-aller').backgroundColor === 'rgb(22, 119, 232)'; })]);
  // les trois accès société
  for (const k of ['tek', 'gadh', 'mgt']) {
    await p.evaluate(u => { currentUser = u; activeSociete = null; activeModule = null; renderSocieteSelect(); }, ADMIN);
    await p.click('.gtmh-soc-carte[data-soc="' + k + '"]'); await p.waitForTimeout(500);
    r.push(['accès société ' + k + ' : la carte ouvre la société', await p.evaluate(k => activeSociete === k && !document.querySelector('.gtmh-soc'), k)]);
  }
  // ---------- écran des modules TEK-TREND ----------
  await p.evaluate(u => { currentUser = u; activeSociete = 'tek'; activeModule = null; renderModuleSelect(); }, ADMIN); await p.waitForTimeout(400);
  r.push(['modules TEK-TREND : exactement les six modules, dans l\'ordre', await p.evaluate(() => [...document.querySelectorAll('.gtmh-mod-carte .gtmh-nom')].map(x => x.textContent).join('|') === 'Tableau de bord|Gestion Rendement|Suivi chaîne|Gestion Ressources Humaines|Suivi des Commandes|Facturation')]);
  r.push(['modules : cartes sur 3 colonnes avec icône, description et flèche', await p.evaluate(() => { const t = [...document.querySelectorAll('.gtmh-mod-carte')];
    return new Set(t.map(x => Math.round(x.getBoundingClientRect().left))).size === 3 && t.every(x => x.querySelector('.gtmh-mod-ico svg, .gtmh-mod-ico img') && x.querySelector('.gtmh-sous').textContent.trim() && x.querySelector('.gtmh-aller svg') && x.getBoundingClientRect().height >= 100 && parseFloat(getComputedStyle(x.querySelector('.gtmh-sous')).fontSize) >= 13); })]);
  l = await logos(p);
  r.push(['modules : logo officiel de la société, entier et non déformé', l.length === 1 && l[0].src === './logo-tek.png' && logosIntacts(l)]);
  r.push(['colonne de navigation : sociétés (active repérée), Vue direction, Administration, Changer de société, Déconnexion', await p.evaluate(() => { const t = [...document.querySelectorAll('.gtmh-cote .gtmh-lien')].map(x => x.textContent.trim());
    return t.join('|') === 'TEK-TREND|GADH TUNISIA|MGT|Vue direction|Administration|Changer de société|Déconnexion' && document.querySelector('.gtmh-cote .gtmh-lien.actif').textContent.trim() === 'TEK-TREND'; })]);
  d = await deborde(p);
  r.push(['modules : tient sur 1366 × 768 sans défilement', d.dx === 0 && d.dy === 0]);
  // les six modules s'ouvrent
  for (const m of ['tek-dashboard', 'rendement', 'chaine', 'rh', 'commandes', 'factures']) {
    await p.evaluate(u => { currentUser = u; activeSociete = 'tek'; activeModule = null; renderModuleSelect(); }, ADMIN);
    await p.click('.gtmh-mod-carte[data-module="' + m + '"]'); await p.waitForTimeout(400);
    r.push(['module ' + m + ' : la carte ouvre le module', await p.evaluate(m => activeModule === m && !document.querySelector('.gtmh-mod'), m)]);
  }
  // navigations de la colonne
  await p.evaluate(u => { currentUser = u; activeSociete = 'tek'; activeModule = null; renderModuleSelect(); }, ADMIN);
  await p.click('.gtmh-cote .gtmh-lien:has-text("GADH TUNISIA")'); await p.waitForTimeout(400);
  r.push(['colonne : changer de société directement (GADH, 6 modules)', await p.evaluate(() => activeSociete === 'gadh' && document.querySelectorAll('.gtmh-mod-carte').length === 6 && document.querySelector('.gtmh-lien.actif').textContent.trim() === 'GADH TUNISIA')]);
  d = await deborde(p); r.push(['modules GADH : tient sur 1366 × 768', d.dx === 0 && d.dy === 0]);
  await p.click('.gtmh-cote .gtmh-lien:has-text("Changer de société")'); await p.waitForTimeout(400);
  r.push(['« Changer de société » revient à l\'écran des sociétés', await p.locator('.gtmh-soc .gtmh-soc-carte').count() === 3]);
  await p.click('.gtmh-tuile:has-text("Vue direction")'); await p.waitForTimeout(500);
  r.push(['« Vue direction » ouvre la vue direction', await p.evaluate(() => !document.querySelector('.gtmh') && activeSociete === null)]);
  await p.evaluate(u => { currentUser = u; renderSocieteSelect(); }, ADMIN);
  await p.click('.gtmh-tuile:has-text("Administration")'); await p.waitForTimeout(500);
  r.push(['« Administration » ouvre l\'administration', await p.evaluate(() => !document.querySelector('.gtmh'))]);

  // ---------- Droits : compte simple (deux sociétés, pas direction) puis une seule société ----------
  await p.evaluate(() => { currentUser = {username:'u1', nom:'Utilisatrice', role:'saisie', groupe:false, societes:{tek:true, gadh:true}}; activeSociete = null; activeModule = null; renderSocieteSelect(); }); await p.waitForTimeout(300);
  r.push(['droits : compte simple → ses 2 sociétés seulement, ni Vue direction ni Administration', await p.evaluate(() => document.querySelectorAll('.gtmh-soc-carte').length === 2 && !document.querySelector('.gtmh-soc-carte[data-soc="mgt"]') && document.querySelectorAll('.gtmh-tuile').length === 0 && !/Vue direction|Administration/.test(document.querySelector('.gtmh').textContent))]);
  await p.evaluate(() => { activeSociete = 'tek'; renderModuleSelect(); }); await p.waitForTimeout(300);
  r.push(['droits : modules affichés = modules autorisés (modulesDeSociete), colonne sans Vue direction ni Administration', await p.evaluate(() => { const aff = [...document.querySelectorAll('.gtmh-mod-carte')].map(x => x.getAttribute('data-module')), dr = modulesDeSociete('tek');
    return aff.length > 0 && aff.every(m => dr.indexOf(m) >= 0) && aff.length === dr.filter(m => ['tek-dashboard','rendement','chaine','rh','commandes','factures'].indexOf(m) >= 0).length && [...document.querySelectorAll('.gtmh-cote .gtmh-lien')].map(x => x.textContent.trim()).join('|') === 'TEK-TREND|GADH TUNISIA|Changer de société|Déconnexion'; })]);
  await p.evaluate(() => { currentUser = {username:'u2', nom:'Ouvrière', role:'saisie', groupe:false, societes:{tek:true}}; activeSociete = 'tek'; renderModuleSelect(); }); await p.waitForTimeout(300);
  r.push(['droits : une seule société → pas de « Changer de société »', await p.evaluate(() => !/Changer de société/.test(document.querySelector('.gtmh').textContent) && document.querySelectorAll('.gtmh [onclick="switchSociete()"]').length === 0 && document.querySelectorAll('.gtmh [onclick="logout()"]').length >= 1)]);
  await p.close();

  // ---------- Autres résolutions ----------
  for (const [w, h] of [[1280, 720], [1280, 1024], [1920, 1080], [2560, 1440], [1024, 768]]) {
    p = await ouvrir(w, h);
    await p.evaluate(u => { currentUser = u; renderSocieteSelect(); }, ADMIN); await p.waitForTimeout(350); const d1 = await deborde(p), l1 = await logos(p);
    await p.evaluate(() => { activeSociete = 'tek'; renderModuleSelect(); }); await p.waitForTimeout(350); const d2 = await deborde(p), l2 = await logos(p);
    const col = await p.evaluate(() => new Set([...document.querySelectorAll('.gtmh-mod-carte')].map(x => Math.round(x.getBoundingClientRect().left))).size);
    r.push([w + ' × ' + h + ' : deux écrans sans défilement, colonne visible, modules sur 3 colonnes, logos intacts', d1.dx === 0 && d1.dy === 0 && d2.dx === 0 && d2.dy === 0 && col === 3 && logosIntacts(l1) && logosIntacts(l2) && await p.evaluate(() => document.querySelector('.gtmh-cote .gtmh-nav').offsetHeight > 0)]);
    await p.close();
  }
  // tablette et téléphone : jamais de défilement horizontal, cartes empilées, actions toujours accessibles
  for (const [w, h, colonnes] of [[820, 1180, 2], [390, 844, 1], [360, 640, 1]]) {
    p = await ouvrir(w, h);
    await p.evaluate(u => { currentUser = u; renderSocieteSelect(); }, ADMIN); await p.waitForTimeout(350); const d1 = await deborde(p), l1 = await logos(p);
    await p.evaluate(() => { activeSociete = 'tek'; renderModuleSelect(); }); await p.waitForTimeout(350); const d2 = await deborde(p);
    const etat = await p.evaluate(() => ({col: new Set([...document.querySelectorAll('.gtmh-mod-carte')].map(x => Math.round(x.getBoundingClientRect().left))).size,
      bas: [...document.querySelectorAll('.gtmh-bas .gtmh-btn')].filter(x => x.offsetHeight >= 44).map(x => x.textContent.trim()).join('|'), n: document.querySelectorAll('.gtmh-mod-carte').length}));
    r.push([w + ' × ' + h + ' : aucun débordement horizontal, modules sur ' + colonnes + ' colonne(s), « Changer de société » et « Déconnexion » en bas, logos intacts', d1.dx === 0 && d2.dx === 0 && etat.col === colonnes && etat.n === 6 && etat.bas === 'Changer de société|Déconnexion' && logosIntacts(l1)]);
    await p.close();
  }
  // compatibilité anciens navigateurs : rien de récent dans la feuille de style
  const css = require('fs').readFileSync(__dirname + '/../accueil.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  r.push(['accueil.css : ni color-mix(), ni :has(), ni requêtes de conteneur, ni imbrication (Chrome 109 / Windows 7)', !/color-mix\(|:has\(|@container|container-type|\binset\s*:|aspect-ratio|@layer|:is\(|:where\(/.test(css)]);
  let ko = 0; r.forEach(x => { if (!x[1]) ko++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(ko ? ko + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(ko ? 1 : 0);
})();
