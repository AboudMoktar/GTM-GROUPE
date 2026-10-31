// ============================================================
// Modules proposés selon le rôle (chargé en tout dernier)
// ============================================================
// Certains modules s'ajoutent à la liste après coup (tableaux de bord TEK-TREND
// et GADH, Suivi chaîne). Ce filtre final applique exactement la partie
// « interface » de roles-config.js, quel que soit l'ordre de chargement.
(function(){
  'use strict';
  const origine = window.modulesDeSociete;
  window.modulesDeSociete = function(soc){
    const liste = origine(soc), R = window.GTM_ROLES, p = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.profil : null;
    if(!R || !p || !R.ROLES[p]) return liste; // ancien compte sans profil : comportement d'avant
    const inter = (R.ROLES[p].interface || {})[soc];
    if(!inter) return [];
    if(inter === '*') return liste;
    return liste.filter(m => inter[m]);
  };
})();
