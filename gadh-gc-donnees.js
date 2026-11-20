// ============================================================
// CRM GADH — Fichier de données indépendant (chargement, fusion, export).
// Le code ne contient aucune donnée réelle : les articles, clients, fournisseurs, commandes,
// livraisons, factures et accords sont dans « donnees/donnees-gadh.js », un fichier à part :
//   window.GADH_DONNEES reçoit un objet : format 'gadh-gc-donnees', version 1, genere (date), donnees (clé de stockage → valeur).
// Ce fichier n'est jamais publié (voir PUBLICATION-GITHUB.md).
// Fusion sans écraser : une fiche déjà présente (même identifiant) est conservée telle quelle ;
// les articles sont reconnus par référence, les fournisseurs et clients par nom.
// Peut être relancé sans créer de doublon.
// Fonctions gardées pour les écrans existants : gcRepriseDisponible, gcRepriseBandeau, gcChargerReprise.
// ============================================================
const GCD_FORMAT = 'gadh-gc-donnees';
const GCD_EXCLUES = ['gadh_gc_sauvegardes'];            // jamais exportées ni fusionnées
const GCD_REGLAGES_LOCAUX = ['repriseDjoIgnoree', 'repriseFaitPlastIgnoree', 'donneesChargees', 'donneesIgnorees'];

// Clé « naturelle » : une fiche équivalente déjà saisie localement (autre identifiant) n'est pas dupliquée
const GCD_CLES_NATURELLES = {
  gadh_gc_tarifs:t => [t.articleId, t.fournisseurId, t.qteMin, t.debut].join('|'),
  gadh_gc_listes_prix:l => GC.norm(l.nom),
  gadh_gc_accords:a => GC.norm(a.numero),
  gadh_gc_offres:o => GC.norm(o.numero), gadh_gc_cmd_clients:c => GC.norm(c.numero), gadh_gc_cmd_fournisseurs:c => GC.norm(c.numero),
  gadh_factures:f => GC.norm(f.numero)
};
function gcdVide(v){ return v === undefined || v === null || v === ''; }
function gcdEstListe(v){ return Array.isArray(v); }
// Objet indexé par identifiant (clients, factures) : chaque valeur est une fiche dont l'id est la clé
function gcdEstIndex(v){
  if(!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const k = Object.keys(v); if(!k.length) return false;
  return k.every(x => v[x] && typeof v[x] === 'object' && !Array.isArray(v[x]) && (v[x].id === undefined || v[x].id === x));
}
function gcdSignature(P){ return P ? String(P.genere || '') + '|' + Object.keys(P.donnees || {}).length : ''; }
function gcdPaquet(){ const P = window.GADH_DONNEES; return P && P.format === GCD_FORMAT && P.donnees ? P : null; }

// Correspondances d'identifiants : fiche du fichier → fiche déjà présente (même référence ou même nom)
function gcdCorrespondances(don){
  const m = {articleId:{}, fournisseurId:{}, clientId:{}};
  const art = GC.liste(getJSON('gadh_gc_articles', null)), four = GC.liste(getJSON('gadh_gc_fournisseurs', null)), cli = getJSON('gadh_fact_clients', {}) || {};
  GC.liste(don.gadh_gc_articles).forEach(a => {
    if(art.some(x => x.id === a.id)) return;
    const ex = art.find(x => GC.normRef(x.ref) === GC.normRef(a.ref)); if(ex) m.articleId[a.id] = ex.id;
  });
  GC.liste(don.gadh_gc_fournisseurs).forEach(f => {
    if(four.some(x => x.id === f.id)) return;
    const ex = four.find(x => GC.norm(x.nom) === GC.norm(f.nom)); if(ex) m.fournisseurId[f.id] = ex.id;
  });
  Object.keys(don.gadh_fact_clients || {}).forEach(id => {
    if(cli[id]) return;
    const n = GC.norm(don.gadh_fact_clients[id].nom), ex = Object.keys(cli).find(k => GC.norm(cli[k].nom) === n); if(ex) m.clientId[id] = ex;
  });
  return m;
}
// Remplace les identifiants partout dans les données du fichier (articleId, fournisseurId, clientId)
function gcdRemplacer(v, m){
  if(Array.isArray(v)) return v.map(x => gcdRemplacer(x, m));
  if(!v || typeof v !== 'object') return v;
  const o = {};
  Object.keys(v).forEach(k => { const x = v[k]; o[k] = m[k] && typeof x === 'string' && m[k][x] ? m[k][x] : gcdRemplacer(x, m); });
  return o;
}

// Fusionne un jeu de données {clé: valeur} dans le stockage ; renvoie le nombre de fiches ajoutées par clé
// prioriteFichier : vrai pour un fichier choisi par l'utilisateur (sauvegarde, export) : ses fiches remplacent celles de même identifiant
function gcdFusionner(donneesBrutes, prioriteFichier){
  const m = gcdCorrespondances(donneesBrutes), don = gcdRemplacer(donneesBrutes, m), bilan = {};
  Object.keys(don).forEach(cle => {
    if(GCD_EXCLUES.indexOf(cle) >= 0) return;
    const v = don[cle], ex = getJSON(cle, null);
    if(gcdEstListe(v)){
      const l = GC.liste(ex).slice(), ids = {}, nat = {}, fn = GCD_CLES_NATURELLES[cle];
      l.forEach((x, i) => { if(x && x.id) ids[x.id] = i + 1; if(fn && x) nat[fn(x)] = 1; });
      let n = 0;
      v.forEach(x => {
        if(!x || typeof x !== 'object') return;
        if(x.id && ids[x.id]){ if(prioriteFichier && JSON.stringify(l[ids[x.id] - 1]) !== JSON.stringify(x)){ l[ids[x.id] - 1] = x; n++; } return; }
        if(fn && nat[fn(x)]) return;
        // même article / fournisseur sous un autre identifiant : mis à jour (fichier prioritaire) en gardant l'identifiant local
        const loc = cle === 'gadh_gc_articles' ? m.articleId[x.id] : cle === 'gadh_gc_fournisseurs' ? m.fournisseurId[x.id] : null;
        if(loc){ if(prioriteFichier && ids[loc]){ const y = Object.assign({}, x, {id:loc}); if(JSON.stringify(l[ids[loc] - 1]) !== JSON.stringify(y)){ l[ids[loc] - 1] = y; n++; } } return; }
        l.push(x); if(x.id) ids[x.id] = l.length; if(fn) nat[fn(x)] = 1; n++;
      });
      if(n || ex === null) setJSON(cle, l);
      if(n) bilan[cle] = n;
    } else if(gcdEstIndex(v) || cle === 'gadh_fact_clients' || cle === 'gadh_factures'){
      const o = Object.assign({}, ex || {}), fn = GCD_CLES_NATURELLES[cle], nat = {}; let n = 0;
      if(fn) Object.keys(o).forEach(id => { if(o[id]) nat[fn(o[id])] = 1; });
      Object.keys(v).forEach(id => { if(o[id] && prioriteFichier){ if(JSON.stringify(o[id]) !== JSON.stringify(v[id])){ o[id] = v[id]; n++; } return; } if(cle === 'gadh_fact_clients' && m.clientId[id]){ if(prioriteFichier){ const y = Object.assign({}, v[id], {id:m.clientId[id]}); if(v[id].id === undefined) delete y.id; if(JSON.stringify(o[m.clientId[id]]) !== JSON.stringify(y)){ o[m.clientId[id]] = y; n++; } } return; } if(o[id] || (fn && nat[fn(v[id])])) return; o[id] = v[id]; if(fn) nat[fn(v[id])] = 1; n++; });
      if(n || ex === null) setJSON(cle, o);
      if(n) bilan[cle] = n;
    } else if(v && typeof v === 'object'){
      // réglages et paramètres : on complète seulement ce qui manque (la société par défaut est remplacée)
      const o = Object.assign({}, ex || {}); let n = 0;
      const defaut = cle === 'gadh_fact_params' && (!o.raison || o.raison === 'GADH TUNISIA');
      Object.keys(v).forEach(k => {
        if(cle === 'gadh_gc_reglages' && GCD_REGLAGES_LOCAUX.indexOf(k) >= 0) return;
        if((gcdVide(o[k]) || defaut || prioriteFichier) && JSON.stringify(o[k]) !== JSON.stringify(v[k])){ o[k] = v[k]; n++; }
      });
      if(n || ex === null) setJSON(cle, o);
      if(n) bilan[cle] = n;
    } else if(ex === null && v !== null && v !== undefined){ setJSON(cle, v); bilan[cle] = 1; }
  });
  if(typeof gcCacheD !== 'undefined') gcCacheD = null;
  return bilan;
}
function gcdBilanTexte(b){
  const noms = {gadh_gc_articles:'article', gadh_fact_clients:'client', gadh_gc_fournisseurs:'fournisseur', gadh_gc_offres:'offre', gadh_gc_cmd_clients:'commande client',
    gadh_gc_cmd_fournisseurs:'commande fournisseur', gadh_gc_livraisons:'livraison', gadh_factures:'facture', gadh_gc_accords:'accord de prix', gadh_gc_receptions:'réception'};
  const t = Object.keys(noms).filter(k => b[k]).map(k => b[k] + ' ' + noms[k] + (b[k] > 1 ? 's' : ''));
  return t.length ? t.join(', ') + ' (ajout ou mise à jour)' : 'rien de nouveau (tout est déjà à jour)';
}

// ---------- Bandeau « Données prêtes à charger » (accueil, commandes) ----------
function gcRepriseManquante(){
  const P = gcdPaquet(); if(!P) return [];
  const R = getJSON('gadh_gc_reglages', {}) || {};
  return R.donneesChargees === gcdSignature(P) || R.donneesIgnorees === gcdSignature(P) ? [] : ['donnees'];
}
function gcRepriseDisponible(){ return gcRepriseManquante().length > 0; }
function gcdResume(don){
  const n = k => GC.liste(don[k]).length, c = Object.keys(don.gadh_fact_clients || {}).length, f = Object.keys(don.gadh_factures || {}).length;
  return [[n('gadh_gc_articles'), 'article'], [c, 'client'], [n('gadh_gc_fournisseurs'), 'fournisseur'], [n('gadh_gc_cmd_clients'), 'commande client'], [n('gadh_gc_cmd_fournisseurs'), 'commande fournisseur'],
    [n('gadh_gc_livraisons'), 'livraison'], [f, 'facture'], [n('gadh_gc_accords'), 'accord de prix']].filter(x => x[0]).map(x => x[0] + ' ' + x[1] + (x[0] > 1 ? 's' : '')).join(' · ');
}
function gcRepriseBandeau(){
  const P = gcdPaquet(); if(!P) return '';
  return `<div class="card" data-gc="reprise-djo" style="border-left:4px solid var(--accent);"><b>Fichier de données prêt à charger</b>
    <div class="gc-sous" style="margin:4px 0 8px;">donnees-gadh.js${P.genere ? ' du ' + esc(String(P.genere).slice(0, 10).split('-').reverse().join('/')) : ''} : ${esc(gcdResume(P.donnees))}. Les fiches déjà présentes ne sont pas modifiées.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" data-gc="charger-reprise" onclick="gcChargerReprise()">Charger les données</button>
    <button class="btn btn-ghost" data-gc="ignorer-reprise" onclick="gcdIgnorer()">Ne pas charger</button></div></div>`;
}
function gcdNoter(champ){
  setJSON('gadh_gc_reglages', Object.assign({}, getJSON('gadh_gc_reglages', {}) || {}, {[champ]:gcdSignature(gcdPaquet())}));
  if(typeof gcCacheD !== 'undefined') gcCacheD = null;
}
function gcdIgnorer(){ gcdNoter('donneesIgnorees'); renderShell(); }
window.gcChargerReprise = () => {
  const P = gcdPaquet(); if(!P){ showToast('Aucun fichier de données (donnees/donnees-gadh.js)'); return; }
  const b = gcdFusionner(P.donnees); gcdNoter('donneesChargees');
  if(typeof gcJournal === 'function') gcJournal('Reprise', 'Fichier de données', {id:'donnees', numero:'donnees-gadh.js'}, gcdBilanTexte(b));
  if(typeof gcTabs !== 'undefined') gcTabs.planning = null;
  showToast('Données chargées : ' + gcdBilanTexte(b)); nav('gc-accueil');
};

// ---------- Paramètres : charger un fichier de données, exporter les données en fichier .js ----------
function gcdLireTexte(t){
  t = String(t).replace(/^﻿/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}'); if(i < 0 || j < i) throw new Error('fichier non reconnu');
  const d = JSON.parse(t.slice(i, j + 1));
  if(d && (d.format === GCD_FORMAT || d.format === 'gadh-gc-autonome') && d.donnees) return d;
  throw new Error('fichier non reconnu');
}
function gcdChargerFichier(input){
  const f = input.files && input.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = gcdLireTexte(r.result);
      if(!confirm('Charger les données de « ' + f.name + ' » ?\n' + gcdResume(d.donnees) + '\n\nLe fichier est prioritaire : ses fiches (avec vos corrections) remplacent celles qui portent le même identifiant ; les autres fiches sont conservées.')) return;
      const b = gcdFusionner(d.donnees, true);
      if(typeof gcJournal === 'function') gcJournal('Reprise', 'Fichier de données', {id:'donnees', numero:f.name}, gcdBilanTexte(b));
      showToast('Données ajoutées : ' + gcdBilanTexte(b)); nav('gc-accueil');
    } catch(e){ showToast('Chargement impossible : ' + e.message); }
    finally { input.value = ''; }
  };
  r.readAsText(f);
}
function gcdDonneesActuelles(){
  const d = {};
  appCles().filter(k => GCD_EXCLUES.indexOf(k) < 0).sort().forEach(k => {
    let v = getJSON(k, null);
    if(k === 'gadh_gc_reglages' && v){ v = Object.assign({}, v); GCD_REGLAGES_LOCAUX.forEach(x => { delete v[x]; }); }
    if(v !== null) d[k] = v;
  });
  return d;
}
function gcdTexteFichier(d, genere){
  return '// CRM GADH — fichier de données (articles, clients, fournisseurs, commandes, livraisons, factures, accords…).\n' +
    '// DONNÉES CONFIDENTIELLES : ne jamais publier ce fichier (dépôt GitHub, GitHub Pages, messagerie publique).\n' +
    '// Chargé par index.html s\'il est présent dans le dossier « donnees/ » ; sinon : Paramètres › Charger un fichier de données.\n' +
    'window.GADH_DONNEES = ' + JSON.stringify({format:GCD_FORMAT, version:1, genere:genere, donnees:d}, null, 1) + ';\n';
}
function gcdExporter(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gcdTexteFichier(gcdDonneesActuelles(), new Date().toISOString())], {type:'text/javascript'}));
  a.download = 'donnees-gadh.js'; document.body.appendChild(a); a.click(); a.remove();
  showToast('Fichier de données téléchargé : à placer dans le dossier « donnees/ » (jamais sur GitHub)');
}
// Boutons ajoutés à l'écran Paramètres
(function(){
  const avant = renderGcReglages;
  renderGcReglages = function(main){
    avant(main);
    const body = document.getElementById('gc-body'); if(!body) return;
    const P = gcdPaquet();
    body.insertAdjacentHTML('afterbegin', `<div class="card" data-gc="fichier-donnees"><h3 class="gc-h3">Fichier de données</h3>
      <div class="gc-sous" style="margin-bottom:8px;">Les données (articles, clients, fournisseurs, commandes, livraisons, factures…) sont séparées du code de l'application. ${P ? 'Fichier donnees-gadh.js détecté.' : 'Aucun fichier donnees-gadh.js à côté de l\'application.'} Ce fichier reste sur vos appareils : ne le publiez jamais.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${P ? '<button class="btn btn-ghost" data-gc="charger-donnees-detectees" onclick="gcChargerReprise()">Charger le fichier détecté</button>' : ''}
      <label class="btn btn-ghost" style="cursor:pointer;" data-gc="charger-fichier-donnees">Charger un fichier de données (.js ou .json)<input type="file" accept=".js,.json,text/javascript,application/json" style="display:none;" onchange="gcdChargerFichier(this)"></label>
      <button class="btn btn-ghost" data-gc="exporter-donnees" onclick="gcdExporter()">Exporter le fichier de données (.js)</button></div></div>`);
  };
})();
