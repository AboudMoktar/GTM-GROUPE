// Affichage multiplateforme : l'interface tient sur toutes les résolutions d'ordinateur visées,
// sans défilement horizontal de page, et le suivi des commandes garde sa présentation « ordinateur ».
// Données inventées uniquement (dépôt public).
const { chromium } = require('playwright');
const serveur = require('./serveur.js');
const RES = [[1280,720],[1280,1024],[1366,768],[1440,900],[1600,900],[1920,1080],[2560,1440]];
const ECRANS = [['tek-dashboard',null],['rendement','dashboard'],['rendement','saisie'],['rendement','historique'],['rendement','stats'],['rh','rh-dashboard'],['rh','rh-pointage'],['rh','rh-synthese'],['rh','rh-personnel']];
const W7 = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';
let echecs = 0;
function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if(!c) echecs++; }
async function ouvrir(b, w, h, ua){
  const ctx = await b.newContext(Object.assign({viewport:{width:w,height:h}, serviceWorkers:'block'}, ua ? {userAgent:ua} : {}));
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => { if(!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8797/index.html');
  await p.waitForFunction(() => typeof renderShell === 'function');
  await p.evaluate(() => {
    const emps = {}; for(let i = 0; i < 24; i++) emps['e'+i] = {nom:'Salariée ' + (i+1) + ' Exemple', matricule:String(100+i), poste:'Couture', statut:'actif', departement:'Atelier'};
    memoryCache['grp1_employees'] = emps;
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true,gadh:true,mgt:true}};
  });
  return {ctx, p, err};
}
(async () => {
  const s = serveur.demarrer(8797), b = await chromium.launch();
  for(const [w,h] of RES){
    const {ctx, p, err} = await ouvrir(b, w, h);
    let pire = 0, petits = 0;
    for(const [mod, tab] of ECRANS){
      const m = await p.evaluate(async ({mod, tab}) => {
        activeSociete = 'tek'; activeModule = mod; renderShell(); if(tab) nav(tab);
        await new Promise(r => setTimeout(r, 250));
        const de = document.documentElement; let petits = 0;
        document.querySelectorAll('main *').forEach(el => { const r = el.getBoundingClientRect(); if(!r.width || !r.height) return;
          if(![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
          if(parseFloat(getComputedStyle(el).fontSize) < 12) petits++; });
        return {dx: de.scrollWidth - de.clientWidth, petits};
      }, {mod, tab});
      pire = Math.max(pire, m.dx); petits += m.petits;
    }
    ok(pire <= 1, w + '×' + h + ' : aucun défilement horizontal de page (TEK-TREND)');
    ok(petits === 0, w + '×' + h + ' : aucun texte sous 12 px (TEK-TREND)');
    // synthèse RH : les six indicateurs sur une seule rangée
    const rang = await p.evaluate(async () => { activeModule = 'rh'; renderShell(); nav('rh-synthese'); await new Promise(r => setTimeout(r, 250));
      return new Set([...document.querySelectorAll('.syn-kpis .kpi-mini')].slice(0,6).map(e => Math.round(e.getBoundingClientRect().top))).size; });
    ok(rang === 1, w + '×' + h + ' : synthèse, indicateurs sur une rangée');
    // suivi des commandes : cadre sur toute la zone de travail, onglets en haut et sans débordement
    await p.evaluate(() => { activeModule = 'commandes'; renderShell(); nav('commandes-home'); });
    await p.waitForTimeout(900);
    const fr = p.frames().find(f => /suivi-commandes/.test(f.url()));
    await fr.waitForFunction(() => typeof render === 'function' && document.getElementById('tabs').children.length > 0);
    const c = await fr.evaluate(() => { const t = document.getElementById('tabs'), v = document.getElementById('view');
      return {W: document.documentElement.clientWidth, deb: t.scrollWidth - t.clientWidth, haut: t.getBoundingClientRect().top < v.getBoundingClientRect().top}; });
    const page = await p.evaluate(() => { const de = document.documentElement; return {dx: de.scrollWidth - de.clientWidth, dy: de.scrollHeight - de.clientHeight}; });
    ok(c.W >= 1024 && c.haut, w + '×' + h + ' : suivi en présentation ordinateur (cadre de ' + c.W + ' px, onglets en haut)');
    ok(c.deb <= 1, w + '×' + h + ' : suivi, les onglets ne débordent pas');
    ok(page.dx <= 1 && page.dy <= 1, w + '×' + h + ' : suivi, la page ne défile pas autour du cadre');
    ok(err.length === 0, w + '×' + h + ' : aucune erreur JavaScript' + (err.length ? ' — ' + err[0] : ''));
    await ctx.close();
  }
  // téléphone : présentation inchangée (onglets du suivi en bas, pas de défilement horizontal)
  { const {ctx, p} = await ouvrir(b, 390, 844);
    const dx = await p.evaluate(async () => { activeSociete = 'tek'; activeModule = 'rh'; renderShell(); nav('rh-synthese'); await new Promise(r => setTimeout(r, 250)); const de = document.documentElement; return de.scrollWidth - de.clientWidth; });
    ok(dx <= 1, 'téléphone : synthèse sans défilement horizontal');
    const pc = await p.evaluate(() => getComputedStyle(document.querySelector('.syn-detail .syn-heures-pc')).display);
    ok(pc === 'none', 'téléphone : détail par employé en présentation d\'origine');
    await ctx.close(); }
  // ancien ordinateur (Windows 7, Chrome 109) : affichage allégé, écran normal ailleurs
  { const {ctx, p} = await ouvrir(b, 1280, 1024, W7);
    ok(await p.evaluate(() => document.documentElement.getAttribute('data-ancien') === '1'), 'Windows 7 : affichage allégé activé');
    ok(await p.evaluate(() => { const d = document.createElement('div'); d.className = 'card'; d.style.backdropFilter = 'blur(4px)'; document.body.appendChild(d); const v = getComputedStyle(d).backdropFilter; d.remove(); return v === 'none'; }), 'Windows 7 : effets de flou coupés');
    await ctx.close(); }
  { const {ctx, p} = await ouvrir(b, 1280, 1024);
    ok(await p.evaluate(() => !document.documentElement.hasAttribute('data-ancien')), 'ordinateur récent : rien de retiré');
    await ctx.close(); }
  // les feuilles de style communes restent lisibles par Chrome 109 / Firefox ESR 115
  const fs = require('fs'), path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'multiplateforme.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/color-mix\(|:has\(|@container|@layer/.test(css), 'multiplateforme.css : aucune fonction absente de Chrome 109 / Firefox 115');
  await b.close(); s.close();
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  process.exit(echecs ? 1 : 0);
})();
