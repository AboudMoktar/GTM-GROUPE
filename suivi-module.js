// ============================================================
// SUIVI DES COMMANDES PERCKO (TEK-TREND ↔ GADH)
// ============================================================
// Reprise de l'application « Suivi PERCKO » (lots, clients NEOLYS / ALLOGA,
// 9 étapes coupe → expédition, envois et retours GADH partiels, NC, fiches
// de consommation). L'application elle-même est dans suivi-commandes.html,
// affichée dans un cadre (iframe) pour garder ses styles et son code à part.
//
// Ce fichier fait le lien avec le reste de l'application :
//  - stockage : chaque document du suivi (cfg, lines-<lot>, moves-<lot>-<n>)
//    est une clé « suivi_d_<id> » enregistrée avec getJSON/setJSON, donc dans
//    le dossier Firebase liaison/ (lisible par TEK-TREND et GADH) ;
//    « suivi_index » liste les documents existants ;
//  - vue : 'tek' (tout le suivi) ou 'gadh' (étapes GADH seulement) ;
//  - synchro : à chaque mise à jour Firebase, le cadre relit les données.

const SUIVI_INDEX = 'suivi_index';
const SUIVI_PREFIXE = 'suivi_d_';

function suiviLireDocs(){
  const ids = getJSON(SUIVI_INDEX, []) || [];
  const docs = {};
  ids.forEach(id => { const d = getJSON(SUIVI_PREFIXE + id, null); if(d) docs[id] = d; });
  return docs;
}
// changes : { id: document | null (suppression) }
function suiviEcrireDocs(changes){
  const ids = new Set(getJSON(SUIVI_INDEX, []) || []);
  let indexChange = false;
  Object.keys(changes).forEach(id => {
    const d = changes[id];
    if(d === null){
      setJSON(SUIVI_PREFIXE + id, null);
      if(ids.delete(id)) indexChange = true;
    } else {
      setJSON(SUIVI_PREFIXE + id, d);
      if(!ids.has(id)){ ids.add(id); indexChange = true; }
    }
  });
  if(indexChange) setJSON(SUIVI_INDEX, Array.from(ids).sort());
}

// Point d'accès lu par suivi-commandes.html (window.parent.grpSuiviStore).
window.grpSuiviStore = {
  lireDocs: suiviLireDocs,
  ecrireDocs: suiviEcrireDocs,
  vue: () => (activeModule === 'gadh' ? 'gadh' : 'tek'),
  lectureSeule: () => !!(currentUser && currentUser.role === 'viewer'),
  toast: (msg) => showToast(msg)
};

function renderSuiviFrame(main){
  const vue = activeModule === 'gadh' ? 'gadh' : 'tek';
  main.innerHTML = `<iframe id="suivi-frame" class="suivi-frame suivi-${vue}" src="./suivi-commandes.html?vue=${vue}" title="Suivi des commandes"></iframe>`;
}
// Appelé à chaque mise à jour Firebase quand le suivi est ouvert.
function suiviNotifier(){
  const f = document.getElementById('suivi-frame');
  try { if(f && f.contentWindow && typeof f.contentWindow.suiviRecharger === 'function') f.contentWindow.suiviRecharger(); } catch(e) {}
}

// --- Indicateurs pour l'écran direction (lecture seule) ---
// Une commande (lot) est en cours tant que tout n'est pas expédié et qu'elle
// n'a pas été clôturée avec écart.
function suiviResume(){
  const docs = suiviLireDocs();
  const lots = (docs.cfg && docs.cfg.lots) || {};
  const qte = {}, lotDeLigne = {}, etapes = {};
  Object.keys(docs).forEach(id => {
    const d = docs[id];
    if(id.indexOf('lines-') === 0) (d.lines || []).forEach(a => { lotDeLigne[a[0]] = d.lot; qte[d.lot] = (qte[d.lot] || 0) + (a[6] || 0); });
  });
  Object.keys(docs).forEach(id => {
    const d = docs[id];
    if(id.indexOf('moves-') !== 0) return;
    (d.moves || []).forEach(m => {
      const lot = lotDeLigne[m[2]]; if(!lot) return;
      const e = etapes[lot] || (etapes[lot] = {});
      e[m[3]] = (e[m[3]] || 0) + (m[4] || 0);
    });
  });
  return Object.keys(qte).map(lot => {
    const e = etapes[lot] || {}, info = lots[lot] || {};
    return {lot, qte:qte[lot], etapes:e, enCours: !info.closed && Math.max(0, qte[lot] - (e.exp || 0)) > 0};
  });
}
function suiviCommandesEnCours(){ return suiviResume().filter(l => l.enCours).length; }
// Côté GADH : lots dont des pièces envoyées à la GADH ne sont pas encore revenues.
function suiviLotsChezGadh(){
  return suiviResume().filter(l => l.enCours && (l.etapes.gadh || 0) > (l.etapes.ret || 0)).length;
}

// --- Rendement GADH ---
// La production du jour de la GADH = pièces revenues chez TEK-TREND après
// assemblage (étape « Retour TEK-TREND » du suivi), par libellé (modèle et
// couleur). Les clés de référence sont préfixées « pk_ » et nettoyées pour
// pouvoir servir de clés Firebase (cadences GADH).
function suiviCleRef(lib){ return 'pk_' + String(lib).replace(/[.#$\/\[\]]/g, '_'); }
function suiviLignes(){
  const docs = suiviLireDocs(), lignes = {};
  Object.keys(docs).forEach(id => {
    if(id.indexOf('lines-') === 0) (docs[id].lines || []).forEach(a => { lignes[a[0]] = {lot:docs[id].lot, client:a[2], model:a[3], lib:a[4], size:a[5], qty:a[6]}; });
  });
  return {docs, lignes};
}
// { cle : {lib, model} } pour tous les libellés de la nomenclature et des commandes
function suiviReferences(){
  const {docs, lignes} = suiviLignes(), refs = {};
  ((docs.cfg && docs.cfg.nomen) || []).forEach(n => { refs[suiviCleRef(n[1])] = {lib:n[1], model:n[0]}; });
  Object.values(lignes).forEach(l => { refs[suiviCleRef(l.lib)] = {lib:l.lib, model:l.model}; });
  return refs;
}
function suiviRetoursParRefDuJour(dateISO){
  const {docs, lignes} = suiviLignes(), parRef = {};
  Object.keys(docs).forEach(id => {
    if(id.indexOf('moves-') !== 0) return;
    (docs[id].moves || []).forEach(m => {
      if(m[1] !== dateISO || m[3] !== 'ret') return;
      const l = lignes[m[2]]; if(!l) return;
      const k = suiviCleRef(l.lib);
      parRef[k] = (parRef[k] || 0) + (m[4] || 0);
    });
  });
  Object.keys(parRef).forEach(k => { if(parRef[k] <= 0) delete parRef[k]; });
  return parRef;
}
// Lots en cours vus par la GADH : pièces commandées et pièces déjà retournées.
function suiviLotsPourGadh(){
  return suiviResume().filter(l => l.enCours).map(l => ({
    id:'pk:' + l.lot, numero:l.lot, total:l.qte, retourFait:l.etapes.ret || 0,
    pct: l.qte > 0 ? Math.min(100, Math.round((l.etapes.ret || 0) / l.qte * 100)) : 0
  }));
}
