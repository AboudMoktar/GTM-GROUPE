#!/usr/bin/env node
// ============================================================
// SAUVEGARDE QUOTIDIENNE DE FIREBASE — lecture seule, fichier chiffré
// ============================================================
// Lancé chaque nuit par .github/workflows/sauvegarde.yml (ou à la main). Il :
//  1) se connecte avec un compte de service Google (secret FIREBASE_SA, JSON) ;
//  2) LIT toute la base (/.json?format=export) et les règles de sécurité — il n'écrit jamais rien ;
//  3) vérifie que les règles en production sont exactement database.rules.v2.json ;
//  4) compresse puis CHIFFRE le tout (AES-256-GCM, clé dérivée par scrypt de SAUVEGARDE_CLE) :
//     le dépôt étant public, le fichier n'est lisible que par qui connaît la phrase secrète.
// Sortie : sauvegarde/gtm-AAAA-MM-JJ.json.gz.chiffre  (+ un résumé sans donnée en clair).
// Restauration : node outils/dechiffrer-sauvegarde.js <fichier> → JSON en clair, sur VOTRE poste.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const BASE = process.env.FIREBASE_URL || 'https://gtm-groupe-default-rtdb.europe-west1.firebasedatabase.app';

function erreur(m){ console.error('::error::' + m); process.exit(1); }
async function jeton(sa){
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const u = b({alg: 'RS256', typ: 'JWT'}) + '.' + b({iss: sa.client_email, aud: sa.token_uri, iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'});
  const sig = crypto.sign('RSA-SHA256', Buffer.from(u), sa.private_key).toString('base64url');
  const r = await fetch(sa.token_uri, {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + u + '.' + sig});
  const j = await r.json(); if(!j.access_token) erreur('Connexion du compte de service refusée : ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
function chiffrer(donnees, phrase){
  const sel = crypto.randomBytes(16), iv = crypto.randomBytes(12), cle = crypto.scryptSync(phrase, sel, 32, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024});
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv), corps = Buffer.concat([c.update(donnees), c.final()]);
  return Buffer.concat([Buffer.from('GTMS1'), sel, iv, c.getAuthTag(), corps]); // format : en-tête(5) sel(16) iv(12) tag(16) données
}
function canon(v){
  if(Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if(v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

(async () => {
  if(!process.env.FIREBASE_SA) erreur('Secret FIREBASE_SA absent (compte de service, voir SAUVEGARDE.md).');
  const phrase = process.env.SAUVEGARDE_CLE || ''; if(phrase.length < 16) erreur('Secret SAUVEGARDE_CLE absent ou trop court (16 caractères minimum).');
  let sa; try { sa = JSON.parse(process.env.FIREBASE_SA); } catch(e){ erreur('FIREBASE_SA n\'est pas un JSON valide.'); }
  const t = await jeton(sa), h = {Authorization: 'Bearer ' + t};
  const rd = await fetch(BASE + '/.json?format=export', {headers: h}); if(!rd.ok) erreur('Lecture de la base impossible : ' + rd.status);
  const texte = await rd.text(), base = JSON.parse(texte);
  const rr = await fetch(BASE + '/.settings/rules.json', {headers: h}); if(!rr.ok) erreur('Lecture des règles impossible : ' + rr.status);
  const regles = await rr.text();
  const jour = new Date().toISOString().slice(0, 10), dossier = path.join(process.cwd(), 'sauvegarde'); fs.mkdirSync(dossier, {recursive: true});
  const paquet = Buffer.from(JSON.stringify({version: 1, date: new Date().toISOString(), base, regles}));
  const fichier = path.join(dossier, `gtm-${jour}.json.gz.chiffre`);
  fs.writeFileSync(fichier, chiffrer(zlib.gzipSync(paquet, {level: 9}), phrase));
  // Résumé SANS donnée en clair : tailles et nombre de clés par dossier.
  const g = (base && base.groupe1) || {}, resume = Object.keys(g).sort().map(k => `${k}: ${Object.keys(g[k] || {}).length} clés, ${Math.round(JSON.stringify(g[k]).length / 1024)} Ko`);
  fs.writeFileSync(path.join(dossier, 'resume.txt'), `Sauvegarde du ${jour}\nTaille brute : ${Math.round(texte.length / 1024)} Ko, chiffrée : ${Math.round(fs.statSync(fichier).size / 1024)} Ko\n` + resume.join('\n') + '\n');
  console.log(fs.readFileSync(path.join(dossier, 'resume.txt'), 'utf8'));
  // Règles en production = database.rules.v2.json ?
  const sansCommentaires = s => JSON.parse(s.replace(/^\s*\/\/.*$/mg, ''));
  const attendu = sansCommentaires(fs.readFileSync(path.join(__dirname, '..', 'database.rules.v2.json'), 'utf8'));
  if(canon(sansCommentaires(regles)) !== canon(attendu)){
    console.error('::warning::Les règles en production ne correspondent pas à database.rules.v2.json : à vérifier (la sauvegarde est faite quand même).');
    fs.writeFileSync(path.join(dossier, 'ALERTE-REGLES.txt'), 'Les règles en production diffèrent de database.rules.v2.json.\n');
  } else console.log('Règles en production = database.rules.v2.json');
})().catch(e => erreur(String(e && e.message || e)));
