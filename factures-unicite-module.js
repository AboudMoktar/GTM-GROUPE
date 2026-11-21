// ============================================================
// FACTURES — GARANTIE D'UNICITÉ DES NUMÉROS (correction C2 de l'audit)
// ============================================================
// Chargé après factures-module.js et facturation-percko-module.js. Il ne change pas la façon de
// numéroter (même format, même suite, numéro donné immédiatement, y compris hors ligne) ; il ajoute
// deux garde-fous côté serveur, parce que deux postes (ou un poste hors ligne) pouvaient attribuer
// le même numéro :
//  1) chaque numéro attribué est « réservé » sur le serveur par une TRANSACTION Firebase sur le
//     compteur (fact_compteurs/<FA|AV>/<année>) : le compteur ne peut plus reculer ni être écrasé
//     par l'enregistrement d'un autre poste ;
//  2) un contrôle des doublons (au démarrage, à chaque retour des données, après chaque
//     numérotation) : si deux factures (ou deux avoirs) d'une même société portent le même numéro,
//     la plus ancienne garde son numéro, l'autre reçoit le numéro libre suivant (réservé par
//     transaction), la correction est notée dans la facture et un message prévient l'utilisateur.
// Seul un compte qui a le droit de modifier la facturation de la société corrige.
(function(){
  'use strict';
  const SOCIETES_FACT = ['tek', 'gadh', 'mgt'];
  const enLigne = () => typeof firebaseReady !== 'undefined' && firebaseReady && typeof fbRootRef !== 'undefined' && fbRootRef;
  const prefixe = f => f.type === 'avoir' ? 'AV' : 'FA';

  // Rang et année d'un numéro : FA26/031, AV26/002, FA-2026-004, AV-2026-001.
  function rangDe(num){
    const m = String(num || '').match(/^(FA|AV)(?:-(\d{4})-|(\d{2})\/)(\d+)$/);
    return m ? {p:m[1], annee:m[2] || ('20' + m[3]), rang:parseInt(m[4], 10), court:!!m[3]} : null;
  }
  function format(modele, rang){
    return modele.court ? modele.p + modele.annee.slice(2) + '/' + String(rang).padStart(3, '0') : modele.p + '-' + modele.annee + '-' + String(rang).padStart(3, '0');
  }
  // Ordre de création : date de création si connue, sinon l'horodatage contenu dans l'identifiant (mgtId).
  function creation(id, f){
    if(f && f.creeLe) return Number(new Date(f.creeLe)) || 0;
    const t = parseInt(String(id).slice(1, 9), 36); return isFinite(t) ? t : Infinity;
  }
  function cheminCompteur(soc, p, annee){ return firebaseCheminDe(factCle(soc, 'fact_compteurs')) + '/' + p + '/' + annee; }

  // Réserve au moins « rang » sur le compteur du serveur (le compteur ne recule jamais ici).
  function reserverAuMoins(soc, p, annee, rang){
    if(!enLigne()) return Promise.resolve(null);
    return fbRootRef.child(cheminCompteur(soc, p, annee)).transaction(cur => Math.max(Number(cur) || 0, rang))
      .then(r => r && r.committed ? Number(r.snapshot.val()) : null).catch(() => null);
  }
  // Prend le numéro suivant sur le serveur, au-delà de tous les numéros connus localement.
  function reserverSuivant(soc, p, annee, plancher){
    if(!enLigne()) return Promise.resolve(null);
    return fbRootRef.child(cheminCompteur(soc, p, annee)).transaction(cur => Math.max(Number(cur) || 0, plancher) + 1)
      .then(r => r && r.committed ? Number(r.snapshot.val()) : null).catch(() => null);
  }

  // 1) Chaque numéro attribué est réservé sur le serveur.
  // Avant de numéroter, le compteur local est remonté au plus grand numéro déjà connu (factures de la
  // société et numéros réservés pendant cette session) : un compteur plus ancien reçu d'un autre poste
  // ne peut donc plus faire redonner un numéro déjà utilisé.
  const reserves = {};   // 'soc|FA|2026' -> plus grand rang réservé sur ce poste
  function remonterCompteur(soc, type, annee){
    const p = type === 'avoir' ? 'AV' : 'FA', an = String(annee), cle = factCle(soc, 'fact_compteurs');
    let max = reserves[soc + '|' + p + '|' + an] || 0;
    Object.values(factToutes(soc)).forEach(f => { const r = f && rangDe(f.numero); if(r && r.p === p && r.annee === an) max = Math.max(max, r.rang); });
    const c = getJSON(cle, {}) || {}, t = c[p] || {};
    if((Number(t[an]) || 0) < max){ t[an] = max; c[p] = t; setJSON(cle, c); }
  }
  const numeroOrigine = window.factNumero;
  window.factNumero = function(soc, type, annee){
    try { remonterCompteur(soc, type, annee); } catch(e) {}
    const num = numeroOrigine.apply(this, arguments), r = rangDe(num);
    if(r){
      const k = soc + '|' + r.p + '|' + r.annee; reserves[k] = Math.max(reserves[k] || 0, r.rang);
      reserverAuMoins(soc, r.p, r.annee, r.rang).then(() => setTimeout(() => factVerifierDoublons(soc), 1500));
    }
    return num;
  };

  // 2) Contrôle et correction des doublons.
  let enCours = false;
  async function factVerifierDoublons(soc){
    if(enCours || typeof factToutes !== 'function' || typeof canEditFact !== 'function' || !currentUser || !canEditFact(soc)) return 0;
    if(typeof hlEcritureAutorisee === 'function' && !hlEcritureAutorisee(factCle(soc, 'factures'))) return 0; // données pas encore chargées
    enCours = true;
    try {
      const l = factToutes(soc), groupes = {};
      Object.entries(l).forEach(([id, f]) => {
        if(!f || !f.numero) return;
        const r = rangDe(f.numero); if(!r) return;
        const k = r.p + '|' + r.annee + '|' + r.rang; (groupes[k] = groupes[k] || []).push(id);
      });
      const doublons = Object.values(groupes).filter(g => g.length > 1);
      if(!doublons.length) return 0;
      if(!enLigne()) return 0;   // on corrige seulement en ligne, avec un numéro réservé sur le serveur
      let n = 0; const messages = [];
      for(const ids of doublons){
        ids.sort((a, b) => creation(a, l[a]) - creation(b, l[b]) || (a < b ? -1 : 1));
        for(const id of ids.slice(1)){
          const f = l[id], r = rangDe(f.numero);
          // plancher : plus grand rang déjà utilisé localement pour ce préfixe et cette année
          const plancher = Object.values(l).reduce((m, x) => { const y = x && rangDe(x.numero); return y && y.p === r.p && y.annee === r.annee ? Math.max(m, y.rang) : m; }, 0);
          const rang = await reserverSuivant(soc, r.p, r.annee, plancher); if(!rang) continue;
          const actuel = factToutes(soc);   // relire : l'écran a pu changer pendant l'attente
          if(!actuel[id] || actuel[id].numero !== f.numero) continue;
          const ancien = f.numero, nouveau = format(r, rang);
          actuel[id].numero = nouveau;
          actuel[id].corrections = (actuel[id].corrections || []).concat([{date:getTodayISO(), par:currentUser.nom || currentUser.username || '', motif:'Numéro en double : ' + ancien + ' → ' + nouveau}]);
          factEnregistrer(soc, actuel); n++; messages.push(ancien + ' → ' + nouveau);
        }
      }
      if(n){
        showToast('⚠ Numéro de facture en double corrigé : ' + messages.join(', '));
        if(typeof activeTab !== 'undefined' && /^fact-/.test(activeTab) && typeof nav === 'function') nav(activeTab);
      }
      return n;
    } finally { enCours = false; }
  }
  window.factVerifierDoublons = factVerifierDoublons;

  // Contrôle régulier (léger : quelques dizaines de factures), et au retour au premier plan.
  function controleGeneral(){ SOCIETES_FACT.forEach(s => { try { factVerifierDoublons(s); } catch(e) {} }); }
  setInterval(controleGeneral, 60000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) setTimeout(controleGeneral, 3000); });
  window.addEventListener('online', () => setTimeout(controleGeneral, 5000));
  setTimeout(controleGeneral, 8000);
})();
