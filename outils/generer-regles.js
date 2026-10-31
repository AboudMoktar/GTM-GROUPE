#!/usr/bin/env node
// ============================================================
// Générateur des règles Firebase Realtime Database (V2)
// ============================================================
// Lit roles-config.js (source unique des rôles) et écrit
// database.rules.v2.json. Usage, depuis la racine du projet :
//     node outils/generer-regles.js
// Ne publie rien : la publication se fait à la main, après les tests.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../roles-config.js');

const RACINE = 'groupe1';
const U = `root.child('${RACINE}/users_v2/' + auth.uid)`;
const ACTIF = `auth != null && ${U}.exists() && ${U}.child('desactive').val() !== true`;
const P = (r) => `${U}.child('profil').val() === '${r}'`;
const TYPE_OK = `newData.hasChildren() || newData.isBoolean() || newData.isNumber() || (newData.isString() && newData.val().length < 9500000)`;
const ou = (l) => l.length ? (l.length === 1 ? l[0] : '(' + l.join(' || ') + ')') : 'false';
const et = (l) => l.filter(Boolean).join(' && ');
const FIN = '';

function condCle(ress){
  const r = C.RESSOURCES[ress];
  if(r.tout) return null; // toute clé
  const l = (r.cles || []).map(c => `$cle === '${c}'`).concat((r.prefixes || []).map(p => `$cle.beginsWith('${p}')`));
  return ou(l);
}
// Condition sur le type d'écriture, d'après les actions c / m / s.
function condActions(acts, interditSuppression){
  const l = [];
  if(acts.indexOf('c') >= 0) l.push('(!data.exists() && newData.exists())');
  if(acts.indexOf('m') >= 0) l.push('(data.exists() && newData.exists())');
  if(acts.indexOf('s') >= 0) l.push(interditSuppression ? `(data.exists() && !newData.exists() && ${interditSuppression})` : '(data.exists() && !newData.exists())');
  if(!l.length) return null;
  if(l.length === 3 && !interditSuppression) return 'true';
  return ou(l);
}
const PROTEGEE = `!${ou(C.COLLECTIONS_PROTEGEES.map(c => `$cle === '${c}'`))}`;

function reglesDossier(dossier){
  const lectureDossier = [], lectureCle = [], ecriture = [];
  C.ORDRE.forEach(role => {
    const droits = C.ROLES[role].droits || {};
    const ids = C.ressourcesDuDossier(dossier);
    const famille = ids.length ? ids[0].split('.')[0] : dossier;
    // Lecture
    const src = C.sourcesLecture(role, dossier);
    if(src === 'tout') lectureDossier.push(P(role));
    else if(src){
      if(src.prefixes.length){
        lectureDossier.push(et([P(role), 'query.orderByKey === true',
          ou(src.prefixes.map(p => `(query.startAt === '${p}' && query.endAt === '${p}${FIN}')`))]));
      }
      lectureCle.push(et([P(role), ou(src.cles.map(c => `$cle === '${c}'`).concat(src.prefixes.map(p => `$cle.beginsWith('${p}')`)))]));
    }
    // Écriture
    const complet = droits[famille + '.*'];
    if(complet){
      const a = condActions(complet.replace('l', ''), null);
      if(a) ecriture.push(a === 'true' ? P(role) : et([P(role), a]));
      return;
    }
    const parRess = [];
    ids.forEach(id => {
      const acts = C.actions(role, id).replace('l', '');
      if(!acts) return;
      const a = condActions(acts, PROTEGEE);
      if(!a) return;
      parRess.push(et([condCle(id) || 'true', a]));
    });
    if(parRess.length) ecriture.push(et([P(role), ou(parRess)]));
  });
  return {
    '.read': lectureDossier.length ? et([ACTIF, ou(lectureDossier)]) : false,
    '$cle': {
      '.read': lectureCle.length ? et([ACTIF, ou(lectureCle)]) : false,
      '.write': ecriture.length ? et([ACTIF, ou(ecriture)]) : false,
      '.validate': TYPE_OK
    }
  };
}

function reglesFichiers(){
  const lire = [], ecrire = [];
  C.ORDRE.forEach(role => {
    const a = C.actions(role, 'mgt.fichiers');
    if(a.indexOf('l') >= 0) lire.push(P(role));
    const w = condActions(a.replace('l', ''), null);
    if(w) ecrire.push(w === 'true' ? P(role) : et([P(role), w]));
  });
  return {'$fid': {
    '.read': lire.length ? et([ACTIF, ou(lire)]) : false,
    '.write': ecrire.length ? et([ACTIF, ou(ecrire)]) : false,
    '.validate': `newData.isString() && newData.val().beginsWith('data:') && newData.val().length < 9000000`
  }};
}

function reglesComptes(){
  const ADMIN = et([ACTIF, ou(C.ORDRE.filter(r => C.ROLES[r].admin).map(P))]);
  // Le profil enregistré doit correspondre exactement à la configuration du rôle.
  const coherence = ou(C.ORDRE.map(r => {
    const d = C.ROLES[r];
    return '(' + et([`newData.child('profil').val() === '${r}'`, `newData.child('role').val() === '${d.role}'`,
      d.groupe ? `newData.child('groupe').val() === true` : `newData.child('groupe').val() !== true`]
      .concat(['tek', 'gadh', 'mgt'].map(s => (d.societes || {})[s] ? `newData.child('societes/${s}').val() === true` : `newData.child('societes/${s}').val() !== true`))) + ')';
  }));
  return {
    '.read': ADMIN,
    '$uid': {
      '.read': `auth != null && auth.uid === $uid`,
      // L'administrateur gère tous les comptes, mais ne peut ni changer son propre profil ni se désactiver.
      '.write': et([ADMIN, `($uid !== auth.uid || (newData.exists() && newData.child('profil').val() === data.child('profil').val() && newData.child('desactive').val() !== true))`]),
      '.validate': et([`newData.hasChildren(['nom', 'username', 'role', 'profil'])`, coherence,
        `(!data.exists() || newData.child('username').val() === data.child('username').val())`]),
      'nom': {'.validate': `newData.isString() && newData.val().length > 0 && newData.val().length <= 80`},
      'username': {'.validate': `newData.isString() && newData.val().matches(/^[a-z0-9._-]{2,40}$/)`},
      'desactive': {'.validate': `newData.isBoolean()`},
      'maj': {'.validate': `newData.isNumber()`},
      'societes': {'$s': {'.validate': `$s.matches(/^(tek|gadh|mgt)$/) && newData.isBoolean()`}},
      'groupe': {'.validate': `newData.isBoolean()`},
      '$autre': {'.validate': `$autre.matches(/^(role|profil)$/)`}
    }
  };
}

function reglesSessions(){
  const ADMIN = ou(C.ORDRE.filter(r => C.ROLES[r].admin).map(P));
  const MOI = `${U}.child('username').val()`;
  return {
    '.read': et([ACTIF, ADMIN]),
    '$sid': {
      '.read': ACTIF,
      '.write': et([ACTIF, `((newData.exists() && newData.child('username').val() === ${MOI} && (!data.exists() || data.child('username').val() === ${MOI})) || (!newData.exists() && (data.child('username').val() === ${MOI} || ${ADMIN})))`]),
      '.validate': `newData.hasChildren(['username', 'lastSeen'])`,
      'username': {'.validate': `newData.isString()`},
      'nom': {'.validate': `newData.isString()`},
      'role': {'.validate': `newData.isString()`},
      'device': {'.validate': `newData.isString()`},
      'loginAt': {'.validate': `newData.isNumber()`},
      'lastSeen': {'.validate': `newData.isNumber()`},
      '$autre': {'.validate': false}
    }
  };
}

function reglesAudit(){
  const LECTEURS = ou(C.ORDRE.filter(r => C.ROLES[r].auditLecture).map(P));
  const MOI = `${U}.child('username').val()`;
  return {
    '.read': et([ACTIF, LECTEURS]),
    'j': {'$jour': {'$id': {
      // Chacun écrit ses propres entrées ; modification ou suppression seulement dans les 10 minutes (regroupement de 2 minutes).
      '.write': et([ACTIF, `(!newData.exists() || newData.child('un').val() === ${MOI})`,
        `(!data.exists() || (data.child('un').val() === ${MOI} && data.child('t').val() > now - 600000))`]),
      '.validate': `$jour.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) && newData.hasChildren(['t', 'un', 'cle']) && newData.child('t').isNumber() && newData.child('t').val() <= now + 60000`
    }}}
  };
}

function generer(){
  const g = {};
  ['tek', 'gadh', 'liaison', 'mgt'].forEach(d => { g[d] = reglesDossier(d); });
  g.fichiers = reglesFichiers();
  g.users_v2 = reglesComptes();
  g.sessions = reglesSessions();
  g.audit = reglesAudit();
  // portail/ : supprimé (aucun portail client). Rien n'y est lisible ni modifiable.
  return {rules: {'.read': false, '.write': false, [RACINE]: g}};
}

if(require.main === module){
  const sortie = path.join(__dirname, '..', 'database.rules.v2.json');
  const texte = JSON.stringify(generer(), null, 2) + '\n';
  fs.writeFileSync(sortie, texte);
  console.log('Règles écrites : ' + sortie + ' (' + Math.round(texte.length / 1024) + ' Ko)');
  // Les fonctions serveur utilisent la même configuration des rôles.
  const copie = path.join(__dirname, '..', 'functions', 'roles-config.js');
  fs.copyFileSync(path.join(__dirname, '..', 'roles-config.js'), copie);
  console.log('Configuration copiée pour les fonctions serveur : ' + copie);
}
module.exports = {generer};
