#!/usr/bin/env node
// Rapport pour la paie (23/11/2026) : une ligne par employé avec chaque jour du mois (heures travaillées ou code
// d'absence, en couleur), puis les totaux ; l'Excel ajoute une feuille par employé, jour par jour. Données inventées.
// Lancement (dans tests/) : node rh-rapport-paie.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8814), b = await chromium.launch(), r = [], err = [];
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}, serviceWorkers: 'block', acceptDownloads: true})).newPage();
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
  await p.goto('http://localhost:8814/index.html'); await p.waitForFunction(() => typeof renderShell === 'function' && typeof rrDonnees === 'function', null, {timeout: 20000});
  const D = await p.evaluate(() => {
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; activeSociete = 'tek'; activeModule = 'rh';
    const e = {a1:{nom:'Amal Test', poste:'Opératrice', matricule:'101'}, a2:{nom:'Sami Test', poste:'Contrôleur', matricule:'102'}};
    localStorage.setItem(CACHE_PREFIX + 'employees', JSON.stringify(e));
    const jours = []; for (let d = 1; d <= 30; d++) jours.push('2026-11-' + String(d).padStart(2, '0'));
    const ouvre = jours.filter(d => getSlotsForDate(d).length);
    localStorage.setItem(CACHE_PREFIX + 'attendance_' + ouvre[0], JSON.stringify({a1:{status:'present'}, a2:{status:'absent'}}));
    localStorage.setItem(CACHE_PREFIX + 'attendance_' + ouvre[1], JSON.stringify({a1:{status:'present', in:'09:00'}, a2:{status:'present'}}));
    const D = rrDonnees('paie', '2026-11-01', '2026-11-30');
    return {ent:D.entetes, l:D.lignes, codes:D.codes, mat:D.matrice, ouvre, plan:getPlannedHoursForDate(ouvre[0])};
  });
  const iA = D.ent.indexOf('Nom'), d0 = D.mat.debut + Number(D.ouvre[0].slice(8)) - 1, d1 = D.mat.debut + Number(D.ouvre[1].slice(8)) - 1;
  const amal = D.l.find(x => x[iA] === 'Amal Test'), sami = D.l.find(x => x[iA] === 'Sami Test');
  r.push(['une colonne par jour du mois (30) entre l\'employé et les totaux', D.mat.fin - D.mat.debut + 1 === 30 && D.ent[D.mat.debut] === '01' && D.ent[D.mat.fin] === '30' && D.ent[D.mat.fin + 1] === 'Jours présents']);
  r.push(['jour présent : heures travaillées de la journée', amal[d0] === D.plan && D.codes[0][d0 - D.mat.debut] === 'P']);
  r.push(['jour en retard : heures réduites, code R', amal[d1] < D.plan && D.codes[0][d1 - D.mat.debut] === 'R']);
  r.push(['jour absent : code A', sami[d0] === 'A']);
  r.push(['totaux pour la paie conservés (jours présents)', amal[D.mat.fin + 1] === 2 && sami[D.mat.fin + 1] === 1]);
  // écran Rapports
  await p.evaluate(() => { renderShell(); rrChoisir('paie'); rrDates('2026-11-01', '2026-11-30'); }); await p.waitForTimeout(500);
  const ecran = await p.evaluate(() => ({th: document.querySelectorAll('.rr-t thead th').length, p: document.querySelectorAll('.rr-t td.rr-k-P').length, a: document.querySelectorAll('.rr-t td.rr-k-A').length}));
  r.push(['écran : jours en couleur (présent, absent)', ecran.th === D.ent.length && ecran.p >= 2 && ecran.a >= 1]);
  // Excel : feuille de synthèse + une feuille par employé (ExcelJS vient d'internet : remplacé ici par un enregistreur)
  const noms = await p.evaluate(async () => {
    const feuilles = [];
    const cell = () => ({}); const row = () => ({getCell: cell, height: 0});
    const ws = (n) => { const w = {name:n, getCell:cell, getRow:row, mergeCells(){}, columns:[], views:[], pageSetup:{}}; feuilles.push(w); return w; };
    window.ExcelJS = {Workbook: function(){ this.addWorksheet = ws; this.getWorksheet = (n) => feuilles.find(f => f.name === n); this.xlsx = {writeBuffer: async () => new ArrayBuffer(1)}; }};
    window.chargerBib = async () => {};
    await rrExcel('paie', '2026-11-01', '2026-11-30');
    return feuilles.map(f => f.name);
  });
  r.push(['Excel : synthèse + une feuille par employé', noms.length === 3 && noms[0] === 'Rapport RH' && noms.indexOf('Amal Test') >= 0 && noms.indexOf('Sami Test') >= 0]);
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  // PDF : vrai fichier A4 paysage (pas l'impression du navigateur), présence jour par jour puis totaux
  const dl = p.waitForEvent('download', {timeout: 20000}).catch(() => null);
  await p.evaluate(() => rrPdf('paie', '2026-11-01', '2026-11-30')); const f = await dl;
  let pdf = ''; if (f) pdf = require('fs').readFileSync(await f.path()).toString('latin1');
  const boites = (pdf.match(/\/MediaBox\s*\[([^\]]+)\]/g) || []).map(x => x.replace(/[^\d. ]/g, ' ').trim().split(/\s+/).map(Number));
  r.push(['PDF de la paie : fichier PDF téléchargé', !!f && /\.pdf$/.test(f.suggestedFilename()) && pdf.startsWith('%PDF')]);
  r.push(['PDF de la paie : A4 paysage (842 × 595)', boites.length >= 1 && boites.every(b => Math.round(b[2]) === 842 && Math.round(b[3]) === 595)]);
  r.push(['PDF de la paie : tableau jour par jour puis totaux pour la paie', /Pr\S*sence jour par jour/.test(pdf) && /Totaux pour la paie/.test(pdf)]);
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
