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
  toast: (msg) => showToast(msg),
  imprimer: (html, titre) => suiviImprimer(html, titre),
  apercu: (full, titre, format, marge) => suiviApercu(full, titre, format, marge),
  // Facture TEK-TREND préparée à partir d'un export (voir facturation-percko-module.js)
  synchroFactureExport: (x, creer, final) => (activeModule !== 'gadh' && typeof percSynchroFactureExport === 'function') ? percSynchroFactureExport(x, creer, final) : 0,
  facturerExport: (x, forcer) => (activeModule !== 'gadh' && typeof percFacturerExport === 'function') ? percFacturerExport(x, forcer) : {ok:false, message:'Facturation indisponible ici.'},
  apercuFactureModele: (x, mode) => (activeModule !== 'gadh' && typeof percApercuFactureExport === 'function') ? percApercuFactureExport(x, mode) : false,
  apercuFacture: (x) => (activeModule !== 'gadh' && typeof percApercuFacture === 'function') ? percApercuFacture(x) : null,
  ouvrirFacture: (id, r) => {
    if(typeof percOuvrirFacture !== 'function') return;
    percOuvrirFacture(id);
    if(r && r.ok) showToast('Facture préparée' + (r.sansPrix ? ' : ' + r.sansPrix + ' prix à compléter' : '') + '. Vérifiez, complétez les frais, puis émettez.');
  }
};

// Gestion de stock TEK-TREND (onglet Stock du suivi) : données dans le dossier
// Firebase tek/ (la GADH ne les lit pas). Une fiche par enregistrement :
//  - stk_mv/<id>     : mouvements (entrée, sortie, retour, perte, ajustement) — jamais modifiés,
//                      une erreur se corrige par une écriture inverse ;
//  - stk_cf/<id>     : commandes fournisseurs (propositions validées) ;
//  - stk_params/<ref>: seuil minimum, fournisseur, emplacement, conditionnement, délai.
// Écrire fiche par fiche évite qu'une saisie faite en même temps sur un autre
// téléphone en écrase une autre.
const STK_CLES = {mv:'stk_mv', cf:'stk_cf', sp:'stk_params'};
window.grpStockStore = {
  dispo: () => !!currentUser && activeModule !== 'gadh' && (typeof userSocietes !== 'function' || userSocietes().indexOf('tek') >= 0),
  lire: () => ({mv: getJSON('stk_mv', {}) || {}, cf: getJSON('stk_cf', {}) || {}, sp: getJSON('stk_params', {}) || {}}),
  utilisateur: () => (currentUser && (currentUser.nom || currentUser.username)) || '',
  ecrire: (coll, id, rec) => {
    const cle = STK_CLES[coll]; if(!cle || !id) return false;
    if(currentUser && currentUser.role === 'viewer') return false;
    if(typeof hlEcritureAutorisee === 'function' && !hlEcritureAutorisee(cle)) return false;
    const plein = CACHE_PREFIX + cle, tout = getJSON(cle, {}) || {};
    if(rec === null) delete tout[id]; else tout[id] = rec;
    memoryCache[plein] = tout;
    try { window.localStorage.setItem(plein, JSON.stringify(tout)); } catch(e) {}
    const chemin = firebaseCheminDe(cle) + '/' + id;
    if(typeof hlEcrire === 'function') hlEcrire(chemin, rec === null ? null : rec, {cle, sous:id});
    else if(typeof firebaseReady !== 'undefined' && firebaseReady && fbRootRef) fbRootRef.child(chemin).set(rec === null ? null : rec).catch(() => showToast('⚠️ Non synchronisé (vérifiez la connexion)'));
    return true;
  }
};

// Impression des documents du suivi (étiquettes cartons, colisage, liste total) :
// le cadre seul s'imprime mal sur téléphone, on imprime donc depuis cette page.
// Le HTML reçu contient ses propres styles (#pk-doc-zone, @page).
function suiviImprimer(html, titre){
  let zone = document.getElementById('pk-doc-zone');
  if(zone) zone.remove();
  zone = document.createElement('div');
  zone.id = 'pk-doc-zone';
  zone.innerHTML = html;
  document.body.appendChild(zone);
  const avant = document.title;
  const nettoyer = () => { const z = document.getElementById('pk-doc-zone'); if(z) z.remove(); document.title = avant; window.removeEventListener('afterprint', nettoyer); };
  window.addEventListener('afterprint', nettoyer);
  document.title = titre || 'Document';
  setTimeout(() => { window.print(); }, 150);
}

// Bouton « retour » du téléphone : il ferme la fenêtre ouverte par-dessus l'écran (aperçu) au lieu de quitter l'application.
// Renvoie la fonction à appeler pour une fermeture par bouton ; `fermer` retire réellement la fenêtre.
function gtmFenetreRetour(fermer){
  let ouvert = true, pousse = false;
  const surRetour = () => { if(!ouvert) return; ouvert = false; window.removeEventListener('popstate', surRetour); fermer(); };
  try { history.pushState({gtmFenetre:Date.now()}, ''); pousse = true; } catch(e) {}
  window.addEventListener('popstate', surRetour);
  return () => { if(!ouvert) return; if(pousse){ try { history.back(); return; } catch(e) {} } surRetour(); };
}
// Aperçu avant impression d'un document du suivi. Tout est construit et géré ICI (page principale) : avant, les boutons
// appartenaient au cadre du suivi et ne répondaient plus dès que ce cadre était rechargé (bouton Fermer sans effet).
function suiviApercu(full, titre, format, marge){
  const ancien = document.getElementById('pk-apercu'); if(ancien) ancien.remove();
  const pays = /landscape/.test(format), pw = pays ? 297 : 210, ph = pays ? 210 : 297; let zoom = 1, ajuste = true;
  const ov = document.createElement('div'); ov.id = 'pk-apercu'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Aperçu avant impression');
  ov.setAttribute('style', 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;display:flex;flex-direction:column;background:#525659;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif');
  const bar = document.createElement('div');
  bar.setAttribute('style', 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;background:#1F3864;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.3)');
  const t = document.createElement('div'); t.textContent = '👁 ' + String(titre).replace(/_/g, ' ') + ' · A4 ' + (pays ? 'paysage' : 'portrait');
  t.setAttribute('style', 'flex:1 1 200px;min-width:0;font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap');
  bar.appendChild(t);
  const fr = document.createElement('iframe'); fr.title = 'Aperçu'; fr.setAttribute('style', 'flex:1;width:100%;border:0;background:#525659');
  const zone = () => { try { return fr.contentDocument && fr.contentDocument.getElementById('pk-doc-zone'); } catch(e) { return null; } };
  const appliquer = () => { const z = zone(); if(!z) return; if(ajuste){ const px = pw * 96 / 25.4; zoom = Math.max(0.3, Math.min(4, (fr.clientWidth - 28) / px)); } z.style.zoom = String(zoom); };
  const retirer = () => { ov.remove(); document.removeEventListener('keydown', clavier); window.removeEventListener('resize', appliquer); };
  const fermer = gtmFenetreRetour(retirer);
  const clavier = (ev) => { if(ev.key === 'Escape') fermer(); };
  const bouton = (txt, aide, fn, fort) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = aide; b.setAttribute('data-ap', aide);
    b.setAttribute('style', 'border:0;border-radius:10px;padding:8px 14px;min-height:40px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;' + (fort ? 'background:#fff;color:#1F3864' : 'background:rgba(255,255,255,.16);color:#fff'));
    b.addEventListener('click', fn); bar.appendChild(b); return b; };
  bouton('🖨 Imprimer', 'Imprimer', () => suiviImprimer(full, titre), true);
  bouton('−', 'Réduire', () => { ajuste = false; zoom = Math.max(0.3, zoom / 1.2); appliquer(); });
  bouton('↔ Ajuster', 'Ajuster à l\'écran', () => { ajuste = true; appliquer(); });
  bouton('+', 'Agrandir', () => { ajuste = false; zoom = Math.min(4, zoom * 1.2); appliquer(); });
  bouton('✕ Fermer', 'Fermer', fermer);
  ov.appendChild(bar); ov.appendChild(fr); document.body.appendChild(ov);
  ov.tabIndex = -1; try { ov.focus(); } catch(e) {}   // le clavier (Échap) agit sur l'aperçu, pas sur le cadre resté dessous
  fr.addEventListener('load', appliquer);
  fr.srcdoc = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    'html,body{margin:0;padding:0;background:#525659}' +
    '#pk-doc-zone{display:block!important;box-sizing:border-box;width:' + pw + 'mm;min-height:' + ph + 'mm;padding:' + marge + ';margin:14px auto;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.45)}' +
    '#pk-doc-zone .grl-saut,#pk-doc-zone .sec-colis,#pk-doc-zone .sec-total{margin-top:8mm;padding-top:8mm;border-top:3px dashed #9aa4b5}' +
    '#pk-doc-zone .etq-page{margin-bottom:8mm;padding-bottom:8mm;border-bottom:3px dashed #9aa4b5}' +
    '</style></head><body><div id="pk-doc-zone">' + full + '</div></body></html>';
  document.addEventListener('keydown', clavier); window.addEventListener('resize', appliquer);
  return ov;
}

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
// Exosquelette (22/11/2026) : tout se fait chez TEK-TREND, jamais à la GADH. Ses étapes « gadh » / « ret »
// (assemblage et confection chez TEK-TREND) ne comptent ni pour la GADH (rendement, lots chez la GADH) ni dans
// la facture d'assemblage GADH → TEK-TREND.
function suiviHorsGadh(model, lib){ return /EXOSQUELETTE/i.test(String(model || '') + ' ' + String(lib || '')); }
function suiviResume(){
  const docs = suiviLireDocs();
  const lots = (docs.cfg && docs.cfg.lots) || {};
  const qte = {}, qteG = {}, lotDeLigne = {}, exo = {}, etapes = {}, etapesG = {}, ch2 = {};
  Object.keys(docs).forEach(id => {
    const d = docs[id];
    if(id.indexOf('lines-') === 0) (d.lines || []).forEach(a => {
      lotDeLigne[a[0]] = d.lot; qte[d.lot] = (qte[d.lot] || 0) + (a[6] || 0);
      if(suiviHorsGadh(a[3], a[4])) exo[a[0]] = 1; else qteG[d.lot] = (qteG[d.lot] || 0) + (a[6] || 0);
    });
  });
  Object.keys(docs).forEach(id => {
    const d = docs[id];
    if(id.indexOf('moves-') !== 0) return;
    (d.moves || []).forEach(m => {
      const lot = lotDeLigne[m[2]]; if(!lot) return;
      const e = etapes[lot] || (etapes[lot] = {});
      e[m[3]] = (e[m[3]] || 0) + (m[4] || 0);
      if(!exo[m[2]]){ const eg = etapesG[lot] || (etapesG[lot] = {}); eg[m[3]] = (eg[m[3]] || 0) + (m[4] || 0); }
      if(m[9]) ch2[lot] = (ch2[lot] || 0) + (m[6] || 0);   // 2e choix : retiré de la commande
    });
  });
  return Object.keys(qte).map(lot => {
    const e = etapes[lot] || {}, info = lots[lot] || {}, q = Math.max(0, qte[lot] - (ch2[lot] || 0));
    // 20/11/2026 : avancement = pièces contrôlées conformes (les pièces emballées ou expédiées l'ont été), au plus la commande
    const avance = Math.min(q, Math.max(e.ctl || 0, e.emb || 0, e.exp || 0));
    return {lot, qte:q, qteGadh:qteG[lot] || 0, etapes:e, etapesGadh:etapesG[lot] || {}, avance, pct:q > 0 ? Math.min(100, Math.round(avance / q * 100)) : 0, enCours: !info.closed && Math.max(0, q - (e.exp || 0)) > 0};
  });
}
function suiviCommandesEnCours(){ return suiviResume().filter(l => l.enCours).length; }
// Côté GADH : lots dont des pièces envoyées à la GADH ne sont pas encore revenues.
function suiviLotsChezGadh(){
  return suiviResume().filter(l => l.enCours && (l.etapesGadh.gadh || 0) > (l.etapesGadh.ret || 0)).length;
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
      const l = lignes[m[2]]; if(!l || suiviHorsGadh(l.model, l.lib)) return;
      const k = suiviCleRef(l.lib);
      parRef[k] = (parRef[k] || 0) + (m[4] || 0) + (m[6] || 0); // retournées = conformes + NC
    });
  });
  Object.keys(parRef).forEach(k => { if(parRef[k] <= 0) delete parRef[k]; });
  return parRef;
}
// Lots en cours vus par la GADH : pièces commandées et pièces déjà retournées.
function suiviLotsPourGadh(){
  return suiviResume().filter(l => l.enCours && l.qteGadh > 0).map(l => ({
    id:'pk:' + l.lot, numero:l.lot, total:l.qteGadh, retourFait:l.etapesGadh.ret || 0,
    pct: l.qteGadh > 0 ? Math.min(100, Math.round((l.etapesGadh.ret || 0) / l.qteGadh * 100)) : 0
  }));
}

// --- Facturation ---
// Quantités d'une étape (« ret » : retours GADH → TEK, « exp » : expéditions
// PERCKO) entre deux dates incluses, par libellé : { cle : {lib, model, qte} }.
function suiviMouvementsParRef(etape, du, au){
  const {docs, lignes} = suiviLignes(), parRef = {};
  Object.keys(docs).forEach(id => {
    if(id.indexOf('moves-') !== 0) return;
    (docs[id].moves || []).forEach(m => {
      if(m[3] !== etape || m[1] < du || m[1] > au) return;
      if(/^Historique/.test(m[5] || '')) return;   // commande importée déjà expédiée : facturée à part (factures déjà émises)
      const l = lignes[m[2]]; if(!l) return;
      if(etape === 'ret' && suiviHorsGadh(l.model, l.lib)) return;   // exosquelette : confection chez TEK-TREND, pas d'assemblage GADH à facturer
      const k = suiviCleRef(l.lib);
      const r = parRef[k] || (parRef[k] = {lib:l.lib, model:l.model, qte:0});
      r.qte += (m[4] || 0);
    });
  });
  Object.keys(parRef).forEach(k => { if(parRef[k].qte <= 0) delete parRef[k]; });
  return parRef;
}
