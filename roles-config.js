// ============================================================
// RÔLES ET PERMISSIONS — SOURCE UNIQUE (GTM Groupe)
// ============================================================
// Ce fichier est la seule définition des rôles. Il est lu :
//  - par l'application (profils-module.js, groupe-module.js, index.html) pour
//    n'afficher que les modules, onglets et données autorisés ;
//  - par outils/generer-regles.js, qui en tire les règles Firebase
//    (database.rules.v2.json). Ne jamais modifier les règles à la main :
//    modifier ce fichier, puis relancer le générateur et les tests.
//
// Vocabulaire
//  - ressource : un ensemble de clés de données d'un dossier Firebase
//    (dossier/clé exacte ou dossier/préfixe de clé). Chaque clé est une
//    collection enregistrée d'un bloc (ex. « employees » = tous les salariés).
//  - actions : l = lire, c = créer la clé, m = modifier la clé (y compris
//    ajouter ou retirer un élément de la collection), s = supprimer la clé
//    entière.
//  - « * » dans une ressource de rôle = toutes les ressources du dossier,
//    y compris des clés futures non listées ici.
//
// Fonctionne tel quel dans le navigateur (variable globale) et sous Node
// (module.exports), sans aucune dépendance.

(function(racine){
  'use strict';

  const SOCIETES = {tek:'TEK-TREND', gadh:'GADH TUNISIA', mgt:'MGT'};

  // --- Ressources (vérifiées dans le code : chaque clé est réellement lue ou écrite) ---
  const RESSOURCES = {
    // TEK-TREND (dossier tek/)
    'tek.rendement_saisie': {societe:'tek', module:'Rendement', libelle:'Saisie du rendement par jour (prod_AAAA-MM-JJ)', dossier:'tek', prefixes:['prod_2']},
    'tek.fiche_chaine':     {societe:'tek', module:'Rendement', libelle:'Fiche chaîne du jour (fc_AAAA-MM-JJ)', dossier:'tek', prefixes:['fc_2']},
    'tek.horaires':         {societe:'tek', module:'Rendement', libelle:'Horaires de travail (schedule)', dossier:'tek', cles:['schedule']},
    'tek.rendement_params': {societe:'tek', module:'Rendement', libelle:'Paramètres de production : cadence, postes, modèles', dossier:'tek', cles:['obj_horaire_op', 'ops', 'ops_history', 'fc_modeles', 'fc_params']},
    'tek.suivi_v4':         {societe:'tek', module:'Rendement', libelle:'Suivi de commande v4 (prod_commandes, bons, saisies, étapes)', dossier:'tek', cles:['prod_commandes', 'prod_bons', 'prod_v4_migre'], prefixes:['prod_saisies_', 'prod_stage_']},
    'tek.rh_presence':      {societe:'tek', module:'RH', libelle:'Salariés, pointages, absences', dossier:'tek', cles:['employees', 'absence_periods'], prefixes:['attendance_']},
    'tek.rh_dossiers':      {societe:'tek', module:'RH', libelle:'Dossiers RH et départements', dossier:'tek', cles:['rh_departements'], prefixes:['rh_base_']},
    'tek.facturation':      {societe:'tek', module:'Facturation', libelle:'Factures, clients facturés, paramètres, compteurs', dossier:'tek', cles:['factures', 'fact_clients', 'fact_params', 'fact_compteurs']},
    'tek.machines':         {societe:'tek', module:'Machines', libelle:'Machines, arrêts, horaires machines', dossier:'tek', prefixes:['tek_']},
    'tek.stock':            {societe:'tek', module:'Stock', libelle:'Stock : mouvements, commandes fournisseurs, réglages', dossier:'tek', prefixes:['stk_']},
    'tek.messages':         {societe:'tek', module:'Messages', libelle:'Messages internes (onglet retiré de l\'interface)', dossier:'tek', cles:['messages']},
    // GADH TUNISIA (dossier gadh/)
    'gadh.rh':              {societe:'gadh', module:'RH GADH', libelle:'Salariés, pointages, absences, horaires', dossier:'gadh', cles:['gadh_employees', 'gadh_absences', 'gadh_plannings'], prefixes:['gadh_attendance_']},
    'gadh.facturation':     {societe:'gadh', module:'Facturation', libelle:'Factures GADH, clients, paramètres, compteurs', dossier:'gadh', prefixes:['gadh_fact']},
    'gadh.machines':        {societe:'gadh', module:'Machines', libelle:'Machines et arrêts GADH', dossier:'gadh', prefixes:['gadh_machines', 'gadh_arrets']},
    // Échanges TEK-TREND ↔ GADH (dossier liaison/)
    'liaison.commandes':    {societe:'liaison', module:'Commandes', libelle:'Commandes PERCKO : commandes, saisies, historique, expéditions, emballage', dossier:'liaison', cles:['cmd_commandes'], prefixes:['cmd_saisies_', 'cmd_historique_', 'cmd_expeditions_', 'cmd_embjournal_']},
    'liaison.suivi':        {societe:'liaison', module:'Commandes', libelle:'Suivi PERCKO : lots, envois et retours GADH', dossier:'liaison', cles:['suivi_index'], prefixes:['suivi_d_']},
    'liaison.references':   {societe:'liaison', module:'Commandes', libelle:'Catalogue des références', dossier:'liaison', cles:['prod_references']},
    // MGT (dossier mgt/ et fichiers joints fichiers/)
    'mgt.tout':             {societe:'mgt', module:'MGT', libelle:'Toutes les données MGT (clients, offres, SAV, demandes, factures…)', dossier:'mgt', tout:true},
    'mgt.fichiers':         {societe:'mgt', module:'MGT', libelle:'Fichiers joints (PDF, photos)', dossier:'fichiers', tout:true}
  };

  // Clés dont la suppression entière est réservée aux rôles « complets » (*) :
  // un rôle limité peut modifier ces collections, jamais les effacer d'un coup.
  const COLLECTIONS_PROTEGEES = ['employees', 'factures', 'fact_clients', 'gadh_employees', 'gadh_factures', 'gadh_fact_clients', 'cmd_commandes', 'suivi_index'];

  const TOUT = 'lcms';
  // --- Rôles (organisation validée le 31/10/2026) ---
  // role : rôle technique attendu par les écrans existants (admin, chef_chaine, viewer).
  // interface : modules (et onglets) proposés ; '*' = tous les onglets du module.
  // droits : {ressource ou 'dossier.*' : actions}.
  const ROLES = {
    sysadmin: {
      label:'Administrateur / Développeur', role:'admin', groupe:true, societes:{tek:true, gadh:true, mgt:true},
      admin:true, auditLecture:true,
      aide:'Accès complet aux trois sociétés · gestion des comptes · configuration · sauvegardes',
      interface:{tek:'*', gadh:'*', mgt:'*'},
      droits:{'tek.*':TOUT, 'gadh.*':TOUT, 'liaison.*':TOUT, 'mgt.*':TOUT}
    },
    responsable: {
      label:'Responsable TEK-TREND', role:'admin', groupe:false, societes:{tek:true, gadh:true},
      aide:'Accès complet à TEK-TREND et GADH TUNISIA',
      interface:{tek:'*', gadh:'*'},
      droits:{'tek.*':TOUT, 'gadh.*':TOUT, 'liaison.*':TOUT}
    },
    secretaire_tek: {
      label:'Secrétaire TEK-TREND', role:'admin', groupe:false, societes:{tek:true},
      aide:'Ressources humaines et facturation TEK-TREND',
      interface:{tek:{rh:'*', factures:'*'}},
      droits:{'tek.rh_presence':TOUT, 'tek.rh_dossiers':TOUT, 'tek.facturation':TOUT,
        // Lectures nécessaires : horaires (calcul des retards), commandes et suivi (factures PERCKO depuis les expéditions).
        'tek.horaires':'l', 'liaison.commandes':'l', 'liaison.suivi':'l', 'liaison.references':'l'}
    },
    agent_chaine: {
      label:'Cheftaine TEK-TREND', role:'chef_chaine', groupe:false, societes:{tek:true},
      aide:'Saisie du rendement de la chaîne',
      interface:{tek:{rendement:['dashboard', 'saisie', 'fiche-chaine']}},
      droits:{'tek.rendement_saisie':'lcm', 'tek.fiche_chaine':'lcm',
        // Lectures nécessaires à la saisie : horaires, modèles et cadences, présence du jour (objectif ajusté selon l'état RH).
        'tek.horaires':'l', 'tek.rendement_params':'l', 'tek.rh_presence':'l'}
    },
    resp_gadh: {
      label:'Responsable GADH', role:'admin', groupe:false, societes:{gadh:true},
      aide:'Pièces de production et commandes reçues par GADH',
      interface:{gadh:{gadh:['gadh-dashboard', 'gadh-production', 'gadh-prodchain', 'commandes-home', 'gadh-historique', 'gadh-stats']}},
      droits:{'liaison.suivi':'lcm', 'liaison.commandes':'lcm', 'liaison.references':'l'}
    },
    secretaire_gadh: {
      label:'Secrétaire GADH', role:'admin', groupe:false, societes:{gadh:true},
      aide:'Ressources humaines et facturation GADH',
      interface:{gadh:{'gadh-rh':'*', factures:'*'}},
      droits:{'gadh.rh':TOUT, 'gadh.facturation':TOUT,
        // Lecture nécessaire : pièces retournées (factures GADH → TEK-TREND depuis le suivi).
        'liaison.suivi':'l', 'liaison.commandes':'l', 'liaison.references':'l'}
    },
    technico_mgt: {
      label:'Technico-commercial MGT', role:'admin', groupe:false, societes:{mgt:true},
      aide:'Accès complet au module MGT, y compris les demandes SAV',
      interface:{mgt:'*'},
      droits:{'mgt.*':TOUT}
    },
    secretaire_mgt: {
      label:'Secrétaire MGT', role:'viewer', groupe:false, societes:{},
      aide:'Responsabilités à définir : aucun accès pour le moment',
      interface:{},
      droits:{}
    },
    direction: {
      label:'Direction (lecture seule)', role:'viewer', groupe:true, societes:{tek:true, gadh:true, mgt:true},
      aide:'Lecture seule sur les trois sociétés · aucune modification',
      interface:{tek:'*', gadh:'*', mgt:'*'},
      droits:{'tek.*':'l', 'gadh.*':'l', 'liaison.*':'l', 'mgt.*':'l'}
    }
  };
  const ORDRE = ['sysadmin', 'responsable', 'secretaire_tek', 'agent_chaine', 'resp_gadh', 'secretaire_gadh', 'technico_mgt', 'secretaire_mgt', 'direction'];

  // --- Outils de lecture de la configuration (utilisés par l'application et le générateur) ---
  function ressourcesDuDossier(dossier){ return Object.keys(RESSOURCES).filter(id => RESSOURCES[id].dossier === dossier); }
  // Actions d'un rôle sur une ressource ('' si aucune).
  function actions(roleId, ressId){
    const r = ROLES[roleId]; if(!r) return '';
    const d = r.droits || {}, res = RESSOURCES[ressId]; if(!res) return '';
    const famille = ressId.split('.')[0];
    return d[ressId] || d[famille + '.*'] || '';
  }
  // Le rôle a-t-il le dossier entier (« * ») pour cette action ?
  function dossierComplet(roleId, dossier, action){
    const d = (ROLES[roleId] || {}).droits || {};
    const ids = ressourcesDuDossier(dossier);
    if(!ids.length) return false;
    const famille = ids[0].split('.')[0];
    if(dossier === 'fichiers') return (d['mgt.*'] || d['mgt.fichiers'] || '').indexOf(action) >= 0;
    return (d[famille + '.*'] || '').indexOf(action) >= 0;
  }
  // La clé appartient-elle à la ressource ?
  function cleDansRessource(cle, ressId){
    const r = RESSOURCES[ressId]; if(!r) return false;
    if(r.tout) return true;
    return (r.cles || []).indexOf(cle) >= 0 || (r.prefixes || []).some(p => cle.indexOf(p) === 0);
  }
  // Peut-on faire « action » sur la clé « cle » du dossier « dossier » ?
  function autorise(roleId, dossier, cle, action){
    if(dossierComplet(roleId, dossier, action)) return true;
    return ressourcesDuDossier(dossier).some(id => cleDansRessource(cle, id) && actions(roleId, id).indexOf(action) >= 0);
  }
  // Sources de lecture d'un rôle pour un dossier : 'tout' ou {cles:[], prefixes:[]}.
  function sourcesLecture(roleId, dossier){
    if(dossierComplet(roleId, dossier, 'l')) return 'tout';
    const cles = [], prefixes = [];
    ressourcesDuDossier(dossier).forEach(id => {
      if(actions(roleId, id).indexOf('l') < 0) return;
      const r = RESSOURCES[id];
      (r.cles || []).forEach(c => cles.push(c));
      (r.prefixes || []).forEach(p => prefixes.push(p));
    });
    return (cles.length || prefixes.length) ? {cles, prefixes} : null;
  }

  const config = {SOCIETES, RESSOURCES, ROLES, ORDRE, COLLECTIONS_PROTEGEES,
    ressourcesDuDossier, actions, dossierComplet, cleDansRessource, autorise, sourcesLecture,
    DOSSIERS:['tek', 'gadh', 'liaison', 'mgt', 'fichiers']};
  if(typeof module !== 'undefined' && module.exports) module.exports = config;
  else racine.GTM_ROLES = config;
})(typeof window !== 'undefined' ? window : globalThis);
