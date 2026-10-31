// ============================================================
// Fonctions serveur — gestion des comptes GTM Groupe
// ============================================================
// Appelées depuis l'écran Administration (profils-module.js). Elles utilisent
// le SDK Admin, qui tourne chez Google : aucune clé privée n'est jamais
// envoyée au navigateur. Chaque appel vérifie que l'appelant est un
// administrateur actif (profil marqué admin dans roles-config.js).
//
// roles-config.js est copié ici par outils/generer-regles.js : ne pas le
// modifier dans ce dossier, modifier celui de la racine.
'use strict';
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const admin = require('firebase-admin');
const C = require('./roles-config.js');

admin.initializeApp();
setGlobalOptions({region: 'europe-west1', maxInstances: 2});

const RACINE = 'groupe1';
const DOMAINE = 'tek-trend.app';
const db = () => admin.database();
const refCompte = (uid) => db().ref(`${RACINE}/users_v2/${uid}`);

function texte(v, max){ return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function erreurMdp(mdp, username){
  if(typeof mdp !== 'string' || mdp.length < 8) return 'Mot de passe : 8 caractères minimum';
  if(!/[A-Za-zÀ-ÿ]/.test(mdp) || !/[0-9]/.test(mdp)) return 'Mot de passe : au moins une lettre et un chiffre';
  if(username && mdp.toLowerCase() === String(username).toLowerCase()) return "Le mot de passe ne doit pas être l'identifiant";
  return '';
}
function profilPour(roleId, nom, username){
  const d = C.ROLES[roleId];
  if(!d) throw new HttpsError('invalid-argument', 'Rôle inconnu');
  return {nom, username, role: d.role, profil: roleId, groupe: !!d.groupe, societes: Object.assign({}, d.societes), maj: Date.now()};
}
async function exigerAdmin(req){
  if(!req.auth) throw new HttpsError('unauthenticated', 'Connexion requise');
  const p = (await refCompte(req.auth.uid).get()).val();
  if(!p || p.desactive === true || !C.ROLES[p.profil] || !C.ROLES[p.profil].admin)
    throw new HttpsError('permission-denied', "Action réservée à l'administrateur");
  return p;
}
function uidCible(req){
  const uid = texte(req.data && req.data.uid, 128);
  if(!uid) throw new HttpsError('invalid-argument', 'Compte non précisé');
  return uid;
}
async function journal(appelant, texteAction){
  const t = Date.now(), jour = new Date(t + 3600000).toISOString().slice(0, 10);
  const id = t.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  await db().ref(`${RACINE}/audit/j/${jour}/${id}`).set({t, u: appelant.nom || appelant.username, un: appelant.username, soc: 'groupe', cle: 'users_v2', lib: 'Comptes', txt: texteAction});
}
async function fermerSessions(username){
  const s = (await db().ref(`${RACINE}/sessions`).get()).val() || {};
  const maj = {};
  Object.keys(s).forEach(sid => { if(s[sid] && s[sid].username === username) maj[sid] = null; });
  if(Object.keys(maj).length) await db().ref(`${RACINE}/sessions`).update(maj);
}

// Créer un compte : identifiant + mot de passe dans Firebase Authentication, profil dans users_v2.
exports.comptesCreer = onCall(async (req) => {
  const moi = await exigerAdmin(req);
  const d = req.data || {};
  const username = texte(d.username, 40).toLowerCase(), nom = texte(d.nom, 80), roleId = texte(d.profil, 40);
  if(!/^[a-z0-9._-]{2,40}$/.test(username)) throw new HttpsError('invalid-argument', 'Identifiant invalide');
  if(!nom) throw new HttpsError('invalid-argument', 'Nom requis');
  const e = erreurMdp(d.motDePasse, username); if(e) throw new HttpsError('invalid-argument', e);
  const profil = profilPour(roleId, nom, username);
  let user;
  try { user = await admin.auth().createUser({email: `${username}@${DOMAINE}`, password: d.motDePasse, displayName: nom}); }
  catch(err){ if(err.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Cet identifiant est déjà utilisé'); throw new HttpsError('internal', 'Création impossible'); }
  try { await refCompte(user.uid).set(profil); }
  catch(err){ await admin.auth().deleteUser(user.uid).catch(() => {}); throw new HttpsError('internal', 'Profil non enregistré, création annulée'); }
  await journal(moi, `Compte créé : ${username} (${C.ROLES[roleId].label})`);
  return {uid: user.uid};
});

// Désactiver / réactiver : bloque la connexion (Auth) et la lecture des données (règles), ferme les sessions.
exports.comptesActiver = onCall(async (req) => {
  const moi = await exigerAdmin(req);
  const uid = uidCible(req), actif = !!(req.data && req.data.actif);
  if(uid === req.auth.uid) throw new HttpsError('failed-precondition', 'Vous ne pouvez pas désactiver votre propre compte');
  const p = (await refCompte(uid).get()).val();
  if(!p) throw new HttpsError('not-found', 'Compte introuvable');
  await admin.auth().updateUser(uid, {disabled: !actif});
  if(actif) await refCompte(uid).child('desactive').remove();
  else { await refCompte(uid).child('desactive').set(true); await admin.auth().revokeRefreshTokens(uid); await fermerSessions(p.username); }
  await refCompte(uid).child('maj').set(Date.now());
  await journal(moi, `Compte ${actif ? 'réactivé' : 'désactivé'} : ${p.username}`);
  return {ok: true};
});

// Nouveau mot de passe choisi par l'administrateur (réinitialisation d'accès).
exports.comptesMotDePasse = onCall(async (req) => {
  const moi = await exigerAdmin(req);
  const uid = uidCible(req);
  const p = (await refCompte(uid).get()).val();
  if(!p) throw new HttpsError('not-found', 'Compte introuvable');
  const e = erreurMdp(req.data && req.data.motDePasse, p.username); if(e) throw new HttpsError('invalid-argument', e);
  await admin.auth().updateUser(uid, {password: req.data.motDePasse});
  if(uid !== req.auth.uid){ await admin.auth().revokeRefreshTokens(uid); await fermerSessions(p.username); }
  await journal(moi, `Mot de passe réinitialisé : ${p.username}`);
  return {ok: true};
});

// Supprimer un compte (identifiant et profil). Les données métier, l'historique et le journal restent.
exports.comptesSupprimer = onCall(async (req) => {
  const moi = await exigerAdmin(req);
  const uid = uidCible(req);
  if(uid === req.auth.uid) throw new HttpsError('failed-precondition', 'Vous ne pouvez pas supprimer votre propre compte');
  const p = (await refCompte(uid).get()).val() || {};
  await admin.auth().deleteUser(uid).catch(err => { if(err.code !== 'auth/user-not-found') throw err; });
  await refCompte(uid).remove();
  if(p.username) await fermerSessions(p.username);
  await journal(moi, `Compte supprimé : ${p.username || uid}`);
  return {ok: true};
});
