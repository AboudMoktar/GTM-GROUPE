#!/usr/bin/env node
// Tableau de bord Gestion Rendement (refonte du 23/11/2026) : la présence vient du pointage RH et des mentions ABS ;
// une absente n'a ni barre ni « 0 », n'est pas comptée présente ; un retard reste présent ; les calculs
// (total, objectif, rendement, opératrices actives) ne changent pas. Données inventées.
// Lancement (dans tests/) : node rendement-accueil.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const JOUR = '2026-11-24'; // mardi
(async () => {
  const s = serveur.demarrer(8815), b = await chromium.launch(), r = [], err = [];
  const essai = async (larg, haut) => {
    const ctx = await b.newContext({viewport: {width: larg, height: haut}, serviceWorkers: 'block'});
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date(JOUR + 'T14:25:00'));
    p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
    p.on('console', m => { if (m.type() === 'error' && !/firebase|net::|Failed to load|Service Worker/i.test(m.text())) err.push(m.text()); });
    await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
    await p.goto('http://localhost:8815/index.html'); await p.waitForFunction(() => typeof renderShell === 'function' && typeof rdStatutsOps === 'function', null, {timeout: 20000});
    return {p, ctx};
  };
  const prep = (JOUR) => {
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; activeSociete = 'tek'; activeModule = 'rendement';
    const set = (k, v) => localStorage.setItem(CACHE_PREFIX + k, JSON.stringify(v));
    set('ops_history', {op1:[{nom:'Awatef Test', dateDebut:'2000-01-01', actif:true}], op2:[{nom:'Hela Test', dateDebut:'2000-01-01', actif:true}],
      op3:[{nom:'Marwa Test', dateDebut:'2000-01-01', actif:true}], op4:[{nom:'Mabrouka Test', dateDebut:'2000-01-01', actif:true}]});
    set('employees', {e1:{nom:'Awatef Test'}, e2:{nom:'Hela Test'}, e3:{nom:'Ben Salah Marwa Test', poste:'Contrôle'}, e5:{nom:'Marwa Test Trabelsi', poste:'Magasin'}, e4:{nom:'Mabrouka Test'}});
    set('attendance_' + JOUR, {e1:{status:'present', in:'08:00'}, e2:{status:'present', in:'08:40'}, e3:{status:'absent'}});
    set('absence_periods', {p1:{empId:'e4', type:'maladie', dateStart:JOUR, dateEnd:JOUR}});
    const h = getHoursForDate(JOUR), d = {date:JOUR, status:'draft', hours:{}};
    h.forEach((x, i) => d.hours[x] = {op1: i < 5 ? '17' : '', op2: i < 5 ? '16' : '', op3:'', op4:'', obs:''});
    set('prod_' + JOUR, d);
    const veille = {date:'2026-11-23', status:'draft', hours:{}}; getHoursForDate('2026-11-23').forEach((x, i) => veille.hours[x] = {op1: i < 5 ? '15' : '', op2:'', op3:'', op4:'', obs:''});
    set('prod_2026-11-23', veille);
  };
  // ---- PC
  let {p, ctx} = await essai(1440, 900);
  await p.evaluate(prep, JOUR);
  const avant = await p.evaluate((J) => { const d = getDay(J), t = computeTotals(d); return {total:t.totalGeneral, obj:getObjForDay(d), actives:getHoursForDate(J).reduce((m, h) => Math.max(m, getActiveOpCount(h, d)), 0), st:rdStatutsOps(J, d).map(x => x.code)}; }, JOUR);
  r.push(['statuts : présente, retard, absente (pointage, salariée trouvée par prénom + poste Contrôle), absente (maladie RH)', avant.st.join() === 'presente,retard,absente,absente']);
  await p.evaluate(() => { renderShell(); nav('dashboard'); }); await p.waitForTimeout(600);
  const pc = await p.evaluate(() => {
    const t = (s) => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
    const rows = [...document.querySelectorAll('.rd-op')].map(e => ({abs: e.classList.contains('rd-absente'), bar: !!e.querySelector('.rank-bar'), txt: e.textContent.replace(/\s+/g, ' ')}));
    return {hero: document.querySelector('.hero-stat-big').textContent, kpis: t('.rd-kpis .kpi-mini'), titres: [...document.querySelectorAll('.rd-kpis .kpi-mini')].map(e => e.title || ''), rows, syn: t('.rd-syn'), heure: (document.getElementById('rd-heure') || {}).textContent,
      hier: (document.querySelector('.rdh-hier-l') || {}).textContent || '', bulle: (document.querySelector('.rdh-bulle') || {}).textContent || '', cols: getComputedStyle(document.querySelector('.rd-grille')).gridTemplateColumns.split(' ').length,
      lbl: Math.min(...[...document.querySelectorAll('.kpi-mini-lbl')].map(e => parseFloat(getComputedStyle(e).fontSize))), large: document.documentElement.scrollWidth <= innerWidth + 1};
  });
  r.push(['total et objectif inchangés (pièces = calcul existant)', pc.hero === String(avant.total) && avant.total === 165]);
  r.push(['KPI présentes 2/4 (retard compté présente, absentes non)', /2 \/ 4/.test(pc.kpis[1])]);
  r.push(['KPI « opératrices actives » de la saisie conservé', pc.titres[1].indexOf(avant.actives + ' opératrice') === 0]);
  r.push(['KPI absentes : 2 avec les noms', /^2/.test(pc.kpis[3].replace(/^\D+/, '')) && pc.titres[3].indexOf('Marwa Test') >= 0 && pc.titres[3].indexOf('Mabrouka Test') >= 0]);
  r.push(['absentes en fin de liste, grisées, sans barre ni 0 PC', pc.rows.length === 4 && pc.rows[2].abs && pc.rows[3].abs && !pc.rows[2].bar && !pc.rows[3].bar && !/0 PC/.test(pc.rows[2].txt + pc.rows[3].txt)]);
  r.push(['badge « Absente » / « Maladie »', /Absente/.test(pc.rows.find(x => /Marwa/.test(x.txt)).txt) && /Maladie/i.test(pc.rows.find(x => /Mabrouka/.test(x.txt)).txt)]);
  r.push(['présentes avec barre, PC et part', !pc.rows[0].abs && pc.rows[0].bar && /85 PC/.test(pc.rows[0].txt) && /51,5%/.test(pc.rows[0].txt)]);
  r.push(['retard affiché sur la ligne de Hela (08:40)', /Retard · 08:40/.test(pc.rows[1].txt)]);
  r.push(['synthèse : rythme, cadence horaire, objectif prévu', pc.syn.length === 3 && /PC\/h/.test(pc.syn[1]) && /340 PC/.test(pc.syn[2])]);
  r.push(['bulle : 48,5% de l\'objectif', /48,5%\s*de l'objectif/.test(pc.bulle)]);
  r.push(['heure affichée (14:25)', pc.heure === '14:25']);
  r.push(['comparaison vs hier (+90)', /\+90/.test(pc.hier) && /vs hier/.test(pc.hier)]);
  // le « i » ouvre une bulle (et ne mène pas à l'historique) : même heure hier, journée complète
  const bi = await p.evaluate(() => { activeTab = 'dashboard'; document.querySelector('.rdh-i').click(); const z = document.getElementById('rdh-info'); return {tab:activeTab, vis:!z.hidden, txt:z.textContent.replace(/\s+/g, ' ')}; });
  r.push(['bouton i : bulle sur place, pas d\'historique (' + bi.txt.slice(0, 120) + ')', bi.tab === 'dashboard' && bi.vis && /Hier à la même heure : 75 pièces \(\+90\)/.test(bi.txt) && /journée complète : 75 pièces/.test(bi.txt)]);
  r.push(['PC : 2 colonnes (production + synthèse)', pc.cols === 2]);
  r.push(['libellés KPI lisibles (≥ 11 px)', pc.lbl >= 11]);
  r.push(['PC : pas de débordement horizontal', pc.large]);
  // clic : une absente ouvre toujours le détail ; la carte principale mène à l'historique
  await p.evaluate(() => document.querySelectorAll('.rd-op')[2].click()); await p.waitForTimeout(300);
  r.push(['détail opératrice accessible', await p.evaluate(() => document.getElementById('operatrice-modal-zone').innerHTML.length > 50)]);
  await p.evaluate(() => { nav('dashboard'); document.querySelector('.hero-card').click(); }); await p.waitForTimeout(300);
  r.push(['carte principale → historique', await p.evaluate(() => activeTab === 'historique')]);
  // Historique : badges de présence au-dessus des colonnes ; Statistiques : absences séparées des jours travaillés
  await p.evaluate((J) => { histDate = J; histViewMode = 'jour'; nav('historique'); }, JOUR); await p.waitForTimeout(300);
  const hi = await p.evaluate(() => [...document.querySelectorAll('thead th')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  r.push(['historique : Absente / Maladie / Retard en tête de colonne', hi.some(x => /Marwa Test\s*Absente/.test(x)) && hi.some(x => /Mabrouka Test\s*Maladie/.test(x)) && hi.some(x => /Hela Test\s*Retard/.test(x))]);
  await p.evaluate((J) => { statRangeStart = '2026-11-23'; statRangeEnd = J; nav('stats'); }, JOUR); await p.waitForTimeout(300);
  const st = await p.evaluate(() => { const L = {}; document.querySelectorAll('.rd-classement tbody tr').forEach(tr => { const c = [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()); L[c[1]] = c; }); return L; });
  const sa = st['Awatef Test'] || [], sm = st['Marwa Test'] || [];
  r.push(['stats : classement inchangé (total Awatef 160 = 75 + 85)', sa[2] === '160']);
  r.push(['stats : Awatef 2 jours travaillés, 0 absence, moyenne 80 PC', sa[4] === '2' && sa[5] === '0' && sa[6] === '80 PC']);
  r.push(['stats : Marwa 1 jour d\'absence (24), le 23 sans pointage compte travaillé', sm[5] === '1 j' && sm[4] === '1']);
  // présente sans production ≠ absente ; mention ABS de la saisie = absente
  await p.evaluate((J) => { const d = getDay(J); Object.values(d.hours).forEach(h => { h.op1 = ''; h.op4 = 'ABS'; }); memoryCache[CACHE_PREFIX + 'prod_' + J] = d;
    memoryCache[CACHE_PREFIX + 'absence_periods'] = {}; nav('dashboard'); }, JOUR); await p.waitForTimeout(400);
  const z = await p.evaluate(() => [...document.querySelectorAll('.rd-op')].map(e => ({abs: e.classList.contains('rd-absente'), zero: e.classList.contains('rd-zero'), txt: e.textContent.replace(/\s+/g, ' ') + ' ' + [...e.querySelectorAll('[title]')].map(x => x.title).join(' ')})));
  const aw = z.find(x => /Awatef/.test(x.txt)), ma = z.find(x => /Mabrouka/.test(x.txt));
  r.push(['présente sans pièce : « Pas encore de pièces », pas absente', aw && !aw.abs && aw.zero && /Pas encore de pièces/.test(aw.txt)]);
  r.push(['mention ABS dans la saisie → absente', ma && ma.abs && /ABS dans la saisie/.test(ma.txt)]);
  // « A » dans la saisie : A partout = absente ; A sur les premières heures = retard (objectif réduit sur ces heures) ; A au milieu = absente une partie
  const a = await p.evaluate((J) => { const d = getDay(J), hs = Object.keys(d.hours);
    hs.forEach((h, i) => { d.hours[h].op4 = 'A'; d.hours[h].op1 = i < 2 ? 'A' : (i < 5 ? '17' : ''); d.hours[h].op2 = i === 2 ? 'a' : (i < 5 ? '16' : ''); });
    memoryCache[CACHE_PREFIX + 'prod_' + J] = d; memoryCache[CACHE_PREFIX + 'attendance_' + J] = {}; memoryCache[CACHE_PREFIX + 'absence_periods'] = {};
    const st = rdStatutsOps(J, d), obj = getObjForDay(d); d.hours[hs[0]].op1 = '17'; d.hours[hs[1]].op1 = '17'; const obj2 = getObjForDay(d);
    return {st:st.map(x => x.code + ':' + x.label), moinsObjectif:obj2 - obj}; }, JOUR);
  r.push(['A partout → absente ; A sur les 2 premières heures → retard ; A au milieu → absente une partie (' + a.st.join(', ') + ')', /^retard:Retard · arrivée /.test(a.st[0]) && /^autorisation:Absente une partie/.test(a.st[1]) && /^absente:/.test(a.st[3])]);
  r.push(['retard en A : objectif réduit sur les heures manquées (' + a.moinsObjectif + ' pièces)', a.moinsObjectif > 0]);
  const sA = await p.evaluate(() => { nav('saisie'); let vu = null; window.saveDay = (d, x) => { vu = x; }; const h0 = Object.keys(getDay(saisieDate).hours)[0]; handleInput(h0, 'op3', 'a'); return vu ? vu.hours[h0].op3 : null; });
  r.push(['saisie : « a » enregistré en « A »', sA === 'A']);
  await ctx.close();
  // ---- Android (390 px)
  ({p, ctx} = await essai(390, 844));
  await p.evaluate(prep, JOUR); await p.evaluate(() => { renderShell(); nav('dashboard'); }); await p.waitForTimeout(600);
  const mob = await p.evaluate(() => ({cols: getComputedStyle(document.querySelector('.rd-kpis')).gridTemplateColumns.split(' ').length, g: getComputedStyle(document.querySelector('.rd-grille')).gridTemplateColumns.split(' ').length, large: document.documentElement.scrollWidth <= innerWidth + 1}));
  r.push(['mobile : KPI 2×2, sections empilées, pas de débordement', mob.cols === 2 && mob.g === 1 && mob.large]);
  await ctx.close();
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
