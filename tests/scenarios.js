// ============================================================
// Scénarios de sécurité par rôle — communs au simulateur et à l'émulateur
// ============================================================
// Chaque scénario : [libellé, compte, opération, chemin, valeur|requête, attendu]
//   opération : 'lire' | 'requete' (préfixe de clé) | 'ecrire' | 'supprimer'
//   attendu   : true = autorisé, false = refusé
'use strict';
const C = require('../roles-config.js');

const AUJ = '2026-10-31', HIER = '2026-10-30', DEMAIN = '2026-11-01';
const MAINTENANT = Date.now(); // l'émulateur utilise l'heure réelle pour « now »

// Un compte de test par rôle, construit à partir de la configuration (aucune valeur recopiée à la main).
function profil(role, username){
  const d = C.ROLES[role];
  return {nom:d.label, username, role:d.role, profil:role, groupe:!!d.groupe, societes:Object.assign({}, d.societes)};
}
const COMPTES = {
  u_sysadmin: profil('sysadmin', 'mokhtar'),
  u_responsable: profil('responsable', 'responsable'),
  u_secr_tek: profil('secretaire_tek', 'secretaire'),
  u_cheftaine: profil('agent_chaine', 'cheftaine'),
  u_resp_gadh: profil('resp_gadh', 'respgadh'),
  u_secr_gadh: profil('secretaire_gadh', 'secrgadh'),
  u_technico: profil('technico_mgt', 'technico'),
  u_secr_mgt: profil('secretaire_mgt', 'secrmgt'),
  u_damien: profil('direction', 'damien'),
  u_ghazia: profil('direction', 'ghazia'),
  u_desactive: Object.assign(profil('responsable', 'ancienresp'), {desactive:true}),
  u_ancien: {nom:'Ancien compte', username:'ancien', role:'admin', groupe:true}
};

function donneesInitiales(){
  return {groupe1:{
    users_v2: COMPTES,
    sessions: {s_cheftaine:{username:'cheftaine', nom:'Cheftaine', role:'chef_chaine', loginAt:MAINTENANT, lastSeen:MAINTENANT, device:'PC'},
               s_secr:{username:'secretaire', nom:'Secrétaire', role:'admin', loginAt:MAINTENANT, lastSeen:MAINTENANT, device:'PC'}},
    tek: {['prod_' + AUJ]:{date:AUJ, status:'draft', hours:{'08:00':{op1:'10'}}}, ['prod_' + HIER]:{date:HIER, status:'validated'},
          ['fc_' + AUJ]:{rows:{a:1}}, schedule:{lun:'08-17'}, obj_horaire_op:60, ops_history:{op1:[{nom:'A'}]},
          employees:{e1:{nom:'Ben Ali'}}, ['attendance_' + AUJ]:{e1:{statut:'present'}}, ['attendance_' + HIER]:{e1:{statut:'absent'}},
          absence_periods:{p1:{empId:'e1'}}, rh_base_2026:{e1:{salaire:1000}}, rh_departements:{d1:'Coupe'},
          factures:{f1:{numero:'FA1'}}, fact_params:{rib:'X'}, tek_machines:{m1:{nom:'Presse'}}, stk_mv:{mv1:{q:5}},
          messages:{m1:{text:'Bonjour', authorUsername:'responsable'}}, prod_commandes:{c1:{n:1}}, cle_inconnue:{x:1}},
    gadh: {gadh_employees:{g1:{nom:'Sana'}}, ['gadh_attendance_' + AUJ]:{g1:{statut:'present'}}, gadh_absences:{a1:{}},
           gadh_plannings:{p1:{nom:'Hiver'}}, gadh_factures:{f1:{numero:'G1'}}, gadh_fact_params:{rib:'Y'}, gadh_machines:{m1:{}}, gadh_cadences:{r1:20}},
    liaison: {cmd_commandes:{c1:{numero:'12'}}, cmd_saisies_c1:{[AUJ]:{retour:{r1:{M:5}}}}, suivi_index:['cfg', 'lines-1'],
              'suivi_d_lines-1':{lot:'1'}, prod_references:{r1:{nom:'Ceinture'}}},
    mgt: {mgt_devis:{d1:{n:1}}, mgt_clients:{c1:{nom:'Client'}}, mgt_demandes:{d1:{clientId:'c1', objet:'Panne', statut:'attente', date:AUJ}}, mgt_crm_data:'__gtm_json_v1:{}'},
    fichiers: {f1:'data:application/pdf;base64,AAAA'},
    audit: {j:{[AUJ]:{a_vieux:{t:MAINTENANT - 3600000, un:'secretaire', cle:'factures'}, a_recent:{t:MAINTENANT - 60000, un:'secretaire', cle:'factures'}}}},
    portail: {mgt:{c1:{portail_proj_mgt:{nom:'Client'}}}}
  }};
}

const T = '/groupe1/';
const pref = (p) => ({orderByKey:true, startAt:p, endAt:p + ''});
const S = (u, extra) => Object.assign({username:u, nom:u, role:'admin', loginAt:MAINTENANT, lastSeen:MAINTENANT, device:'PC'}, extra || {});

const SCENARIOS = [
  // --- Accès sans compte valide ---
  ['Visiteur non connecté : lecture TEK', null, 'lire', T + 'tek', null, false],
  ['Visiteur non connecté : écriture', null, 'ecrire', T + 'tek/prod_' + AUJ, {x:1}, false],
  ['Compte Firebase sans profil : lecture TEK', 'u_inconnu', 'lire', T + 'tek', null, false],
  ['Compte sans profil : se créer un profil administrateur', 'u_inconnu', 'ecrire', T + 'users_v2/u_inconnu', profil('sysadmin', 'pirate'), false],
  ['Compte désactivé : lecture TEK', 'u_desactive', 'lire', T + 'tek', null, false],
  ['Compte désactivé : écriture', 'u_desactive', 'ecrire', T + 'tek/prod_' + AUJ, {x:1}, false],
  ['Ancien compte sans profil (avant migration) : lecture', 'u_ancien', 'lire', T + 'tek', null, false],
  ['Portail supprimé : lecture portail/', 'u_sysadmin', 'lire', T + 'portail/mgt/c1', null, false],
  ['Portail supprimé : écriture portail/', 'u_sysadmin', 'ecrire', T + 'portail/mgt/c1/x', {a:1}, false],

  // --- Administrateur / Développeur ---
  ['Admin : lecture TEK, GADH, liaison, MGT', 'u_sysadmin', 'lire', T + 'tek', null, true],
  ['Admin : lecture GADH', 'u_sysadmin', 'lire', T + 'gadh', null, true],
  ['Admin : lecture MGT', 'u_sysadmin', 'lire', T + 'mgt', null, true],
  ['Admin : lecture liaison', 'u_sysadmin', 'lire', T + 'liaison', null, true],
  ['Admin : lecture d\'un fichier joint', 'u_sysadmin', 'lire', T + 'fichiers/f1', null, true],
  ['Admin : lecture de la liste des comptes', 'u_sysadmin', 'lire', T + 'users_v2', null, true],
  ['Admin : lecture du journal d\'audit', 'u_sysadmin', 'lire', T + 'audit', null, true],
  ['Admin : modifier une saisie TEK', 'u_sysadmin', 'ecrire', T + 'tek/prod_' + AUJ, {date:AUJ, hours:{}}, true],
  ['Admin : modifier MGT', 'u_sysadmin', 'ecrire', T + 'mgt/mgt_devis', {d1:{n:2}}, true],
  ['Admin : supprimer une collection protégée (employees)', 'u_sysadmin', 'supprimer', T + 'tek/employees', null, true],
  ['Admin : effacer tout le dossier TEK d\'un coup', 'u_sysadmin', 'supprimer', T + 'tek', null, false],
  ['Admin : créer un compte cohérent (Secrétaire GADH)', 'u_sysadmin', 'ecrire', T + 'users_v2/u_nouveau', profil('secretaire_gadh', 'nouvelle'), true],
  ['Admin : créer un compte incohérent (direction avec rôle admin)', 'u_sysadmin', 'ecrire', T + 'users_v2/u_nouveau2', Object.assign(profil('direction', 'faux'), {role:'admin'}), false],
  ['Admin : créer un compte avec une société en plus', 'u_sysadmin', 'ecrire', T + 'users_v2/u_nouveau3', Object.assign(profil('secretaire_tek', 'faux2'), {societes:{tek:true, mgt:true}}), false],
  ['Admin : désactiver un autre compte', 'u_sysadmin', 'ecrire', T + 'users_v2/u_secr_tek', Object.assign({}, COMPTES.u_secr_tek, {desactive:true}), true],
  ['Admin : changer son propre profil', 'u_sysadmin', 'ecrire', T + 'users_v2/u_sysadmin', profil('direction', 'mokhtar'), false],
  ['Admin : se désactiver lui-même', 'u_sysadmin', 'ecrire', T + 'users_v2/u_sysadmin', Object.assign({}, COMPTES.u_sysadmin, {desactive:true}), false],
  ['Admin : changer l\'identifiant d\'un compte', 'u_sysadmin', 'ecrire', T + 'users_v2/u_secr_tek', Object.assign({}, COMPTES.u_secr_tek, {username:'autre'}), false],
  ['Admin : identifiant invalide (espace)', 'u_sysadmin', 'ecrire', T + 'users_v2/u_nouveau4', profil('secretaire_tek', 'avec espace'), false],
  ['Admin : supprimer un compte', 'u_sysadmin', 'supprimer', T + 'users_v2/u_ancien', null, true],

  // --- Responsable TEK-TREND ---
  ['Responsable : lecture TEK', 'u_responsable', 'lire', T + 'tek', null, true],
  ['Responsable : lecture GADH', 'u_responsable', 'lire', T + 'gadh', null, true],
  ['Responsable : lecture liaison', 'u_responsable', 'lire', T + 'liaison', null, true],
  ['Responsable : lecture MGT', 'u_responsable', 'lire', T + 'mgt', null, false],
  ['Responsable : lecture d\'un fichier MGT', 'u_responsable', 'lire', T + 'fichiers/f1', null, false],
  ['Responsable : modifier RH TEK', 'u_responsable', 'ecrire', T + 'tek/employees', {e1:{nom:'Ben Ali'}, e2:{nom:'Nour'}}, true],
  ['Responsable : modifier RH GADH', 'u_responsable', 'ecrire', T + 'gadh/gadh_employees', {g1:{nom:'Sana B.'}}, true],
  ['Responsable : supprimer une clé (réinitialisation)', 'u_responsable', 'supprimer', T + 'tek/cle_inconnue', null, true],
  ['Responsable : effacer tout le dossier GADH d\'un coup', 'u_responsable', 'supprimer', T + 'gadh', null, false],
  ['Responsable : lire la liste des comptes', 'u_responsable', 'lire', T + 'users_v2', null, false],
  ['Responsable : modifier un compte', 'u_responsable', 'ecrire', T + 'users_v2/u_secr_tek', Object.assign({}, COMPTES.u_secr_tek, {nom:'X'}), false],
  ['Responsable : lire le journal d\'audit', 'u_responsable', 'lire', T + 'audit', null, false],

  // --- Secrétaire TEK-TREND ---
  ['Secrétaire TEK : lecture du dossier TEK entier', 'u_secr_tek', 'lire', T + 'tek', null, false],
  ['Secrétaire TEK : lecture des salariés', 'u_secr_tek', 'lire', T + 'tek/employees', null, true],
  ['Secrétaire TEK : lecture des pointages (requête)', 'u_secr_tek', 'requete', T + 'tek', pref('attendance_'), true],
  ['Secrétaire TEK : lecture des dossiers RH', 'u_secr_tek', 'lire', T + 'tek/rh_base_2026', null, true],
  ['Secrétaire TEK : lecture des factures', 'u_secr_tek', 'lire', T + 'tek/factures', null, true],
  ['Secrétaire TEK : lecture des horaires', 'u_secr_tek', 'lire', T + 'tek/schedule', null, true],
  ['Secrétaire TEK : lecture du rendement (requête)', 'u_secr_tek', 'requete', T + 'tek', pref('prod_2'), false],
  ['Secrétaire TEK : lecture d\'une saisie de rendement', 'u_secr_tek', 'lire', T + 'tek/prod_' + AUJ, null, false],
  ['Secrétaire TEK : lecture du stock', 'u_secr_tek', 'lire', T + 'tek/stk_mv', null, false],
  ['Secrétaire TEK : lecture des commandes (facturation PERCKO)', 'u_secr_tek', 'lire', T + 'liaison/cmd_commandes', null, true],
  ['Secrétaire TEK : lecture GADH', 'u_secr_tek', 'lire', T + 'gadh/gadh_employees', null, false],
  ['Secrétaire TEK : lecture MGT', 'u_secr_tek', 'lire', T + 'mgt', null, false],
  ['Secrétaire TEK : modifier les salariés', 'u_secr_tek', 'ecrire', T + 'tek/employees', {e1:{nom:'Ben Ali Sana'}}, true],
  ['Secrétaire TEK : créer un pointage du jour', 'u_secr_tek', 'ecrire', T + 'tek/attendance_' + DEMAIN, {e1:{statut:'present'}}, true],
  ['Secrétaire TEK : supprimer un pointage', 'u_secr_tek', 'supprimer', T + 'tek/attendance_' + HIER, null, true],
  ['Secrétaire TEK : effacer toute la liste des salariés', 'u_secr_tek', 'supprimer', T + 'tek/employees', null, false],
  ['Secrétaire TEK : modifier les factures', 'u_secr_tek', 'ecrire', T + 'tek/factures', {f1:{numero:'FA1'}, f2:{numero:'FA2'}}, true],
  ['Secrétaire TEK : effacer toutes les factures', 'u_secr_tek', 'supprimer', T + 'tek/factures', null, false],
  ['Secrétaire TEK : modifier une saisie de rendement', 'u_secr_tek', 'ecrire', T + 'tek/prod_' + AUJ, {x:1}, false],
  ['Secrétaire TEK : modifier les horaires', 'u_secr_tek', 'ecrire', T + 'tek/schedule', {lun:'07-16'}, false],
  ['Secrétaire TEK : modifier une commande', 'u_secr_tek', 'ecrire', T + 'liaison/cmd_commandes', {c1:{numero:'99'}}, false],
  ['Secrétaire TEK : modifier les messages', 'u_secr_tek', 'ecrire', T + 'tek/messages', {}, false],
  ['Secrétaire TEK : s\'attribuer le profil administrateur', 'u_secr_tek', 'ecrire', T + 'users_v2/u_secr_tek', profil('sysadmin', 'secretaire'), false],
  ['Secrétaire TEK : s\'ajouter une société', 'u_secr_tek', 'ecrire', T + 'users_v2/u_secr_tek/societes/gadh', true, false],

  // --- Cheftaine TEK-TREND ---
  ['Cheftaine : lecture du dossier TEK entier', 'u_cheftaine', 'lire', T + 'tek', null, false],
  ['Cheftaine : lecture des saisies (requête)', 'u_cheftaine', 'requete', T + 'tek', pref('prod_2'), true],
  ['Cheftaine : lecture des fiches chaîne (requête)', 'u_cheftaine', 'requete', T + 'tek', pref('fc_2'), true],
  ['Cheftaine : lecture de la présence (requête)', 'u_cheftaine', 'requete', T + 'tek', pref('attendance_'), true],
  ['Cheftaine : lecture des salariés (objectif ajusté)', 'u_cheftaine', 'lire', T + 'tek/employees', null, true],
  ['Cheftaine : lecture des dossiers RH', 'u_cheftaine', 'lire', T + 'tek/rh_base_2026', null, false],
  ['Cheftaine : lecture des factures', 'u_cheftaine', 'lire', T + 'tek/factures', null, false],
  ['Cheftaine : requête détournée sur tout le dossier (a → z)', 'u_cheftaine', 'requete', T + 'tek', {orderByKey:true, startAt:'a', endAt:'z\uf8ff'}, false],
  ['Cheftaine : requête détournée sur un préfixe plus large (prod_)', 'u_cheftaine', 'requete', T + 'tek', pref('prod_'), false],
  ['Cheftaine : modifier la saisie du jour', 'u_cheftaine', 'ecrire', T + 'tek/prod_' + AUJ, {date:AUJ, hours:{'08:00':{op1:'12'}}}, true],
  ['Cheftaine : créer la saisie du lendemain', 'u_cheftaine', 'ecrire', T + 'tek/prod_' + DEMAIN, {date:DEMAIN, hours:{}}, true],
  ['Cheftaine : supprimer une saisie', 'u_cheftaine', 'supprimer', T + 'tek/prod_' + HIER, null, false],
  ['Cheftaine : modifier la fiche chaîne du jour', 'u_cheftaine', 'ecrire', T + 'tek/fc_' + AUJ, {rows:{a:2}}, true],
  ['Cheftaine : modifier les salariés', 'u_cheftaine', 'ecrire', T + 'tek/employees', {}, false],
  ['Cheftaine : modifier un pointage', 'u_cheftaine', 'ecrire', T + 'tek/attendance_' + AUJ, {e1:{statut:'absent'}}, false],
  ['Cheftaine : modifier les paramètres de production', 'u_cheftaine', 'ecrire', T + 'tek/obj_horaire_op', 80, false],
  ['Cheftaine : lecture GADH', 'u_cheftaine', 'lire', T + 'gadh', null, false],
  ['Cheftaine : lecture liaison', 'u_cheftaine', 'lire', T + 'liaison/cmd_commandes', null, false],

  // --- Responsable GADH ---
  ['Responsable GADH : lecture du dossier GADH', 'u_resp_gadh', 'lire', T + 'gadh', null, false],
  ['Responsable GADH : lecture RH GADH', 'u_resp_gadh', 'lire', T + 'gadh/gadh_employees', null, false],
  ['Responsable GADH : lecture du suivi des commandes', 'u_resp_gadh', 'lire', T + 'liaison/suivi_index', null, true],
  ['Responsable GADH : lecture du suivi (requête)', 'u_resp_gadh', 'requete', T + 'liaison', pref('suivi_d_'), true],
  ['Responsable GADH : enregistrer un retour (suivi)', 'u_resp_gadh', 'ecrire', T + 'liaison/suivi_d_lines-1', {lot:'1', ret:5}, true],
  ['Responsable GADH : créer un document de suivi', 'u_resp_gadh', 'ecrire', T + 'liaison/suivi_d_moves-1-1', {q:5}, true],
  ['Responsable GADH : supprimer un document de suivi', 'u_resp_gadh', 'supprimer', T + 'liaison/suivi_d_lines-1', null, false],
  ['Responsable GADH : saisir un retour (commandes)', 'u_resp_gadh', 'ecrire', T + 'liaison/cmd_saisies_c1', {[AUJ]:{retour:{r1:{M:8}}}}, true],
  ['Responsable GADH : modifier le catalogue des références', 'u_resp_gadh', 'ecrire', T + 'liaison/prod_references', {}, false],
  ['Responsable GADH : effacer la liste des commandes', 'u_resp_gadh', 'supprimer', T + 'liaison/cmd_commandes', null, false],
  ['Responsable GADH : lecture TEK', 'u_resp_gadh', 'lire', T + 'tek', null, false],
  ['Responsable GADH : lecture MGT', 'u_resp_gadh', 'lire', T + 'mgt', null, false],

  // --- Secrétaire GADH ---
  ['Secrétaire GADH : lecture RH GADH', 'u_secr_gadh', 'lire', T + 'gadh/gadh_employees', null, true],
  ['Secrétaire GADH : lecture des pointages (requête)', 'u_secr_gadh', 'requete', T + 'gadh', pref('gadh_attendance_'), true],
  ['Secrétaire GADH : lecture factures GADH (requête)', 'u_secr_gadh', 'requete', T + 'gadh', pref('gadh_fact'), true],
  ['Secrétaire GADH : lecture machines GADH', 'u_secr_gadh', 'lire', T + 'gadh/gadh_machines', null, false],
  ['Secrétaire GADH : modifier les salariés GADH', 'u_secr_gadh', 'ecrire', T + 'gadh/gadh_employees', {g1:{nom:'Sana'}, g2:{nom:'Amel'}}, true],
  ['Secrétaire GADH : effacer tous les salariés GADH', 'u_secr_gadh', 'supprimer', T + 'gadh/gadh_employees', null, false],
  ['Secrétaire GADH : modifier les factures GADH', 'u_secr_gadh', 'ecrire', T + 'gadh/gadh_factures', {f1:{numero:'G2'}}, true],
  ['Secrétaire GADH : modifier les horaires GADH', 'u_secr_gadh', 'ecrire', T + 'gadh/gadh_plannings', {p1:{nom:'Été'}}, true],
  ['Secrétaire GADH : lecture du suivi (pièces retournées)', 'u_secr_gadh', 'lire', T + 'liaison/suivi_index', null, true],
  ['Secrétaire GADH : modifier le suivi', 'u_secr_gadh', 'ecrire', T + 'liaison/suivi_d_lines-1', {lot:'2'}, false],
  ['Secrétaire GADH : lecture TEK', 'u_secr_gadh', 'lire', T + 'tek/employees', null, false],

  // --- Technico-commercial MGT ---
  ['Technico MGT : lecture MGT', 'u_technico', 'lire', T + 'mgt', null, true],
  ['Technico MGT : modifier un devis', 'u_technico', 'ecrire', T + 'mgt/mgt_devis', {d1:{n:3}}, true],
  ['Technico MGT : créer une demande SAV', 'u_technico', 'ecrire', T + 'mgt/mgt_demandes/d2', {objet:'Fuite', statut:'attente', date:AUJ}, true],
  ['Technico MGT : traiter une demande SAV', 'u_technico', 'ecrire', T + 'mgt/mgt_demandes/d1', {clientId:'c1', objet:'Panne', statut:'traitee', date:AUJ, ticketId:'t1'}, true],
  ['Technico MGT : supprimer une clé MGT', 'u_technico', 'supprimer', T + 'mgt/mgt_devis', null, true],
  ['Technico MGT : déposer un fichier joint', 'u_technico', 'ecrire', T + 'fichiers/f2', 'data:image/jpeg;base64,BBBB', true],
  ['Technico MGT : fichier qui n\'est pas un data-URL', 'u_technico', 'ecrire', T + 'fichiers/f3', 'texte', false],
  ['Technico MGT : effacer tout le dossier MGT d\'un coup', 'u_technico', 'supprimer', T + 'mgt', null, false],
  ['Technico MGT : lecture TEK', 'u_technico', 'lire', T + 'tek', null, false],
  ['Technico MGT : lecture GADH', 'u_technico', 'lire', T + 'gadh', null, false],
  ['Technico MGT : lecture liaison', 'u_technico', 'lire', T + 'liaison', null, false],

  // --- Secrétaire MGT (aucun droit pour le moment) ---
  ['Secrétaire MGT : lecture MGT', 'u_secr_mgt', 'lire', T + 'mgt', null, false],
  ['Secrétaire MGT : lecture d\'un fichier', 'u_secr_mgt', 'lire', T + 'fichiers/f1', null, false],
  ['Secrétaire MGT : écriture MGT', 'u_secr_mgt', 'ecrire', T + 'mgt/mgt_devis', {}, false],
  ['Secrétaire MGT : lecture TEK', 'u_secr_mgt', 'lire', T + 'tek', null, false],

  // --- Direction (Damien, Ghazia) : lecture seule stricte ---
  ['Damien : lecture TEK', 'u_damien', 'lire', T + 'tek', null, true],
  ['Damien : lecture GADH', 'u_damien', 'lire', T + 'gadh', null, true],
  ['Damien : lecture MGT', 'u_damien', 'lire', T + 'mgt', null, true],
  ['Damien : lecture liaison', 'u_damien', 'lire', T + 'liaison', null, true],
  ['Damien : lecture d\'un fichier joint', 'u_damien', 'lire', T + 'fichiers/f1', null, true],
  ['Damien : modifier une saisie TEK', 'u_damien', 'ecrire', T + 'tek/prod_' + AUJ, {x:1}, false],
  ['Damien : modifier RH GADH', 'u_damien', 'ecrire', T + 'gadh/gadh_employees', {}, false],
  ['Damien : modifier un devis MGT', 'u_damien', 'ecrire', T + 'mgt/mgt_devis', {}, false],
  ['Damien : modifier une commande', 'u_damien', 'ecrire', T + 'liaison/cmd_commandes', {}, false],
  ['Damien : déposer un fichier', 'u_damien', 'ecrire', T + 'fichiers/f9', 'data:x', false],
  ['Damien : supprimer une clé', 'u_damien', 'supprimer', T + 'tek/messages', null, false],
  ['Ghazia : modifier une saisie TEK', 'u_ghazia', 'ecrire', T + 'tek/prod_' + AUJ, {x:1}, false],
  ['Ghazia : supprimer une demande SAV', 'u_ghazia', 'supprimer', T + 'mgt/mgt_demandes/d1', null, false],
  ['Damien : lire la liste des comptes', 'u_damien', 'lire', T + 'users_v2', null, false],
  ['Damien : modifier son profil', 'u_damien', 'ecrire', T + 'users_v2/u_damien', profil('sysadmin', 'damien'), false],
  ['Damien : lire le journal d\'audit', 'u_damien', 'lire', T + 'audit', null, false],

  // --- Sessions ---
  ['Session : créer la sienne', 'u_cheftaine', 'ecrire', T + 'sessions/s_new', S('cheftaine', {role:'chef_chaine'}), true],
  ['Session : lire la sienne', 'u_cheftaine', 'lire', T + 'sessions/s_cheftaine', null, true],
  ['Session : lire la liste (non administrateur)', 'u_cheftaine', 'lire', T + 'sessions', null, false],
  ['Session : supprimer celle d\'un autre (non administrateur)', 'u_cheftaine', 'supprimer', T + 'sessions/s_secr', null, false],
  ['Session : se faire passer pour un autre', 'u_cheftaine', 'ecrire', T + 'sessions/s_faux', S('secretaire'), false],
  ['Session : champ non prévu', 'u_cheftaine', 'ecrire', T + 'sessions/s_new2', S('cheftaine', {pirate:true}), false],
  ['Session : l\'administrateur lit la liste', 'u_sysadmin', 'lire', T + 'sessions', null, true],
  ['Session : l\'administrateur déconnecte un compte', 'u_sysadmin', 'supprimer', T + 'sessions/s_secr', null, true],

  // --- Journal d'audit ---
  ['Audit : écrire sa propre entrée', 'u_secr_tek', 'ecrire', T + 'audit/j/' + AUJ + '/a_nouveau', {t:MAINTENANT, un:'secretaire', cle:'factures'}, true],
  ['Audit : regrouper une entrée récente', 'u_secr_tek', 'ecrire', T + 'audit/j/' + AUJ + '/a_recent', {t:MAINTENANT, un:'secretaire', cle:'factures', k:2}, true],
  ['Audit : modifier une entrée de plus de 10 minutes', 'u_secr_tek', 'ecrire', T + 'audit/j/' + AUJ + '/a_vieux', {t:MAINTENANT, un:'secretaire', cle:'x'}, false],
  ['Audit : effacer une ancienne entrée', 'u_secr_tek', 'supprimer', T + 'audit/j/' + AUJ + '/a_vieux', null, false],
  ['Audit : écrire au nom d\'un autre', 'u_cheftaine', 'ecrire', T + 'audit/j/' + AUJ + '/a_faux', {t:MAINTENANT, un:'secretaire', cle:'x'}, false],
  ['Audit : lecture par la Secrétaire', 'u_secr_tek', 'lire', T + 'audit', null, false],

  // --- Validation des données ---
  ['Validation : texte de 10 Mo dans une clé', 'u_responsable', 'ecrire', T + 'tek/messages', 'x'.repeat(10 * 1024 * 1024), false]
];

module.exports = {SCENARIOS, donneesInitiales, COMPTES, MAINTENANT};
