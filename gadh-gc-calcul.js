// ============================================================
// GADH — GESTION DES COMMANDES : CALCULS (sans interface)
// ============================================================
// Couche métier du module « Gestion des commandes – Approvisionnement –
// Livraisons – Rentabilité » (gadh-gc-module.js). Aucune lecture ni écriture
// de données ici : chaque fonction reçoit les données (objet D) et rend des
// résultats ou de nouveaux enregistrements, que l'interface enregistre.
// Testée seule sous Node (tests/gc-calcul.js).
//
// D = {articles, fournisseurs, tarifs, demandes, offres, cmdC, cmdF,
//      receptions, livraisons, mouvements, reglages}  (tableaux de fiches {id, …})
//
// Principes
//  - Stock : uniquement des mouvements (jamais un chiffre de stock enregistré).
//    Un mouvement d'entrée crée un lot (identifiant du lot = celui du mouvement) ;
//    les sorties désignent le lot consommé (FIFO : le plus ancien d'abord).
//  - Réservé : réservations − libérations, par ligne de commande client.
//    Disponible = physique − réservé (une quantité réservée pour une commande
//    n'est jamais disponible pour une autre).
//  - Coût réel d'une livraison : figé au moment de la livraison (prix d'achat
//    du lot + frais de la réception répartis + frais de la livraison). Les
//    anciennes livraisons ne changent pas si un prix ou un frais change ensuite.
//  - Tarif de vente par paliers : calculé sur la quantité totale engagée dans
//    l'offre ou la commande (pas sur une livraison partielle).

(function(racine){
  'use strict';
  const EPS = 1e-9;

  // ---------- Outils ----------
  function num(v){
    if(typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(String(v == null ? '' : v).replace(/[\s ]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function liste(v){ return Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === 'object' ? Object.keys(v).map(k => v[k]).filter(x => x != null) : []); }
  function rq(x){ return Math.round(x * 1000) / 1000; }         // quantités : 3 décimales
  function r4(x){ return Math.round(x * 10000) / 10000; }       // coûts unitaires
  function r2(x){ return Math.round(x * 100) / 100; }           // montants
  function parId(l){ const m = {}; liste(l).forEach(x => { if(x && x.id != null) m[x.id] = x; }); return m; }
  function norm(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function normRef(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ''); }
  let compteurId = 0;
  function nouvelId(prefixe){ compteurId = (compteurId + 1) % 1296; return (prefixe || 'x') + Date.now().toString(36) + compteurId.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6); }
  function ajouterJours(d, n){ const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + Math.round(n)); return x.toISOString().slice(0, 10); }
  function ajouterMois(d, n){ const x = new Date(d + 'T12:00:00Z'), j = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + n); const fin = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(j, fin)); return x.toISOString().slice(0, 10); }
  function erreur(msg){ const e = new Error(msg); e.gc = true; return e; }

  // ---------- Libellés ----------
  const OFFRE_STATUTS = {brouillon:{label:'Brouillon', cls:''}, envoyee:{label:'Envoyée', cls:'warn'}, acceptee:{label:'Acceptée', cls:'good'}, refusee:{label:'Refusée', cls:'bad'}, expiree:{label:'Expirée', cls:'bad'}};
  const CMDC_STATUTS = {brouillon:{label:'Brouillon', cls:''}, confirmee:{label:'À livrer', cls:'warn'}, partielle:{label:'Livrée en partie', cls:'warn'}, livree:{label:'Livrée', cls:'good'}, cloturee:{label:'Clôturée', cls:''}, annulee:{label:'Annulée', cls:''}};
  const CMDF_STATUTS = {brouillon:{label:'Brouillon', cls:''}, validee:{label:'Validée', cls:'warn'}, envoyee:{label:'Envoyée', cls:'warn'}, confirmee:{label:'Confirmée', cls:'warn'}, partielle:{label:'Reçue en partie', cls:'warn'}, recue:{label:'Reçue', cls:'good'}, cloturee:{label:'Clôturée', cls:''}, annulee:{label:'Annulée', cls:''}};
  // Mouvements de stock. lot : 'nouveau' = crée un lot ; 'existant' = agit sur le lot indiqué (lotId) ; null = pas de lot (réservations).
  const TYPES_MV = {
    entree:            {sens: 1, lot:'nouveau',  label:'Entrée fournisseur'},
    initial:           {sens: 1, lot:'nouveau',  label:'Stock initial'},
    ajustement_plus:   {sens: 1, lot:'nouveau',  label:'Ajustement (+)'},
    inventaire_plus:   {sens: 1, lot:'nouveau',  label:'Inventaire (+)'},
    ajustement_moins:  {sens:-1, lot:'existant', label:'Ajustement (−)'},
    inventaire_moins:  {sens:-1, lot:'existant', label:'Inventaire (−)'},
    sortie:            {sens:-1, lot:'existant', label:'Sortie livraison client'},
    annulation_sortie: {sens: 1, lot:'existant', label:'Annulation de livraison'},
    retour_client:     {sens: 1, lot:'existant', label:'Retour client'},
    retour_fournisseur:{sens:-1, lot:'existant', label:'Retour fournisseur'},
    annulation_entree: {sens:-1, lot:'existant', label:'Annulation de réception'},
    reservation:       {sens: 0, lot:null,       label:'Réservation'},
    liberation:        {sens: 0, lot:null,       label:'Libération de réservation'}
  };
  const METHODES_FRAIS = {quantite:'Au prorata des quantités', valeur:'Au prorata de la valeur'};

  function ordreMv(a, b){ return (a.date || '').localeCompare(b.date || '') || (num(a.ts) - num(b.ts)) || String(a.id).localeCompare(String(b.id)); }
  function suiviStock(a){ return !!a && a.suiviStock !== false; }

  // ---------- Numérotation (d'après les numéros existants : pas de compteur partagé) ----------
  function numeroSuivant(fiches, prefixe, date){
    const an = String(date || new Date().toISOString()).slice(0, 4), re = new RegExp('^' + prefixe + '-' + an + '-(\\d+)$');
    let max = 0;
    liste(fiches).forEach(f => { const m = re.exec(f && f.numero || ''); if(m) max = Math.max(max, parseInt(m[1], 10)); });
    return prefixe + '-' + an + '-' + String(max + 1).padStart(3, '0');
  }

  // ---------- Tarifs ----------
  // Prix de vente selon la quantité totale engagée : palier le plus haut atteint, sinon prix de vente de base.
  function prixPalier(article, qteTotale){
    const base = {prix:num(article && article.prixVente), palier:null};
    const p = liste(article && article.paliers).filter(x => num(x.min) > 0 && num(x.prix) > 0).sort((a, b) => num(a.min) - num(b.min));
    let r = base;
    p.forEach((x, i) => { if(num(qteTotale) + EPS >= num(x.min)) r = {prix:num(x.prix), palier:i, min:num(x.min)}; });
    return r;
  }
  function paliersValides(paliers){
    const p = liste(paliers).map(x => ({min:num(x.min), prix:num(x.prix)})).filter(x => x.min > 0 || x.prix > 0);
    for(const x of p){ if(x.min <= 0) return 'Chaque palier doit avoir une quantité minimale supérieure à 0'; if(x.prix <= 0) return 'Chaque palier doit avoir un prix supérieur à 0'; }
    const mins = p.map(x => x.min);
    if(new Set(mins).size !== mins.length) return 'Deux paliers ont la même quantité minimale';
    return '';
  }
  // Quantité engagée par article dans un document (somme des lignes du même article).
  function qtesEngagees(lignes){ const q = {}; liste(lignes).forEach(l => { if(l.articleId) q[l.articleId] = (q[l.articleId] || 0) + num(l.qte); }); return q; }
  // Applique les paliers aux lignes d'un document (sauf prix saisi à la main : puManuel).
  function appliquerPaliers(lignes, articles){
    const A = parId(articles), q = qtesEngagees(lignes);
    return liste(lignes).map(l => {
      if(!l.articleId || l.puManuel || !A[l.articleId]) return l;
      const p = prixPalier(A[l.articleId], q[l.articleId]);
      return Object.assign({}, l, {pu:p.prix, palier:p.palier});
    });
  }
  function totaux(doc){
    let brut = 0, remises = 0;
    liste(doc && doc.lignes).forEach(l => { const b = num(l.qte) * num(l.pu); brut += b; remises += b * num(l.remise) / 100; });
    const ht1 = brut - remises, rg = ht1 * num(doc && doc.remise) / 100, ht = ht1 - rg;
    const tva = ht * num(doc && doc.tva) / 100;
    return {brut:r2(brut), remises:r2(remises + rg), ht:r2(ht), tva:r2(tva), ttc:r2(ht + tva)};
  }
  function montantLigne(l){ return num(l.qte) * num(l.pu) * (1 - num(l.remise) / 100); }
  // Tarif d'achat : tarif négocié valable (fournisseur, quantité, période), sinon prix d'achat de l'article.
  function tarifsValables(D, articleId, fournisseurId, qte, date){
    const d = date || '';
    return liste(D.tarifs).filter(t => !t.archive && t.articleId === articleId && (!fournisseurId || t.fournisseurId === fournisseurId)
      && num(qte) + EPS >= num(t.qteMin) && (!t.debut || !d || t.debut <= d) && (!t.fin || !d || t.fin >= d) && num(t.prix) > 0);
  }
  function tarifAchat(D, articleId, fournisseurId, qte, date){
    const l = tarifsValables(D, articleId, fournisseurId, qte, date).sort((a, b) => num(a.prix) - num(b.prix) || num(b.qteMin) - num(a.qteMin));
    if(l.length) return {prix:num(l[0].prix), tarifId:l[0].id, source:'tarif', delai:num(l[0].delai) || null, refFournisseur:l[0].refFournisseur || ''};
    const a = parId(D.articles)[articleId];
    return {prix:num(a && a.prixAchat), tarifId:null, source:'article', delai:null, refFournisseur:''};
  }
  // Comparaison des fournisseurs pour un article (meilleur prix valable de chacun).
  function comparerFournisseurs(D, articleId, qte, date){
    const F = parId(D.fournisseurs), ids = new Set();
    liste(D.tarifs).forEach(t => { if(t.articleId === articleId && !t.archive) ids.add(t.fournisseurId); });
    const a = parId(D.articles)[articleId]; if(a && a.fournisseurId) ids.add(a.fournisseurId);
    const r = [];
    ids.forEach(fid => {
      const f = F[fid]; if(!f || f.archive) return;
      const t = tarifsValables(D, articleId, fid, qte, date).sort((x, y) => num(x.prix) - num(y.prix))[0];
      const prix = t ? num(t.prix) : (a && a.fournisseurId === fid ? num(a.prixAchat) : 0);
      if(prix <= 0) return;
      r.push({fournisseurId:fid, nom:f.nom, prix, total:r2(prix * num(qte)), delai:num(t && t.delai) || num(f.delai) || null, source:t ? 'tarif' : 'article', principal:!!(a && a.fournisseurId === fid), refFournisseur:(t && t.refFournisseur) || ''});
    });
    r.sort((x, y) => x.prix - y.prix || (x.delai || 999) - (y.delai || 999));
    if(r.length) r[0].meilleur = true;
    return r;
  }
  function delaiFournisseur(D, fournisseurId, articleId, defaut){
    const t = articleId ? tarifsValables(D, articleId, fournisseurId, 1e12, '').find(x => num(x.delai) > 0) : null;
    if(t) return num(t.delai);
    const f = parId(D.fournisseurs)[fournisseurId];
    return num(f && f.delai) || num(defaut) || 7;
  }

  // ---------- Frais de réception (répartition) ----------
  // Frais unitaire par ligne de réception, selon la méthode de chaque frais (quantité ou valeur).
  function fraisReception(rec){
    const lignes = liste(rec && rec.lignes), parLigne = lignes.map(() => 0);
    let total = 0, estime = false;
    liste(rec && rec.frais).forEach(f => {
      const m = num(f.montant); if(!m) return;
      total += m; if(f.statut === 'estime') estime = true;
      const bases = lignes.map(l => num(l.qte) > 0 ? (f.methode === 'valeur' ? num(l.qte) * num(l.pu) : num(l.qte)) : 0);
      let somme = bases.reduce((s, x) => s + x, 0), b = bases;
      if(somme <= 0){ b = lignes.map(l => Math.max(0, num(l.qte))); somme = b.reduce((s, x) => s + x, 0); }
      if(somme <= 0) return;
      lignes.forEach((l, i) => { if(num(l.qte) > 0) parLigne[i] += m * b[i] / somme / num(l.qte); });
    });
    return {total:r2(total), parLigne:parLigne.map(r4), estime};
  }

  // ---------- Stock ----------
  function lots(D, articleId){
    const mv = liste(D.mouvements).slice().sort(ordreMv), L = {}, out = [];
    const recs = parId(D.receptions), fraisRec = {};
    mv.forEach(m => {
      const t = TYPES_MV[m.type]; if(!t || t.lot !== 'nouveau' || (articleId && m.articleId !== articleId)) return;
      let fraisUnit = 0, estime = false;
      if(m.receptionId && recs[m.receptionId]){
        const f = fraisRec[m.receptionId] || (fraisRec[m.receptionId] = fraisReception(recs[m.receptionId]));
        fraisUnit = f.parLigne[m.rl] || 0; estime = f.estime && fraisUnit > 0;
      }
      L[m.id] = {id:m.id, articleId:m.articleId, date:m.date, ts:num(m.ts), type:m.type, code:m.lot || '', qteInit:num(m.qte), reste:num(m.qte),
        coutUnit:num(m.coutUnit), fraisUnit, fraisEstime:estime, coutComplet:r4(num(m.coutUnit) + fraisUnit), receptionId:m.receptionId || '', fournisseurId:m.fournisseurId || ''};
      out.push(L[m.id]);
    });
    mv.forEach(m => { const t = TYPES_MV[m.type]; if(!t || t.lot !== 'existant') return; const l = L[m.lotId]; if(l) l.reste = rq(l.reste + t.sens * num(m.qte)); });
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.ts - b.ts || String(a.id).localeCompare(String(b.id)));
  }
  function cleLigne(cmdId, lid){ return cmdId + '|' + lid; }
  // Réservé ouvert par ligne de commande client.
  function reservations(D){
    const r = {};
    liste(D.mouvements).forEach(m => {
      if(m.type !== 'reservation' && m.type !== 'liberation') return;
      const k = cleLigne(m.cmdId, m.lid); r[k] = rq((r[k] || 0) + (m.type === 'reservation' ? 1 : -1) * num(m.qte));
    });
    Object.keys(r).forEach(k => { if(r[k] < EPS) r[k] = 0; });
    return r;
  }
  // Livré net (livraisons validées − retours) par ligne de commande client.
  function livres(D){
    const r = {};
    liste(D.livraisons).forEach(b => {
      if(b.annulee) return;
      liste(b.lignes).forEach(l => { const k = cleLigne(b.cmdId, l.lid); r[k] = rq((r[k] || 0) + num(l.qte) - liste(l.retours).reduce((s, x) => s + num(x.qte), 0)); });
    });
    return r;
  }
  // Reçu par ligne de commande fournisseur.
  function recus(D){
    const r = {};
    liste(D.receptions).forEach(x => { if(x.annulee) return; liste(x.lignes).forEach(l => { const k = cleLigne(x.cfId, l.lid); r[k] = rq((r[k] || 0) + num(l.qte)); }); });
    return r;
  }
  const CMDC_OUVERTE = {confirmee:1, partielle:1};
  const CMDF_OUVERTE = {validee:1, envoyee:1, confirmee:1, partielle:1};
  function stocks(D){
    const A = liste(D.articles), S = {};
    const s = (id) => S[id] || (S[id] = {physique:0, reserve:0, disponible:0, attente:0, demande:0, aApprovisionner:0, valeur:0});
    lots(D).forEach(l => { const x = s(l.articleId); x.physique = rq(x.physique + l.reste); x.valeur += Math.max(0, l.reste) * l.coutComplet; });
    const res = reservations(D), liv = livres(D), rec = recus(D);
    liste(D.cmdC).forEach(c => {
      const st = statutCmdC(c, liv).cle;
      liste(c.lignes).forEach(l => {
        if(!l.articleId) return;
        const k = cleLigne(c.id, l.lid), r = res[k] || 0;
        s(l.articleId).reserve = rq(s(l.articleId).reserve + r);
        if(CMDC_OUVERTE[st]) s(l.articleId).demande = rq(s(l.articleId).demande + Math.max(0, num(l.qte) - (liv[k] || 0)));
      });
    });
    liste(D.cmdF).forEach(f => {
      const st = statutCmdF(f, rec).cle; if(!CMDF_OUVERTE[st]) return;
      liste(f.lignes).forEach(l => { if(l.articleId) s(l.articleId).attente = rq(s(l.articleId).attente + Math.max(0, num(l.qte) - (rec[cleLigne(f.id, l.lid)] || 0))); });
    });
    A.forEach(a => {
      const x = s(a.id);
      x.disponible = rq(x.physique - x.reserve);
      x.aApprovisionner = suiviStock(a) ? rq(Math.max(0, (x.demande - x.reserve) + num(a.seuil) - x.disponible - x.attente)) : 0;
      x.sousSeuil = suiviStock(a) && num(a.seuil) > 0 && x.disponible <= num(a.seuil) + EPS;
      x.rupture = suiviStock(a) && x.disponible <= EPS && (x.demande > x.reserve + EPS || num(a.seuil) > 0);
      x.valeur = r2(x.valeur);
    });
    return S;
  }
  function stockArticle(D, articleId){ return stocks(D)[articleId] || {physique:0, reserve:0, disponible:0, attente:0, demande:0, aApprovisionner:0, valeur:0}; }
  // FIFO : prend dans les lots les plus anciens.
  function allouerFIFO(lotsArticle, qte){
    let reste = num(qte); const r = [];
    for(const l of lotsArticle){
      if(reste <= EPS) break;
      if(l.reste <= EPS) continue;
      const q = rq(Math.min(reste, l.reste));
      r.push({lotId:l.id, qte:q, coutUnit:l.coutUnit, fraisUnit:l.fraisUnit, fraisEstime:!!l.fraisEstime, dateLot:l.date, code:l.code || ''});
      reste = rq(reste - q);
    }
    if(reste > EPS) throw erreur('Stock physique insuffisant (manque ' + rq(reste) + ')');
    return r;
  }

  // ---------- Statuts ----------
  function statutOffre(o, aujourdhui){
    let s = o.statut || 'brouillon';
    if((s === 'brouillon' || s === 'envoyee') && o.validite && aujourdhui && o.validite < aujourdhui) s = 'expiree';
    return Object.assign({cle:s}, OFFRE_STATUTS[s] || OFFRE_STATUTS.brouillon);
  }
  function statutCmdC(c, liv){
    const s = c.statut || 'brouillon';
    if(s === 'brouillon' || s === 'annulee' || s === 'cloturee') return Object.assign({cle:s}, CMDC_STATUTS[s]);
    const L = liste(c.lignes).filter(l => num(l.qte) > 0);
    let tout = L.length > 0, un = false;
    L.forEach(l => { const q = (liv || {})[cleLigne(c.id, l.lid)] || 0; if(q + EPS < num(l.qte)) tout = false; if(q > EPS) un = true; });
    const cle = tout ? 'livree' : un ? 'partielle' : 'confirmee';
    return Object.assign({cle}, CMDC_STATUTS[cle]);
  }
  function statutCmdF(f, rec){
    const s = f.statut || 'brouillon';
    if(s === 'brouillon' || s === 'annulee' || s === 'cloturee') return Object.assign({cle:s}, CMDF_STATUTS[s]);
    const L = liste(f.lignes).filter(l => num(l.qte) > 0);
    let tout = L.length > 0, un = false;
    L.forEach(l => { const q = (rec || {})[cleLigne(f.id, l.lid)] || 0; if(q + EPS < num(l.qte)) tout = false; if(q > EPS) un = true; });
    const cle = tout ? 'recue' : un ? 'partielle' : s;
    return Object.assign({cle}, CMDF_STATUTS[cle]);
  }
  function enRetardCmdF(f, rec, aujourdhui){
    const st = statutCmdF(f, rec).cle;
    return !!(CMDF_OUVERTE[st] && f.datePrevue && aujourdhui && f.datePrevue < aujourdhui);
  }

  // ---------- Commandes annuelles : échéances ----------
  function genererEcheances(lignes, debut, nombre, moisEntre){
    const n = Math.max(1, Math.round(num(nombre))), pas = Math.max(1, Math.round(num(moisEntre) || 1)), E = [];
    for(let i = 0; i < n; i++) E.push({id:'e' + (i + 1), date:ajouterMois(debut, i * pas), qtes:{}});
    liste(lignes).forEach(l => {
      const tot = num(l.qte), part = Math.floor(tot / n * 1000) / 1000;
      let cumul = 0;
      E.forEach((e, i) => { const q = i === n - 1 ? rq(tot - cumul) : part; e.qtes[l.lid] = q; cumul = rq(cumul + q); });
    });
    return E;
  }
  // Suivi des échéances : livré attribué aux échéances dans l'ordre des dates.
  function suiviEcheances(c, liv, aujourdhui){
    const E = liste(c.echeances).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const restant = {};
    liste(c.lignes).forEach(l => { restant[l.lid] = (liv || {})[cleLigne(c.id, l.lid)] || 0; });
    return E.map(e => {
      let prevu = 0, livre = 0;
      const lignes = liste(c.lignes).map(l => {
        const p = num((e.qtes || {})[l.lid]), d = Math.min(p, Math.max(0, restant[l.lid] || 0));
        restant[l.lid] = rq((restant[l.lid] || 0) - d); prevu += p; livre += d;
        return {lid:l.lid, articleId:l.articleId, designation:l.designation, prevu:p, livre:rq(d), reste:rq(p - d)};
      });
      const reste = rq(prevu - livre);
      const cle = reste <= EPS ? 'livree' : (aujourdhui && e.date < aujourdhui ? 'retard' : (livre > EPS ? 'partielle' : 'a_venir'));
      return {id:e.id, date:e.date, prevu:rq(prevu), livre:rq(livre), reste, cle, lignes};
    });
  }
  function echeancesValides(c){
    if(c.type !== 'annuelle') return '';
    const E = liste(c.echeances);
    if(!E.length) return 'Une commande annuelle doit avoir au moins une échéance';
    for(const e of E) if(!e.date) return 'Chaque échéance doit avoir une date';
    for(const l of liste(c.lignes)){
      const s = E.reduce((t, e) => t + num((e.qtes || {})[l.lid]), 0);
      if(s > num(l.qte) + EPS) return 'Les échéances dépassent la quantité prévue de « ' + (l.designation || '') + ' » (' + rq(s) + ' > ' + num(l.qte) + ')';
    }
    return '';
  }
  // Retard d'une commande client (date souhaitée dépassée ou échéance en retard).
  function retardCmdC(c, liv, aujourdhui){
    const st = statutCmdC(c, liv).cle; if(!CMDC_OUVERTE[st]) return false;
    if(c.type === 'annuelle' && liste(c.echeances).length) return suiviEcheances(c, liv, aujourdhui).some(e => e.cle === 'retard');
    return !!(c.dateSouhaitee && aujourdhui && c.dateSouhaitee < aujourdhui);
  }

  // ---------- Calcul des besoins nets ----------
  function besoins(D, aujourdhui, opts){
    opts = opts || {};
    const A = parId(D.articles), res = reservations(D), liv = livres(D), rec = recus(D), S = stocks(D);
    const evts = [];
    liste(D.cmdC).forEach(c => {
      if(!CMDC_OUVERTE[statutCmdC(c, liv).cle]) return;
      const base = {cmdId:c.id, numero:c.numero, clientId:c.clientId};
      if(c.type === 'annuelle' && liste(c.echeances).length){
        const se = suiviEcheances(c, liv, aujourdhui), planifie = {};
        se.forEach(e => e.lignes.forEach(l => { planifie[l.lid] = (planifie[l.lid] || 0) + l.prevu; if(l.reste > EPS && l.articleId) evts.push(Object.assign({}, base, {lid:l.lid, articleId:l.articleId, date:e.date, qte:l.reste, echeance:e.id})); }));
        const derniere = se.length ? se[se.length - 1].date : (c.dateSouhaitee || c.date);
        liste(c.lignes).forEach(l => {
          const hors = rq(num(l.qte) - (planifie[l.lid] || 0)), dejaHors = Math.max(0, (liv[cleLigne(c.id, l.lid)] || 0) - (planifie[l.lid] || 0)), r = rq(hors - dejaHors);
          if(r > EPS && l.articleId) evts.push(Object.assign({}, base, {lid:l.lid, articleId:l.articleId, date:c.dateSouhaitee || derniere, qte:r}));
        });
      } else {
        liste(c.lignes).forEach(l => {
          const r = rq(num(l.qte) - (liv[cleLigne(c.id, l.lid)] || 0));
          if(r > EPS && l.articleId) evts.push(Object.assign({}, base, {lid:l.lid, articleId:l.articleId, date:c.dateSouhaitee || c.date || aujourdhui, qte:r}));
        });
      }
    });
    // Réceptions attendues par article (dans l'ordre des dates prévues)
    const attendus = {};
    liste(D.cmdF).forEach(f => {
      if(!CMDF_OUVERTE[statutCmdF(f, rec).cle]) return;
      liste(f.lignes).forEach(l => {
        const r = rq(num(l.qte) - (rec[cleLigne(f.id, l.lid)] || 0));
        if(r > EPS && l.articleId) (attendus[l.articleId] = attendus[l.articleId] || []).push({cfId:f.id, numero:f.numero, date:f.datePrevue || '', qte:r});
      });
    });
    Object.keys(attendus).forEach(k => attendus[k].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')));
    const parArticle = {}, lignes = [];
    const ids = new Set(evts.map(e => e.articleId));
    liste(D.articles).forEach(a => { if(suiviStock(a) && !a.archive && a.actif !== false && num(a.seuil) > 0) ids.add(a.id); });
    ids.forEach(aid => {
      const a = A[aid]; if(!a || !suiviStock(a)) return;
      const s = S[aid] || {physique:0, reserve:0, disponible:0, attente:0};
      let libre = Math.max(0, s.disponible);
      const pool = {}, file = (attendus[aid] || []).map(x => Object.assign({}, x));
      const E = evts.filter(e => e.articleId === aid).sort((x, y) => (x.date || '').localeCompare(y.date || ''));
      E.forEach(e => { const k = cleLigne(e.cmdId, e.lid); if(pool[k] === undefined) pool[k] = res[k] || 0; });
      const fid = a.fournisseurId || ((comparerFournisseurs(D, aid, 1, aujourdhui)[0] || {}).fournisseurId) || '';
      const delai = delaiFournisseur(D, fid, aid, opts.delaiDefaut);
      let tot = {besoin:0, reserve:0, stock:0, attente:0, manquant:0};
      E.forEach(e => {
        const k = cleLigne(e.cmdId, e.lid);
        let reste = e.qte;
        const cr = Math.min(reste, pool[k]); pool[k] = rq(pool[k] - cr); reste = rq(reste - cr);
        const cs = Math.min(reste, libre); libre = rq(libre - cs); reste = rq(reste - cs);
        let ca = 0, tard = false, datesAttente = [];
        while(reste > EPS && file.length){
          const r = file[0], q = Math.min(reste, r.qte);
          r.qte = rq(r.qte - q); reste = rq(reste - q); ca = rq(ca + q);
          datesAttente.push(r.numero); if(!r.date || r.date > e.date) tard = true;
          if(r.qte <= EPS) file.shift();
        }
        const dateCommande = ajouterJours(e.date, -delai);
        const urgence = reste > EPS ? (dateCommande <= aujourdhui ? 'urgent' : 'a_commander') : (tard ? 'risque' : 'couvert');
        lignes.push(Object.assign({}, e, {couvertReserve:rq(cr), couvertStock:rq(cs), couvertAttente:ca, manquant:rq(reste), receptions:datesAttente, dateCommande, urgence}));
        tot.besoin += e.qte; tot.reserve += cr; tot.stock += cs; tot.attente += ca; tot.manquant += reste;
      });
      const resteAttente = file.reduce((t, x) => t + x.qte, 0);
      const reappro = num(a.seuil) > 0 ? Math.max(0, num(a.seuil) - libre - resteAttente) : 0;
      const premier = lignes.filter(l => l.articleId === aid && l.manquant > EPS)[0];
      const aCommander = rq(tot.manquant + reappro);
      if(!E.length && aCommander <= EPS) return;
      parArticle[aid] = {articleId:aid, ref:a.ref || '', designation:a.designation || '', unite:a.unite || '', physique:s.physique, reserve:s.reserve, disponible:s.disponible, attente:s.attente,
        besoin:rq(tot.besoin), couvertReserve:rq(tot.reserve), couvertStock:rq(tot.stock), couvertAttente:rq(tot.attente), manquant:rq(tot.manquant), reappro:rq(reappro), aCommander,
        dateBesoin:premier ? premier.date : '', dateCommande:premier ? premier.dateCommande : (reappro > EPS ? aujourdhui : ''), fournisseurId:fid, delai,
        urgence:lignes.some(l => l.articleId === aid && l.urgence === 'urgent') ? 'urgent' : aCommander > EPS ? 'a_commander' : lignes.some(l => l.articleId === aid && l.urgence === 'risque') ? 'risque' : 'couvert'};
    });
    const ordre = {urgent:0, a_commander:1, risque:2, couvert:3};
    return {lignes:lignes.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      articles:Object.values(parArticle).sort((a, b) => ordre[a.urgence] - ordre[b.urgence] || (a.dateCommande || '9999').localeCompare(b.dateCommande || '9999'))};
  }
  // Commandes fournisseurs (brouillons) à partir d'une sélection de besoins [{articleId, qte, fournisseurId}].
  function commandesDepuisBesoins(D, selection, date, numeros){
    const A = parId(D.articles), groupes = {};
    liste(selection).forEach(s => {
      if(!s.articleId || num(s.qte) <= 0) return;
      if(!s.fournisseurId) throw erreur('Choisissez le fournisseur de « ' + ((A[s.articleId] || {}).designation || s.articleId) + ' »');
      (groupes[s.fournisseurId] = groupes[s.fournisseurId] || []).push(s);
    });
    const deja = liste(D.cmdF).slice(), res = [];
    Object.keys(groupes).forEach(fid => {
      let delai = 0;
      const lignes = groupes[fid].map((s, i) => {
        const a = A[s.articleId] || {}, t = tarifAchat(D, s.articleId, fid, s.qte, date);
        delai = Math.max(delai, t.delai || delaiFournisseur(D, fid, s.articleId));
        return {lid:'l' + (i + 1), articleId:s.articleId, ref:a.ref || '', designation:a.designation || '', unite:a.unite || '', qte:rq(num(s.qte)), pu:t.prix, refFournisseur:t.refFournisseur || ''};
      });
      const numero = numeros === false ? '' : numeroSuivant(deja, 'CF', date);
      const cf = {id:nouvelId('cf'), numero, fournisseurId:fid, date, datePrevue:ajouterJours(date, delai || 7), statut:'brouillon', lignes, fraisPrevus:0, tva:0, paiements:[], origine:'besoins'};
      deja.push(cf); res.push(cf);
    });
    return res;
  }

  // ---------- Opérations (rendent les fiches à enregistrer) ----------
  function contexte(o){ return {date:o && o.date || new Date().toISOString().slice(0, 10), ts:o && o.ts || Date.now(), par:o && o.par || ''}; }
  function mv(type, champs, ctx){ return Object.assign({id:nouvelId('mv'), type, date:ctx.date, ts:ctx.ts, par:ctx.par}, champs); }

  // Réception (partielle ou complète) d'une commande fournisseur.
  function receptionner(D, cfId, saisies, opts){
    const ctx = contexte(opts), cf = parId(D.cmdF)[cfId]; if(!cf) throw erreur('Commande fournisseur introuvable');
    const rec = recus(D), st = statutCmdF(cf, rec).cle;
    if(!CMDF_OUVERTE[st]) throw erreur(st === 'brouillon' ? 'Validez d\'abord la commande fournisseur' : 'Cette commande ne peut plus être reçue (' + CMDF_STATUTS[st].label.toLowerCase() + ')');
    const A = parId(D.articles), L = parId(liste(cf.lignes).map(l => Object.assign({id:l.lid}, l)));
    const lignes = [];
    liste(saisies).forEach(s => {
      const q = rq(num(s.qte)); if(q === 0) return;
      if(q < 0) throw erreur('Quantité reçue négative');
      const l = L[s.lid]; if(!l) throw erreur('Ligne inconnue');
      const reste = rq(num(l.qte) - (rec[cleLigne(cfId, l.lid)] || 0));
      if(q > reste + EPS) throw erreur('« ' + (l.designation || '') + ' » : ' + q + ' reçu(s) pour ' + reste + ' restant(s) à recevoir');
      lignes.push({lid:l.lid, articleId:l.articleId || '', designation:l.designation || '', unite:l.unite || '', qte:q, pu:s.pu !== undefined && s.pu !== '' ? num(s.pu) : num(l.pu), lot:s.lot || ''});
    });
    if(!lignes.length) throw erreur('Saisissez au moins une quantité reçue');
    const frais = liste(opts && opts.frais).filter(f => num(f.montant) > 0).map(f => ({id:f.id || nouvelId('fr'), libelle:f.libelle || 'Frais', nature:f.nature || 'transport', montant:r2(num(f.montant)), methode:f.methode === 'valeur' ? 'valeur' : 'quantite', statut:f.statut === 'estime' ? 'estime' : 'reel'}));
    const reception = {id:nouvelId('br'), numero:opts && opts.numero || numeroSuivant(D.receptions, 'BR', ctx.date), cfId, fournisseurId:cf.fournisseurId, date:ctx.date, ts:ctx.ts, par:ctx.par,
      reference:opts && opts.reference || '', lignes, frais, note:opts && opts.note || ''};
    const mouvements = [];
    lignes.forEach((l, i) => { if(l.articleId && suiviStock(A[l.articleId])) mouvements.push(mv('entree', {articleId:l.articleId, qte:l.qte, coutUnit:l.pu, receptionId:reception.id, rl:i, lot:l.lot || reception.numero, fournisseurId:cf.fournisseurId, motif:'Réception ' + reception.numero + ' (' + (cf.numero || '') + ')'}, ctx)); });
    const totalRecu = Object.assign({}, rec); lignes.forEach(l => { const k = cleLigne(cfId, l.lid); totalRecu[k] = rq((totalRecu[k] || 0) + l.qte); });
    return {reception, mouvements, statut:statutCmdF(cf, totalRecu).cle};
  }
  function annulerReception(D, recId, opts){
    const ctx = contexte(opts), r = parId(D.receptions)[recId]; if(!r) throw erreur('Réception introuvable');
    if(r.annulee) throw erreur('Réception déjà annulée');
    const L = lots(D).filter(l => l.receptionId === recId);
    const touche = L.find(l => l.reste + EPS < l.qteInit);
    if(touche) throw erreur('Une partie de cette réception est déjà sortie du stock : annulation impossible (faites un retour fournisseur)');
    const S = stocks(D), parArt = {};
    L.forEach(l => { parArt[l.articleId] = (parArt[l.articleId] || 0) + l.reste; });
    Object.keys(parArt).forEach(aid => { if((S[aid] || {}).disponible + EPS < parArt[aid]) throw erreur('Ces quantités sont réservées pour des commandes clients : libérez-les d\'abord'); });
    const mouvements = L.filter(l => l.reste > EPS).map(l => mv('annulation_entree', {articleId:l.articleId, lotId:l.id, qte:l.reste, receptionId:recId, motif:'Annulation ' + r.numero + (opts && opts.motif ? ' : ' + opts.motif : '')}, ctx));
    return {reception:Object.assign({}, r, {annulee:{date:ctx.date, ts:ctx.ts, par:ctx.par, motif:opts && opts.motif || ''}}), mouvements};
  }
  function ligneCmd(c, lid){ return liste(c && c.lignes).find(l => l.lid === lid); }
  function reserver(D, cmdId, lid, qte, opts){
    const ctx = contexte(opts), c = parId(D.cmdC)[cmdId]; if(!c) throw erreur('Commande introuvable');
    const liv = livres(D); if(!CMDC_OUVERTE[statutCmdC(c, liv).cle]) throw erreur('La commande doit être confirmée et non soldée');
    const l = ligneCmd(c, lid); if(!l || !l.articleId) throw erreur('Ligne sans article du catalogue');
    const q = rq(num(qte)); if(q <= 0) throw erreur('Quantité à réserver invalide');
    const k = cleLigne(cmdId, lid), deja = reservations(D)[k] || 0, resteLivrer = rq(num(l.qte) - (liv[k] || 0));
    if(q > rq(resteLivrer - deja) + EPS) throw erreur('Réservation supérieure au reste à livrer non réservé (' + rq(resteLivrer - deja) + ')');
    const dispo = stockArticle(D, l.articleId).disponible;
    if(q > dispo + EPS) throw erreur('Stock disponible insuffisant (' + rq(dispo) + ' disponible)');
    return [mv('reservation', {articleId:l.articleId, cmdId, lid, qte:q, motif:'Réservation ' + (c.numero || '')}, ctx)];
  }
  function liberer(D, cmdId, lid, qte, opts){
    const ctx = contexte(opts), c = parId(D.cmdC)[cmdId]; if(!c) throw erreur('Commande introuvable');
    const l = ligneCmd(c, lid); if(!l) throw erreur('Ligne introuvable');
    const deja = reservations(D)[cleLigne(cmdId, lid)] || 0, q = qte === undefined ? deja : rq(num(qte));
    if(q <= 0) throw erreur('Rien à libérer');
    if(q > deja + EPS) throw erreur('Libération supérieure au réservé (' + deja + ')');
    return [mv('liberation', {articleId:l.articleId, cmdId, lid, qte:q, motif:(opts && opts.motif) || 'Libération ' + (c.numero || '')}, ctx)];
  }
  // Réserve tout ce qui est possible pour une commande (reste à livrer non réservé, dans la limite du disponible).
  function reserverTout(D, cmdId, opts){
    const c = parId(D.cmdC)[cmdId]; if(!c) throw erreur('Commande introuvable');
    const liv = livres(D), res = reservations(D), S = stocks(D), out = [];
    liste(c.lignes).forEach(l => {
      if(!l.articleId || !S[l.articleId]) return;
      const k = cleLigne(cmdId, l.lid), besoin = rq(num(l.qte) - (liv[k] || 0) - (res[k] || 0)), q = rq(Math.min(besoin, S[l.articleId].disponible));
      if(q > EPS){ out.push(reserver(Object.assign({}, D, {mouvements:liste(D.mouvements).concat(out)}), cmdId, l.lid, q, opts)[0]); }
    });
    return out;
  }
  // Livraison (partielle ou totale) d'une commande client : sorties FIFO, libération du réservé, coûts figés.
  function livrer(D, cmdId, saisies, opts){
    const ctx = contexte(opts), c = parId(D.cmdC)[cmdId]; if(!c) throw erreur('Commande introuvable');
    const liv = livres(D); if(!CMDC_OUVERTE[statutCmdC(c, liv).cle]) throw erreur('Cette commande n\'est pas à livrer');
    const A = parId(D.articles), res = reservations(D), S = stocks(D), tousLots = lots(D);
    const conso = {}, lignes = [], mouvements = [], dispoUtilise = {};
    liste(saisies).forEach(s => {
      const q = rq(num(s.qte)); if(q === 0) return;
      if(q < 0) throw erreur('Quantité livrée négative');
      const l = ligneCmd(c, s.lid); if(!l) throw erreur('Ligne inconnue');
      const k = cleLigne(cmdId, l.lid), reste = rq(num(l.qte) - (liv[k] || 0));
      if(q > reste + EPS) throw erreur('« ' + (l.designation || '') + ' » : ' + q + ' à livrer pour ' + reste + ' restant(s)');
      const a = A[l.articleId], ligne = {lid:l.lid, articleId:l.articleId || '', ref:l.ref || (a && a.ref) || '', designation:l.designation || '', unite:l.unite || '', qte:q, pu:num(l.pu), remise:num(l.remise), allocations:[], retours:[]};
      if(a && suiviStock(a)){
        const r = res[k] || 0, deResa = Math.min(q, r), horsResa = rq(q - deResa);
        const libre = rq((S[l.articleId] || {}).disponible - (dispoUtilise[l.articleId] || 0));
        if(horsResa > libre + EPS) throw erreur('« ' + (l.designation || '') + ' » : stock disponible insuffisant (' + rq(r) + ' réservé pour cette commande + ' + Math.max(0, rq(libre)) + ' disponible)');
        dispoUtilise[l.articleId] = rq((dispoUtilise[l.articleId] || 0) + horsResa);
        const lotsA = tousLots.filter(x => x.articleId === l.articleId).map(x => Object.assign({}, x, {reste:rq(x.reste - (conso[x.id] || 0))}));
        ligne.allocations = allouerFIFO(lotsA, q);
        ligne.allocations.forEach(al => { conso[al.lotId] = rq((conso[al.lotId] || 0) + al.qte); });
        if(deResa > EPS) mouvements.push(mv('liberation', {articleId:l.articleId, cmdId, lid:l.lid, qte:rq(deResa), motif:'Livraison'}, ctx));
      } else {
        ligne.coutTheorique = true;
        ligne.coutUnitTheorique = num(a && a.prixAchat);
      }
      lignes.push(ligne);
    });
    if(!lignes.length) throw erreur('Saisissez au moins une quantité à livrer');
    const numero = opts && opts.numero || numeroSuivant(D.livraisons, 'BL', ctx.date);
    const livraison = {id:nouvelId('bl'), numero, cmdId, cmdNumero:c.numero || '', clientId:c.clientId, date:ctx.date, ts:ctx.ts, par:ctx.par, reference:opts && opts.reference || '',
      remise:num(c.remise), tva:num(c.tva), lignes, note:opts && opts.note || '',
      frais:liste(opts && opts.frais).filter(f => num(f.montant) > 0).map(f => ({id:f.id || nouvelId('fr'), libelle:f.libelle || 'Frais de livraison', montant:r2(num(f.montant)), statut:f.statut === 'estime' ? 'estime' : 'reel'}))};
    mouvements.forEach(m => { m.livraisonId = livraison.id; m.motif = 'Livraison ' + numero; });
    lignes.forEach(l => l.allocations.forEach(al => mouvements.push(mv('sortie', {articleId:l.articleId, lotId:al.lotId, qte:al.qte, livraisonId:livraison.id, cmdId, lid:l.lid, motif:'Livraison ' + numero + ' (' + (c.numero || '') + ')'}, ctx))));
    const apres = Object.assign({}, liv); lignes.forEach(l => { const k = cleLigne(cmdId, l.lid); apres[k] = rq((apres[k] || 0) + l.qte); });
    return {livraison, mouvements, statut:statutCmdC(c, apres).cle};
  }
  function qteNetteLigne(l){ return rq(num(l.qte) - liste(l.retours).reduce((s, x) => s + num(x.qte), 0)); }
  // Allocations encore « sorties » (après retours), pour annulation ou retour.
  function allocationsNettes(l){
    const reste = {}; liste(l.allocations).forEach(a => { reste[a.lotId] = (reste[a.lotId] || 0) + num(a.qte); });
    liste(l.retours).forEach(r => liste(r.allocations).forEach(a => { reste[a.lotId] = rq((reste[a.lotId] || 0) - num(a.qte)); }));
    return liste(l.allocations).map(a => Object.assign({}, a)).filter(a => { const q = reste[a.lotId] || 0; if(q <= EPS) return false; a.qte = Math.min(a.qte, q); reste[a.lotId] = rq(q - a.qte); return true; });
  }
  function annulerLivraison(D, livId, opts){
    const ctx = contexte(opts), b = parId(D.livraisons)[livId]; if(!b) throw erreur('Livraison introuvable');
    if(b.annulee) throw erreur('Livraison déjà annulée');
    if(b.factureId) throw erreur('Cette livraison est facturée : annulez d\'abord la facture (avoir) dans Facturation');
    const mouvements = [];
    liste(b.lignes).forEach(l => allocationsNettes(l).forEach(a => mouvements.push(mv('annulation_sortie', {articleId:l.articleId, lotId:a.lotId, qte:a.qte, livraisonId:livId, cmdId:b.cmdId, lid:l.lid, motif:'Annulation ' + b.numero + (opts && opts.motif ? ' : ' + opts.motif : '')}, ctx))));
    return {livraison:Object.assign({}, b, {annulee:{date:ctx.date, ts:ctx.ts, par:ctx.par, motif:opts && opts.motif || ''}}), mouvements};
  }
  function retourClient(D, livId, lid, qte, opts){
    const ctx = contexte(opts), b = parId(D.livraisons)[livId]; if(!b) throw erreur('Livraison introuvable');
    if(b.annulee) throw erreur('Livraison annulée');
    const i = liste(b.lignes).findIndex(l => l.lid === lid); if(i < 0) throw erreur('Ligne introuvable');
    const l = b.lignes[i], q = rq(num(qte)), net = qteNetteLigne(l);
    if(q <= 0) throw erreur('Quantité retournée invalide');
    if(q > net + EPS) throw erreur('Retour supérieur à la quantité livrée (' + net + ')');
    // Retour dans les lots les plus récents d'abord (inverse du FIFO).
    let reste = q; const allocs = [];
    allocationsNettes(l).reverse().forEach(a => { if(reste <= EPS) return; const x = Math.min(reste, a.qte); allocs.push(Object.assign({}, a, {qte:rq(x)})); reste = rq(reste - x); });
    const mouvements = allocs.map(a => mv('retour_client', {articleId:l.articleId, lotId:a.lotId, qte:a.qte, livraisonId:livId, cmdId:b.cmdId, lid, motif:'Retour client ' + b.numero + (opts && opts.motif ? ' : ' + opts.motif : '')}, ctx));
    const lignes = b.lignes.map((x, j) => j !== i ? x : Object.assign({}, x, {retours:liste(x.retours).concat([{date:ctx.date, ts:ctx.ts, par:ctx.par, qte:q, motif:opts && opts.motif || '', allocations:allocs}])}));
    return {livraison:Object.assign({}, b, {lignes}), mouvements};
  }
  function retourFournisseur(D, lotId, qte, opts){
    const ctx = contexte(opts), l = lots(D).find(x => x.id === lotId); if(!l) throw erreur('Lot introuvable');
    const q = rq(num(qte)); if(q <= 0) throw erreur('Quantité invalide');
    if(q > l.reste + EPS) throw erreur('Quantité supérieure au reste du lot (' + l.reste + ')');
    const dispo = stockArticle(D, l.articleId).disponible;
    if(q > dispo + EPS) throw erreur('Ces quantités sont réservées pour des commandes clients (' + rq(dispo) + ' disponible)');
    return [mv('retour_fournisseur', {articleId:l.articleId, lotId, qte:q, motif:'Retour fournisseur' + (opts && opts.motif ? ' : ' + opts.motif : '')}, ctx)];
  }
  // Ajustement manuel (+ crée un lot au coût indiqué ; − sort en FIFO dans la limite du disponible).
  function ajuster(D, articleId, delta, opts){
    const ctx = contexte(opts), a = parId(D.articles)[articleId]; if(!a) throw erreur('Article introuvable');
    if(!suiviStock(a)) throw erreur('Cet article n\'est pas suivi en stock');
    const d = rq(num(delta)), inv = opts && opts.inventaire, motif = (opts && opts.motif) || (inv ? 'Inventaire' : 'Ajustement');
    if(d === 0) return [];
    if(!inv && !(opts && opts.motif)) throw erreur('Indiquez le motif de l\'ajustement');
    if(d > 0){
      const L = lots(D, articleId), dernier = L[L.length - 1];
      const cout = opts && opts.coutUnit !== undefined && opts.coutUnit !== '' ? num(opts.coutUnit) : (dernier ? dernier.coutUnit : num(a.prixAchat));
      return [mv(inv ? 'inventaire_plus' : 'ajustement_plus', {articleId, qte:d, coutUnit:cout, lot:opts && opts.lot || '', motif}, ctx)];
    }
    const s = stockArticle(D, articleId);
    if(-d > s.physique + EPS) throw erreur('Sortie supérieure au stock physique (' + s.physique + ')');
    if(!inv && -d > s.disponible + EPS) throw erreur('Sortie supérieure au stock disponible (' + s.disponible + ') : une partie est réservée');
    return allouerFIFO(lots(D, articleId), -d).map(al => mv(inv ? 'inventaire_moins' : 'ajustement_moins', {articleId, lotId:al.lotId, qte:al.qte, motif}, ctx));
  }
  function inventaire(D, articleId, qteComptee, opts){
    const s = stockArticle(D, articleId), d = rq(num(qteComptee) - s.physique);
    const mvts = ajuster(D, articleId, d, Object.assign({}, opts, {inventaire:true, motif:(opts && opts.motif) || 'Inventaire : ' + num(qteComptee) + ' compté(s) pour ' + s.physique}));
    return {mouvements:mvts, ecart:d, alerte:num(qteComptee) + EPS < s.reserve ? 'Le stock compté (' + num(qteComptee) + ') est inférieur au réservé (' + s.reserve + ') : libérez des réservations' : ''};
  }
  // Annulation d'une commande client : libère tout le réservé.
  function annulerCmdC(D, cmdId, opts){
    const c = parId(D.cmdC)[cmdId]; if(!c) throw erreur('Commande introuvable');
    if(liste(D.livraisons).some(b => b.cmdId === cmdId && !b.annulee)) throw erreur('Cette commande a des livraisons : annulez-les ou clôturez la commande');
    const res = reservations(D), out = [];
    liste(c.lignes).forEach(l => { const r = res[cleLigne(cmdId, l.lid)] || 0; if(r > EPS) out.push(mv('liberation', {articleId:l.articleId, cmdId, lid:l.lid, qte:r, motif:'Annulation ' + (c.numero || '')}, contexte(opts))); });
    return out;
  }
  // Clôture d'une commande client avec reliquat : libère le réservé restant.
  function cloturerCmdC(D, cmdId, opts){
    const c = parId(D.cmdC)[cmdId]; if(!c) throw erreur('Commande introuvable');
    const res = reservations(D), out = [];
    liste(c.lignes).forEach(l => { const r = res[cleLigne(cmdId, l.lid)] || 0; if(r > EPS) out.push(mv('liberation', {articleId:l.articleId, cmdId, lid:l.lid, qte:r, motif:'Clôture ' + (c.numero || '')}, contexte(opts))); });
    return out;
  }

  // ---------- Offres ----------
  function nouvelleVersion(o, opts){
    const ctx = contexte(opts);
    const snap = {version:num(o.version) || 1, date:o.date, validite:o.validite, statut:o.statut, lignes:liste(o.lignes).map(l => Object.assign({}, l)), remise:num(o.remise), tva:num(o.tva), conditions:o.conditions || '', totaux:totaux(o), archivee:{date:ctx.date, ts:ctx.ts, par:ctx.par}};
    return Object.assign({}, o, {version:snap.version + 1, statut:'brouillon', date:ctx.date, versions:liste(o.versions).concat([snap])});
  }
  function comparerVersions(a, b){
    const cle = l => l.articleId || ('libre:' + norm(l.designation));
    const ma = {}, mb = {};
    liste(a.lignes).forEach(l => { ma[cle(l)] = l; }); liste(b.lignes).forEach(l => { mb[cle(l)] = l; });
    const lignes = [];
    new Set(Object.keys(ma).concat(Object.keys(mb))).forEach(k => {
      const x = ma[k], y = mb[k];
      const c = {designation:(y || x).designation || '', qteA:x ? num(x.qte) : 0, qteB:y ? num(y.qte) : 0, puA:x ? num(x.pu) : 0, puB:y ? num(y.pu) : 0, remiseA:x ? num(x.remise) : 0, remiseB:y ? num(y.remise) : 0};
      c.etat = !x ? 'ajoutee' : !y ? 'retiree' : (c.qteA !== c.qteB || c.puA !== c.puB || c.remiseA !== c.remiseB) ? 'modifiee' : 'identique';
      c.montantA = r2(x ? montantLigne(x) : 0); c.montantB = r2(y ? montantLigne(y) : 0);
      lignes.push(c);
    });
    const ta = a.totaux || totaux(a), tb = b.totaux || totaux(b);
    return {lignes, totalA:ta, totalB:tb, ecartHT:r2(tb.ht - ta.ht), conditions:(a.conditions || '') !== (b.conditions || ''), validite:(a.validite || '') !== (b.validite || '')};
  }
  // Offre acceptée → commande client (sans ressaisie).
  function offreVersCommande(D, offreId, opts){
    const o = parId(D.offres)[offreId]; if(!o) throw erreur('Offre introuvable');
    if(o.statut !== 'acceptee') throw erreur('Seule une offre acceptée peut devenir une commande');
    if(o.commandeId && parId(D.cmdC)[o.commandeId]) throw erreur('Cette offre a déjà sa commande');
    const ctx = contexte(opts), type = opts && opts.type === 'annuelle' ? 'annuelle' : 'ponctuelle';
    const lignes = liste(o.lignes).filter(l => num(l.qte) > 0).map((l, i) => ({lid:'l' + (i + 1), articleId:l.articleId || '', ref:l.ref || '', designation:l.designation || '', unite:l.unite || '', qte:num(l.qte), pu:num(l.pu), remise:num(l.remise), puManuel:!!l.puManuel}));
    const c = {id:nouvelId('cc'), numero:numeroSuivant(D.cmdC, 'CC', ctx.date), clientId:o.clientId, date:ctx.date, dateSouhaitee:opts && opts.dateSouhaitee || '', type,
      statut:'confirmee', lignes, remise:num(o.remise), tva:num(o.tva), conditions:o.conditions || '', reference:o.referenceClient || '', commentaires:'', offreId:o.id, offreNumero:o.numero + (o.version > 1 ? ' v' + o.version : ''),
      echeances:type === 'annuelle' ? genererEcheances(lignes, opts.debut || ctx.date, opts.nombre || 12, opts.pas || 1) : [], cree:{date:ctx.date, ts:ctx.ts, par:ctx.par}};
    return c;
  }

  // ---------- Coûts réels et rentabilité ----------
  function coutLivraison(b){
    let ca = 0, achat = 0, fraisLots = 0, provisoire = false;
    const lignes = liste(b.lignes).map(l => {
      const net = qteNetteLigne(l), caL = net * num(l.pu) * (1 - num(l.remise) / 100) * (1 - num(b.remise) / 100);
      let a = 0, f = 0;
      if(l.coutTheorique){ a = net * num(l.coutUnitTheorique); provisoire = true; }
      else {
        allocationsNettes(l).forEach(al => { a += num(al.qte) * num(al.coutUnit); f += num(al.qte) * num(al.fraisUnit); if(al.fraisEstime) provisoire = true; });
      }
      ca += caL; achat += a; fraisLots += f;
      return {lid:l.lid, articleId:l.articleId, designation:l.designation, qte:net, ca:caL, achat:a, fraisLots:f};
    });
    let fraisLiv = 0; liste(b.frais).forEach(x => { fraisLiv += num(x.montant); if(x.statut === 'estime') provisoire = true; });
    // Frais de la livraison répartis sur les lignes au prorata du chiffre d'affaires (sinon des quantités).
    const baseCA = lignes.reduce((s, l) => s + l.ca, 0), baseQ = lignes.reduce((s, l) => s + l.qte, 0);
    lignes.forEach(l => {
      l.fraisLivraison = fraisLiv * (baseCA > 0 ? l.ca / baseCA : (baseQ > 0 ? l.qte / baseQ : 0));
      l.cout = l.achat + l.fraisLots + l.fraisLivraison; l.marge = l.ca - l.cout;   // non arrondis : les totaux par article restent exacts
      l.coutUnitaire = l.qte > 0 ? r4(l.cout / l.qte) : 0;
    });
    const cout = achat + fraisLots + fraisLiv, marge = ca - cout;
    return {ca:r2(ca), achat:r2(achat), fraisLots:r2(fraisLots), fraisLivraison:r2(fraisLiv), cout:r2(cout), marge:r2(marge),
      tauxMarge:cout > 0 ? r2(marge / cout * 100) : null, tauxMarque:ca > 0 ? r2(marge / ca * 100) : null, provisoire, lignes};
  }
  function agreger(cible, cle, libelle, v, extra){
    const x = cible[cle] || (cible[cle] = Object.assign({cle, libelle, ca:0, achat:0, fraisLots:0, fraisLivraison:0, cout:0, marge:0, qte:0, nb:0, provisoire:false}, extra || {}));
    ['ca', 'achat', 'fraisLots', 'fraisLivraison', 'cout', 'marge'].forEach(k => { x[k] += num(v[k]); });
    x.qte += num(v.qte); if(v.provisoire) x.provisoire = true;
    return x;
  }
  function finir(o){
    return Object.values(o).map(x => { ['ca', 'achat', 'fraisLots', 'fraisLivraison', 'cout', 'marge'].forEach(k => { x[k] = r2(x[k]); }); x.qte = rq(x.qte);
      x.tauxMarge = x.cout > 0 ? r2(x.marge / x.cout * 100) : null; x.tauxMarque = x.ca > 0 ? r2(x.marge / x.ca * 100) : null; x.coutUnitaire = x.qte > 0 ? r4(x.cout / x.qte) : null; return x; })
      .sort((a, b) => b.ca - a.ca);
  }
  function rentabilite(D, f){
    f = f || {};
    const A = parId(D.articles), C = parId(D.cmdC);
    const tot = {}, parLiv = {}, parCmd = {}, parClient = {}, parArticle = {}, parMois = {};
    liste(D.livraisons).forEach(b => {
      if(b.annulee) return;
      if(f.du && b.date < f.du) return; if(f.au && b.date > f.au) return;
      if(f.clientId && b.clientId !== f.clientId) return; if(f.cmdId && b.cmdId !== f.cmdId) return;
      const r = coutLivraison(b);
      const lignes = f.articleId ? r.lignes.filter(l => l.articleId === f.articleId) : r.lignes;
      if(!lignes.length) return;
      const v = f.articleId ? lignes.reduce((s, l) => { ['ca', 'achat', 'fraisLots', 'fraisLivraison', 'cout', 'marge', 'qte'].forEach(k => { s[k] += l[k]; }); return s; }, {ca:0, achat:0, fraisLots:0, fraisLivraison:0, cout:0, marge:0, qte:0, provisoire:r.provisoire})
        : Object.assign({}, r, {qte:lignes.reduce((s, l) => s + l.qte, 0)});
      v.provisoire = r.provisoire;
      agreger(tot, 'total', 'Total', v).nb++;
      agreger(parLiv, b.id, b.numero, v, {date:b.date, clientId:b.clientId, cmdId:b.cmdId}).nb++;
      agreger(parCmd, b.cmdId, b.cmdNumero || (C[b.cmdId] || {}).numero || '', v, {clientId:b.clientId}).nb++;
      agreger(parClient, b.clientId || '', '', v).nb++;
      agreger(parMois, (b.date || '').slice(0, 7), (b.date || '').slice(0, 7), v).nb++;
      lignes.forEach(l => { const a = A[l.articleId]; agreger(parArticle, l.articleId || ('libre:' + norm(l.designation)), a ? ((a.ref ? a.ref + ' · ' : '') + a.designation) : l.designation, Object.assign({}, l, {provisoire:r.provisoire})).nb++; });
    });
    return {total:finir(tot)[0] || {ca:0, achat:0, fraisLots:0, fraisLivraison:0, cout:0, marge:0, qte:0, nb:0, tauxMarge:null, tauxMarque:null},
      parLivraison:finir(parLiv).sort((a, b) => (b.date || '').localeCompare(a.date || '')), parCommande:finir(parCmd), parClient:finir(parClient), parArticle:finir(parArticle),
      parMois:finir(parMois).sort((a, b) => a.cle.localeCompare(b.cle))};
  }
  // Mise à jour volontaire des coûts d'une livraison (frais de réception connus après coup) : l'ancien calcul est conservé.
  function revaloriserLivraison(D, livId, opts){
    const ctx = contexte(opts), b = parId(D.livraisons)[livId]; if(!b) throw erreur('Livraison introuvable');
    const L = {}; lots(D).forEach(l => { L[l.id] = l; });
    const avant = coutLivraison(b);
    const lignes = liste(b.lignes).map(l => Object.assign({}, l, {allocations:liste(l.allocations).map(a => L[a.lotId] ? Object.assign({}, a, {coutUnit:L[a.lotId].coutUnit, fraisUnit:L[a.lotId].fraisUnit, fraisEstime:L[a.lotId].fraisEstime}) : a)}));
    const nb = Object.assign({}, b, {lignes});
    const apres = coutLivraison(nb);
    nb.histoCouts = liste(b.histoCouts).concat([{date:ctx.date, ts:ctx.ts, par:ctx.par, avant:{cout:avant.cout, marge:avant.marge}, apres:{cout:apres.cout, marge:apres.marge}, motif:opts && opts.motif || ''}]);
    return {livraison:nb, avant, apres};
  }
  // Lignes de facture d'une ou plusieurs livraisons d'un même client (module Facturation GADH).
  function lignesFacture(livraisons){
    const L = liste(livraisons);
    if(!L.length) throw erreur('Aucune livraison');
    if(new Set(L.map(b => b.clientId)).size > 1) throw erreur('Les livraisons doivent être du même client');
    if(L.some(b => b.factureId)) throw erreur('Une de ces livraisons est déjà facturée');
    if(L.some(b => b.annulee)) throw erreur('Une de ces livraisons est annulée');
    const lignes = [];
    L.forEach(b => liste(b.lignes).forEach(l => {
      const q = qteNetteLigne(l); if(q <= EPS) return;
      const remise = 100 - (100 - num(l.remise)) * (100 - num(b.remise)) / 100;
      lignes.push({designation:(l.ref ? l.ref + ' · ' : '') + (l.designation || '') + ' (BL ' + b.numero + ')', qte:q, pu:num(l.pu), remise:r4(remise)});
    }));
    if(!lignes.length) throw erreur('Rien à facturer (tout a été retourné)');
    return lignes;
  }

  // ---------- Import de listes (demandes de prix) ----------
  const SYNONYMES = {
    ref:['ref', 'reference', 'ref article', 'reference article', 'code', 'code article', 'article code', 'sku', 'refs'],
    designation:['designation', 'libelle', 'description', 'produit', 'article', 'nom', 'intitule', 'designation article'],
    qte:['qte', 'quantite', 'qty', 'quantity', 'nombre', 'nb', 'qte demandee', 'quantite demandee', 'besoin', 'qt'],
    unite:['unite', 'u', 'um', 'unit', 'unites', 'conditionnement'],
    prix:['prix', 'pu', 'prix unitaire', 'tarif', 'prix cible']
  };
  function detecterColonnes(entetes, lignes){
    const E = liste(entetes).map(norm), m = {};
    Object.keys(SYNONYMES).forEach(ch => {
      let i = E.findIndex(e => SYNONYMES[ch].indexOf(e) >= 0);
      if(i < 0) i = E.findIndex((e, j) => e && Object.values(m).indexOf(j) < 0 && SYNONYMES[ch].some(s => s.length > 2 && e.indexOf(s) === 0));
      if(i >= 0 && Object.values(m).indexOf(i) < 0) m[ch] = i;
    });
    // Quantité non trouvée : première colonne numérique libre.
    if(m.qte === undefined && liste(lignes).length){
      for(let j = 0; j < E.length; j++){
        if(Object.values(m).indexOf(j) >= 0) continue;
        const vals = liste(lignes).slice(0, 20).map(r => (r || [])[j]).filter(v => v !== '' && v != null);
        if(vals.length && vals.every(v => !isNaN(num(v)) && /^[\s\d.,]+$/.test(String(v)))){ m.qte = j; break; }
      }
    }
    return m;
  }
  function parserCSV(texte){
    const t = String(texte || '').replace(/^﻿/, ''), premiere = t.split(/\r?\n/)[0] || '';
    const sep = [';', ',', '\t'].sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0];
    const lignes = []; let ligne = [], champ = '', guil = false;
    for(let i = 0; i < t.length; i++){
      const c = t[i];
      if(guil){ if(c === '"'){ if(t[i + 1] === '"'){ champ += '"'; i++; } else guil = false; } else champ += c; continue; }
      if(c === '"') guil = true;
      else if(c === sep){ ligne.push(champ); champ = ''; }
      else if(c === '\n' || c === '\r'){ if(c === '\r' && t[i + 1] === '\n') i++; ligne.push(champ); champ = ''; lignes.push(ligne); ligne = []; }
      else champ += c;
    }
    if(champ !== '' || ligne.length){ ligne.push(champ); lignes.push(ligne); }
    return lignes.filter(l => l.some(x => String(x).trim() !== ''));
  }
  // Rapproche chaque ligne du catalogue ; signale inconnus, doublons, quantités et unités.
  function analyserImport(lignesBrutes, colonnes, articles){
    const A = liste(articles).filter(a => !a.archive);
    const parRef = {}, parNom = {};
    A.forEach(a => { if(a.ref) parRef[normRef(a.ref)] = a; parNom[norm(a.designation)] = parNom[norm(a.designation)] || a; });
    const vu = {}, out = [];
    liste(lignesBrutes).forEach((r, i) => {
      const val = (ch) => colonnes[ch] === undefined ? '' : String((r || [])[colonnes[ch]] == null ? '' : r[colonnes[ch]]).trim();
      const ref = val('ref'), des = val('designation'), qteBrute = val('qte'), unite = val('unite'), prix = val('prix');
      if(!ref && !des && !qteBrute) return;
      const qte = num(qteBrute);
      let a = ref ? parRef[normRef(ref)] : null, par = a ? 'ref' : '';
      if(!a && des){ a = parNom[norm(des)] || null; if(a) par = 'designation'; }
      if(!a && ref && !des){ a = parNom[norm(ref)] || null; if(a) par = 'designation'; }
      const alertes = [];
      let statut = 'ok';
      if(!(qte > 0) || /[a-z]/i.test(qteBrute.replace(/[.,\s]/g, ''))){ statut = 'erreur'; alertes.push('Quantité invalide « ' + qteBrute + ' »'); }
      if(!a){ if(statut === 'ok') statut = 'inconnu'; alertes.push('Référence inconnue du catalogue'); }
      if(a && unite && a.unite && norm(unite) !== norm(a.unite)){ alertes.push('Unité « ' + unite + ' » différente du catalogue (« ' + a.unite + ' »)'); if(statut === 'ok') statut = 'unite'; }
      const cle = a ? 'a:' + a.id : 'r:' + normRef(ref || des);
      if(statut !== 'erreur'){
        if(vu[cle] !== undefined){ alertes.push('Doublon de la ligne ' + out[vu[cle]].n); if(statut === 'ok' || statut === 'unite') statut = 'doublon'; } else vu[cle] = out.length;
      }
      out.push({n:i + 1, ref, designation:des || (a && a.designation) || '', qte:rq(qte), qteBrute, unite:unite || (a && a.unite) || '', prix:prix ? num(prix) : null, articleId:a ? a.id : '', correspondance:par, statut, alertes});
    });
    const stats = {total:out.length}; ['ok', 'inconnu', 'doublon', 'erreur', 'unite'].forEach(s => { stats[s] = out.filter(l => l.statut === s).length; });
    return {lignes:out, stats};
  }
  // Regroupe les doublons (même article) en additionnant les quantités.
  function fusionnerDoublons(lignes){
    const out = [], idx = {};
    liste(lignes).forEach(l => {
      const k = l.articleId ? 'a:' + l.articleId : 'r:' + normRef(l.ref || l.designation);
      if(l.statut === 'erreur'){ out.push(Object.assign({}, l)); return; }
      if(idx[k] !== undefined && (l.statut === 'doublon' || out[idx[k]].articleId === l.articleId)){
        const x = out[idx[k]]; x.qte = rq(x.qte + num(l.qte)); x.fusion = (x.fusion || [x.n]).concat([l.n]); x.alertes = x.alertes.filter(a => !/^Doublon/.test(a)); return;
      }
      idx[k] = out.length; out.push(Object.assign({}, l, {statut:l.statut === 'doublon' ? 'ok' : l.statut, alertes:liste(l.alertes).filter(a => !/^Doublon/.test(a))}));
    });
    return out;
  }
  // Demande (import) → offre brouillon (articles connus ; tarifs par paliers sur la quantité totale).
  function demandeVersOffre(D, demande, opts){
    const ctx = contexte(opts), A = parId(D.articles);
    const lignes = liste(demande.lignes).filter(l => l.articleId && A[l.articleId] && num(l.qte) > 0 && l.statut !== 'erreur' && !l.ignoree)
      .map(l => { const a = A[l.articleId]; return {articleId:a.id, ref:a.ref || '', designation:a.designation || '', unite:a.unite || '', qte:num(l.qte), pu:0, remise:0}; });
    if(!lignes.length) throw erreur('Aucune ligne rapprochée du catalogue : complétez les correspondances');
    const R = D.reglages || {};
    return {id:nouvelId('of'), numero:numeroSuivant(D.offres, 'OF', ctx.date), version:1, clientId:demande.clientId || '', date:ctx.date,
      validite:ajouterJours(ctx.date, num(R.validiteOffre) || 30), statut:'brouillon', lignes:appliquerPaliers(lignes, D.articles), remise:0, tva:num(opts && opts.tva !== undefined ? opts.tva : R.tva),
      conditions:R.conditionsOffre || '', demandeId:demande.id, demandeNumero:demande.numero || '', versions:[], cree:{date:ctx.date, ts:ctx.ts, par:ctx.par}};
  }

  // ---------- Contrôles de cohérence ----------
  function verifierReferences(D){
    const A = parId(D.articles), F = parId(D.fournisseurs), Cc = parId(D.cmdC), Cf = parId(D.cmdF), O = parId(D.offres), clients = D.clients || null, pb = [];
    const art = (id, ou) => { if(id && !A[id]) pb.push(ou + ' : article inconnu ' + id); };
    const cli = (id, ou) => { if(clients && id && !clients[id]) pb.push(ou + ' : client inconnu ' + id); };
    liste(D.tarifs).forEach(t => { art(t.articleId, 'Tarif ' + t.id); if(!F[t.fournisseurId]) pb.push('Tarif ' + t.id + ' : fournisseur inconnu'); });
    liste(D.articles).forEach(a => { if(a.fournisseurId && !F[a.fournisseurId]) pb.push('Article ' + (a.ref || a.id) + ' : fournisseur principal inconnu'); });
    liste(D.offres).forEach(o => { cli(o.clientId, 'Offre ' + o.numero); liste(o.lignes).forEach(l => art(l.articleId, 'Offre ' + o.numero)); });
    liste(D.cmdC).forEach(c => { cli(c.clientId, 'Commande ' + c.numero); if(c.offreId && !O[c.offreId]) pb.push('Commande ' + c.numero + ' : offre d\'origine inconnue'); liste(c.lignes).forEach(l => art(l.articleId, 'Commande ' + c.numero)); });
    liste(D.cmdF).forEach(c => { if(!F[c.fournisseurId]) pb.push('Commande fournisseur ' + c.numero + ' : fournisseur inconnu'); liste(c.lignes).forEach(l => art(l.articleId, 'Commande fournisseur ' + c.numero)); });
    liste(D.receptions).forEach(r => { if(!Cf[r.cfId]) pb.push('Réception ' + r.numero + ' : commande fournisseur inconnue'); });
    liste(D.livraisons).forEach(b => { if(!Cc[b.cmdId]) pb.push('Livraison ' + b.numero + ' : commande client inconnue'); });
    const L = {}; lots(D).forEach(l => { L[l.id] = l; if(l.reste < -EPS) pb.push('Lot ' + (l.code || l.id) + ' : reste négatif (' + l.reste + ')'); });
    liste(D.mouvements).forEach(m => { const t = TYPES_MV[m.type]; if(!t) pb.push('Mouvement ' + m.id + ' : type inconnu'); else if(t.lot === 'existant' && !L[m.lotId]) pb.push('Mouvement ' + m.id + ' : lot inconnu'); art(m.articleId, 'Mouvement ' + m.id); });
    // Numéros en double (saisies hors ligne simultanées sur deux appareils)
    [['offres', 'Offre'], ['cmdC', 'Commande'], ['cmdF', 'Commande fournisseur'], ['receptions', 'Réception'], ['livraisons', 'Livraison']].forEach(([k, lib]) => {
      const vu = {}; liste(D[k]).forEach(x => { if(!x.numero) return; if(vu[x.numero]) pb.push(lib + ' ' + x.numero + ' : numéro en double'); vu[x.numero] = 1; });
    });
    return pb;
  }
  // Doublons du catalogue (même référence ou même désignation).
  function doublonArticle(articles, a, idExclu){
    return liste(articles).find(x => x.id !== idExclu && !x.archive && ((a.ref && x.ref && normRef(x.ref) === normRef(a.ref)) || (a.designation && norm(x.designation) === norm(a.designation)))) || null;
  }
  function doublonFournisseur(fournisseurs, f, idExclu){
    return liste(fournisseurs).find(x => x.id !== idExclu && !x.archive && norm(x.nom) === norm(f.nom)) || null;
  }

  // ---------- Migration des anciens modules (Achats et stock, Ventes) ----------
  // anciens = {four, art, bons, mv, devis, cmd, bl} (objets {id: fiche}). Rend les fiches à ajouter, sans doublon
  // (rapprochement par nom / référence, et par identifiant d'origine si la migration a déjà été faite).
  function migrerAnciens(D, anciens, opts){
    const ctx = contexte(opts), mid = (opts && opts.migrationId) || nouvelId('mig');
    const origine = (src, id) => ({source:src, id, migrationId:mid});
    const dejaMigre = (l, src, id) => liste(l).find(x => x.migre && x.migre.source === src && x.migre.id === id);
    const out = {fournisseurs:[], articles:[], offres:[], cmdC:[], cmdF:[], receptions:[], livraisons:[], mouvements:[]}, rapport = [], idF = {}, idA = {}, idC = {};
    const tousF = liste(D.fournisseurs).slice(), tousA = liste(D.articles).slice();
    const objets = (o) => o && typeof o === 'object' ? Object.keys(o).filter(k => o[k]).map(k => Object.assign({_id:k}, o[k])) : [];
    objets(anciens.four).forEach(f => {
      const deja = dejaMigre(tousF, 'gadh_achat_fournisseurs', f._id) || doublonFournisseur(tousF, {nom:f.nom});
      if(deja){ idF[f._id] = deja.id; rapport.push('Fournisseur « ' + f.nom + ' » : déjà présent, rattaché'); return; }
      const n = {id:nouvelId('fo'), nom:f.nom || 'Fournisseur', contact:f.contact || '', tel:f.tel || '', email:f.email || '', adresse:f.adresse || '', mf:f.mf || '', rib:f.rib || '',
        conditions:'', delai:0, categories:f.categories || '', notes:f.note || '', actif:f.actif !== false, migre:origine('gadh_achat_fournisseurs', f._id), cree:{date:ctx.date, ts:ctx.ts, par:ctx.par}};
      idF[f._id] = n.id; out.fournisseurs.push(n); tousF.push(n);
    });
    objets(anciens.art).forEach(a => {
      const deja = dejaMigre(tousA, 'gadh_achat_articles', a._id) || doublonArticle(tousA, {ref:a.ref, designation:a.nom});
      if(deja){ idA[a._id] = deja.id; rapport.push('Article « ' + a.nom + ' » : déjà présent, rattaché'); return; }
      const service = a.categorie === 'produit' || a.categorie === 'machine';
      const n = {id:nouvelId('ar'), ref:a.ref || '', designation:a.nom || 'Article', categorie:{matiere:'Matière', accessoire:'Accessoire', machine:'Machine', produit:'Produit / prestation'}[a.categorie] || '', unite:a.unite || 'pièce',
        description:a.description || '', fournisseurId:idF[a.fournisseurId] || '', prixAchat:num(a.prix), prixVente:num(a.prixVente), paliers:[], seuil:num(a.seuil), suiviStock:!service,
        tva:num(a.tva), options:liste(a.options), actif:a.actif !== false, histoPrix:[], migre:origine('gadh_achat_articles', a._id), cree:{date:ctx.date, ts:ctx.ts, par:ctx.par}};
      idA[a._id] = n.id; out.articles.push(n); tousA.push(n);
    });
    const lig = (l, i, champs) => Object.assign({lid:'l' + (i + 1), articleId:idA[l.articleId] || '', designation:l.designation || '', unite:l.unite || '', qte:num(l.qte), pu:num(l.pu), remise:num(l.remise)}, champs || {});
    objets(anciens.devis).forEach(d => {
      if(dejaMigre(D.offres, 'gadh_vente_devis', d._id)) return;
      const st = {brouillon:'brouillon', envoye:'envoyee', accepte:'acceptee', refuse:'refusee'}[d.statut] || 'brouillon';
      out.offres.push({id:nouvelId('of'), numero:d.numero || '', version:1, clientId:d.clientId || '', date:d.date || ctx.date, validite:d.validite || '', statut:st,
        lignes:liste(d.lignes).map((l, i) => lig(l, i, {puManuel:true})), remise:0, tva:num(d.tva), conditions:d.note || '', versions:[], migre:origine('gadh_vente_devis', d._id)});
    });
    objets(anciens.cmd).forEach(c => {
      if(dejaMigre(D.cmdC, 'gadh_vente_commandes', c._id)) return;
      const n = {id:nouvelId('cc'), numero:c.numero || '', clientId:c.clientId || '', date:c.date || ctx.date, dateSouhaitee:c.livraisonPrevue || '', type:'ponctuelle',
        statut:c.statut === 'annulee' ? 'annulee' : 'confirmee', lignes:liste(c.lignes).map((l, i) => lig(l, i, {puManuel:true})), remise:0, tva:num(c.tva), conditions:'', reference:c.refClient || '', commentaires:c.note || '', echeances:[], migre:origine('gadh_vente_commandes', c._id)};
      idC[c._id] = n; out.cmdC.push(n);
    });
    objets(anciens.bl).forEach(b => {
      if(dejaMigre(D.livraisons, 'gadh_vente_livraisons', b._id)) return;
      const c = idC[b.commandeId];
      const lignes = liste(b.lignes).map((l, i) => {
        const cl = c ? liste(c.lignes).find((x, j) => j === l._i) || liste(c.lignes).find(x => x.articleId === (idA[l.articleId] || '') && x.designation === l.designation) : null;
        const a = tousA.find(x => x.id === idA[l.articleId]);
        return {lid:cl ? cl.lid : 'm' + (i + 1), articleId:idA[l.articleId] || '', designation:l.designation || '', unite:l.unite || '', qte:num(l.qte), pu:num(l.pu), remise:num(l.remise), allocations:[], retours:[], coutTheorique:true, coutUnitTheorique:num(a && a.prixAchat)};
      });
      out.livraisons.push({id:nouvelId('bl'), numero:b.numero || '', cmdId:c ? c.id : '', cmdNumero:c ? c.numero : '', clientId:b.clientId || '', date:b.date || ctx.date, reference:b.refClient || '', remise:0, tva:num(b.tva),
        lignes, frais:[], factureId:b.factureId || '', annulee:b.statut === 'annule' ? {date:b.date, motif:'Annulée avant la migration'} : null, migre:origine('gadh_vente_livraisons', b._id)});
    });
    objets(anciens.bons).forEach(b => {
      if(dejaMigre(D.cmdF, 'gadh_achat_bons', b._id)) return;
      const lignes = liste(b.lignes).map((l, i) => lig(l, i, {tva:num(l.tva)}));
      const statut = b.statut === 'annule' ? 'annulee' : b.statut === 'commande' ? 'confirmee' : 'brouillon';
      const cf = {id:nouvelId('cf'), numero:(b.numero || '').replace(/^BA-/, 'CF-') || '', ancienNumero:b.numero || '', fournisseurId:idF[b.fournisseurId] || '', date:b.date || ctx.date, datePrevue:b.echeance || '', statut, lignes,
        fraisPrevus:num(b.frais), timbre:num(b.timbre), paiements:liste(b.paiements), reference:b.refFournisseur || '', note:b.note || '', migre:origine('gadh_achat_bons', b._id)};
      out.cmdF.push(cf);
      // Quantités déjà reçues : une réception « historique » sans mouvement (le stock repris est le stock initial).
      const recu = lignes.map((l, i) => ({lid:l.lid, articleId:l.articleId, designation:l.designation, unite:l.unite, qte:num((liste(b.lignes)[i] || {}).recu), pu:l.pu})).filter(l => l.qte > 0);
      if(recu.length) out.receptions.push({id:nouvelId('br'), numero:'BR-' + (cf.ancienNumero || cf.id), cfId:cf.id, fournisseurId:cf.fournisseurId, date:b.date || ctx.date, lignes:recu, frais:[], historique:true, migre:origine('gadh_achat_bons', b._id)});
    });
    // Stock : solde de l'ancien stock par article → un lot « Stock initial » au dernier prix d'achat.
    const solde = {};
    objets(anciens.mv).forEach(m => { if(!m.articleId) return; solde[m.articleId] = (solde[m.articleId] || 0) + (m.type === 'sortie' ? -1 : 1) * num(m.qte); });
    Object.keys(solde).forEach(old => {
      const nid = idA[old], q = rq(solde[old]); if(!nid || q <= EPS) return;
      if(liste(D.mouvements).some(m => m.type === 'initial' && m.migre && m.migre.id === old)) return;
      const a = tousA.find(x => x.id === nid); if(!suiviStock(a)) return;
      out.mouvements.push(Object.assign(mv('initial', {articleId:nid, qte:q, coutUnit:num(a.prixAchat), lot:'Reprise ' + ctx.date, motif:'Stock repris de l\'ancien module Achats et stock'}, ctx), {migre:origine('gadh_achat_mouvements', old)}));
    });
    rapport.unshift(out.fournisseurs.length + ' fournisseur(s), ' + out.articles.length + ' article(s), ' + out.offres.length + ' offre(s), ' + out.cmdC.length + ' commande(s) client, ' + out.livraisons.length + ' livraison(s), ' + out.cmdF.length + ' commande(s) fournisseur, ' + out.mouvements.length + ' lot(s) de stock initial');
    return {migrationId:mid, ajouts:out, rapport};
  }

  // ---------- Journal ----------
  function entreeJournal(action, objet, fiche, details, opts){
    const ctx = contexte(opts);
    return {id:nouvelId('j'), ts:ctx.ts, date:ctx.date, par:ctx.par, uid:opts && opts.uid || '', action, objet, objetId:fiche && fiche.id || '', numero:fiche && (fiche.numero || fiche.ref || fiche.nom || fiche.designation) || '', details:details || ''};
  }

  const GC = {EPS, num, liste, rq, r2, r4, parId, norm, normRef, nouvelId, ajouterJours, ajouterMois, cleLigne, suiviStock,
    OFFRE_STATUTS, CMDC_STATUTS, CMDF_STATUTS, TYPES_MV, METHODES_FRAIS, CMDC_OUVERTE, CMDF_OUVERTE,
    numeroSuivant, prixPalier, paliersValides, qtesEngagees, appliquerPaliers, totaux, montantLigne, tarifsValables, tarifAchat, comparerFournisseurs, delaiFournisseur,
    fraisReception, lots, reservations, livres, recus, stocks, stockArticle, allouerFIFO,
    statutOffre, statutCmdC, statutCmdF, enRetardCmdF, genererEcheances, suiviEcheances, echeancesValides, retardCmdC,
    besoins, commandesDepuisBesoins, receptionner, annulerReception, reserver, liberer, reserverTout, livrer, qteNetteLigne, allocationsNettes, annulerLivraison,
    retourClient, retourFournisseur, ajuster, inventaire, annulerCmdC, cloturerCmdC, nouvelleVersion, comparerVersions, offreVersCommande,
    coutLivraison, rentabilite, revaloriserLivraison, lignesFacture, detecterColonnes, parserCSV, analyserImport, fusionnerDoublons, demandeVersOffre,
    verifierReferences, doublonArticle, doublonFournisseur, migrerAnciens, entreeJournal};
  if(typeof module !== 'undefined' && module.exports) module.exports = GC;
  else racine.GC = GC;
})(typeof window !== 'undefined' ? window : globalThis);
