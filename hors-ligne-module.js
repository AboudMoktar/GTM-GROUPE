// ============================================================
// HORS-LIGNE FIABLE
// ============================================================
// 1) Boîte d'envoi persistante : toute écriture vers Firebase est notée sur le
//    téléphone tant que le serveur ne l'a pas confirmée. Si l'app est fermée
//    avant, l'écriture est renvoyée à la prochaine ouverture — après avoir
//    vérifié que personne d'autre n'a modifié la même donnée entre-temps.
//    Sinon c'est un « conflit » : la version du serveur est gardée, et la
//    version faite hors ligne est mise de côté (rien n'est perdu), à revoir.
// 2) Copie locale des dernières données reçues (IndexedDB, par compte) : l'app
//    peut démarrer sans réseau et affiche les vraies données, pas une base vide
//    (une saisie faite sur une base vide écraserait le serveur au retour).
// 3) Profil mémorisé : démarrage immédiat, même sans réseau.
// 4) État réel de la connexion (.info/connected) : badge et bandeau « Hors ligne ».
// 5) Une longue coupure ne provoque plus de déconnexion au retour du réseau.

const HL_BOITE = '__boite', HL_CONFLITS = '__conflits', HL_PROFIL = '__profil_', HL_ENLIGNE = '__enligne';
let hlConnecte = null;            // null = encore inconnu (démarrage), puis true / false
let hlHorsLigneDepuis = null, hlReconnecteA = 0, hlDureeHorsLigne = 0, hlVerifSessionApresAbsence = false, hlVerifTimer = null;
let hlDossiersCharges = new Set(); // dossiers dont les vraies données sont en mémoire
let hlServeur = {};               // dernière valeur connue du serveur, par clé
let hlBoiteDemarrage = null;      // écritures en attente trouvées à l'ouverture (à vérifier)
let hlDernierEtatBadge = 'off';
let hlDernierToastBlocage = 0;

function hlLS(k, def){ try { const v = window.localStorage.getItem(CACHE_PREFIX + k); return v ? JSON.parse(v) : def; } catch(e){ return def; } }
function hlLSset(k, v){ try { window.localStorage.setItem(CACHE_PREFIX + k, JSON.stringify(v)); } catch(e){} }
function hlBoite(){ return hlLS(HL_BOITE, {}) || {}; }
function hlConflits(){ return hlLS(HL_CONFLITS, []) || []; }
function hlNbAttente(){ return Object.keys(hlBoite()).length; }

// Forme canonique (ordre des clés, objets/tableaux vides et null ignorés —
// comme Firebase les stocke), pour comparer deux versions d'une donnée.
function hlCanon(v){
  if(v === null || v === undefined) return undefined;
  if(Array.isArray(v)){
    const a = v.map(hlCanon);
    while(a.length && a[a.length-1] === undefined) a.pop();
    return a.length ? a.map(x => x === undefined ? null : x) : undefined;
  }
  if(typeof v === 'object'){
    const o = {};
    Object.keys(v).sort().forEach(k => { const c = hlCanon(v[k]); if(c !== undefined) o[k] = c; });
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}
function hlEmpreinte(v){
  const s = JSON.stringify(hlCanon(v)) || '';
  let h = 5381;
  for(let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return s.length + ':' + (h >>> 0).toString(36);
}
function hlValeurServeur(cle, sous){ const v = hlServeur[cle]; return sous ? (v ? v[sous] : undefined) : v; }
function hlValeurLocale(cle, sous){
  const v = getJSON(cle, null);
  return sous ? ((v && v[sous] !== undefined) ? v[sous] : null) : v;
}
function hlNoterServeur(cle, sous, valeur){
  if(!sous){ hlServeur[cle] = valeur; return; }
  const o = (hlServeur[cle] && typeof hlServeur[cle] === 'object') ? hlServeur[cle] : {};
  if(valeur === null || valeur === undefined) delete o[sous]; else o[sous] = valeur;
  hlServeur[cle] = o;
}
// Remplace localement (mémoire + téléphone, sans envoi) la valeur d'une clé ou d'une sous-clé.
function hlAppliquerLocal(cle, sous, valeur){
  let v = valeur;
  if(sous){
    v = getJSON(cle, {}) || {};
    if(valeur === null || valeur === undefined) delete v[sous]; else v[sous] = valeur;
  }
  memoryCache[CACHE_PREFIX + cle] = v === undefined ? null : JSON.parse(JSON.stringify(v === undefined ? null : v));
  try { window.localStorage.setItem(CACHE_PREFIX + cle, JSON.stringify(v === undefined ? null : v)); } catch(e) {}
}

// --- Format des données échangées avec Firebase ---
// 1) Firebase refuse tout nom de clé contenant . # $ / [ ] (ou vide, ou caractère de
//    contrôle). Or certaines données utilisent directement des libellés lisibles comme
//    noms de champ (ex. "Gouvernorat / Zone", "Ville / Delegation" dans CHAQUE fiche
//    client du CRM MGT) : l'enregistrement échouait alors AVANT même l'envoi réseau —
//    c'est pour cela que les clients du CRM n'ont jamais pu être enregistrés sur le
//    serveur. Ces caractères sont remplacés à l'envoi par des équivalents autorisés
//    (formes Unicode « pleine chasse ») et remis à l'identique à la réception : le
//    reste de l'application voit toujours les libellés d'origine. Sans effet sur les
//    clés déjà valides (presque toutes).
// 2) Les données du CRM MGT (mgt_crm_*) sont envoyées d'un seul bloc de texte (JSON).
//    Ce CRM a été écrit pour un stockage qui rend EXACTEMENT ce qu'on lui donne, alors
//    que Firebase, en arborescence, supprime les listes vides et peut transformer une
//    liste en objet (source de plantages subtils à la relecture). Un seul bloc de texte
//    s'enregistre aussi bien plus vite que des centaines de milliers de petits champs.
const HL_TEXTE_JSON = '__gtm_json_v1:';
const HL_TEXTE_MAX_OCTETS = 9500000; // limite Firebase : 10 Mo par texte
const HL_VERS_FB = {'.':'．', '#':'＃', '$':'＄', '/':'／', '[':'［', ']':'］'};
const HL_DEPUIS_FB = {'．':'.', '＃':'#', '＄':'$', '／':'/', '［':'[', '］':']'};
const HL_CLE_VIDE = '∅';
const HL_RE_CLE_INTERDITE = /[.#$\/\[\]\u0000-\u001F\u007F]/;
const HL_RE_CLE_CODEE = /[．＃＄／［］␀-␟␡]/;
function hlCleVersFirebase(k){
  if(k === '') return HL_CLE_VIDE;
  if(!HL_RE_CLE_INTERDITE.test(k)) return k;
  let r = '';
  for(const ch of k){
    const c = ch.charCodeAt(0);
    r += HL_VERS_FB[ch] || (c < 32 ? String.fromCharCode(0x2400 + c) : (c === 127 ? '␡' : ch));
  }
  return r;
}
function hlCleDepuisFirebase(k){
  if(k === HL_CLE_VIDE) return '';
  if(!HL_RE_CLE_CODEE.test(k)) return k;
  let r = '';
  for(const ch of k){
    const c = ch.charCodeAt(0);
    r += HL_DEPUIS_FB[ch] || ((c >= 0x2400 && c <= 0x241F) ? String.fromCharCode(c - 0x2400) : (c === 0x2421 ? '\u007F' : ch));
  }
  return r;
}
// Convertit les NOMS de clés (jamais les valeurs) de toute l'arborescence. Ne recrée que
// les objets réellement modifiés : sur une donnée sans clé à convertir (presque toutes),
// la même référence est renvoyée telle quelle, sans copie.
function hlConvertirCles(v, conv){
  if(Array.isArray(v)){
    let copie = null;
    for(let i = 0; i < v.length; i++){
      const x = hlConvertirCles(v[i], conv);
      if(x !== v[i]){ if(!copie) copie = v.slice(); copie[i] = x; }
    }
    return copie || v;
  }
  if(v && typeof v === 'object'){
    const cles = Object.keys(v);
    let copie = null;
    for(let i = 0; i < cles.length; i++){
      const k = cles[i], nk = conv(k), x = hlConvertirCles(v[k], conv);
      if(!copie && (nk !== k || x !== v[k])){
        copie = {};
        for(let j = 0; j < i; j++) copie[cles[j]] = v[cles[j]];
      }
      if(copie) copie[nk] = x;
    }
    return copie || v;
  }
  return v;
}
function hlCleEnTexte(ref){ return !!ref && !ref.sous && typeof ref.cle === 'string' && ref.cle.indexOf('mgt_crm_') === 0; }
function hlOctets(s){
  if(s.length * 3 <= HL_TEXTE_MAX_OCTETS) return s.length; // forcément sous la limite
  try { return new TextEncoder().encode(s).length; } catch(e){ return s.length * 3; }
}
// Donnée prête à être envoyée. La forme JSON retire aussi ce que Firebase refuserait
// (valeurs "undefined", NaN…) — exactement comme ce qui est déjà gardé sur le téléphone.
function hlPourFirebase(valeur, ref){
  if(valeur === undefined || valeur === null) return null;
  const texte = JSON.stringify(valeur);
  if(texte === undefined) return null;
  if(hlCleEnTexte(ref) && hlOctets(texte) <= HL_TEXTE_MAX_OCTETS) return HL_TEXTE_JSON + texte;
  return hlConvertirCles(JSON.parse(texte), hlCleVersFirebase);
}
// Inverse exact, pour une valeur reçue de Firebase.
function hlDepuisFirebase(valeur){
  if(typeof valeur === 'string' && valeur.indexOf(HL_TEXTE_JSON) === 0){
    try { return JSON.parse(valeur.slice(HL_TEXTE_JSON.length)); }
    catch(e){ console.error('Donnée illisible reçue de Firebase :', e); return null; }
  }
  return hlConvertirCles(valeur, hlCleDepuisFirebase);
}
// Pour un dossier entier reçu de Firebase ({cle: valeur, …}).
function hlDossierDepuisFirebase(data){
  const out = {};
  Object.keys(data || {}).forEach(k => { out[hlCleDepuisFirebase(k)] = hlDepuisFirebase(data[k]); });
  return out;
}

// --- Écriture vers Firebase (point unique) ---
// ref = {cle, sous} : où se trouve la valeur localement (sous = sous-clé, ex. une
// fiche client dans mgt_clients).
function hlEcrire(chemin, valeur, ref){
  if(!firebaseConfigured()) return;
  const boite = hlBoite();
  const e = boite[chemin] || {cle: ref.cle, sous: ref.sous || null, base: hlEmpreinte(hlValeurServeur(ref.cle, ref.sous)), ts: Date.now(), n: 0};
  e.n = (e.n || 0) + 1;
  e.ts = Date.now();
  boite[chemin] = e;
  hlLSset(HL_BOITE, boite);
  const n = e.n;
  hlMajBadge();
  if(!firebaseReady || !fbRootRef) return;
  let requete;
  try {
    requete = fbRootRef.child(chemin).set(hlPourFirebase(valeur, ref));
  } catch(err){
    // Donnée refusée AVANT l'envoi (format) : la renvoyer plus tard échouerait exactement
    // de la même façon. Sans ce filet, l'erreur remontait jusqu'à l'écran appelant
    // (enregistrement interrompu) — et quand elle survenait pendant la réception des
    // données au démarrage, elle interrompait toute la mise à jour de l'écran.
    console.error('Erreur de synchronisation Firebase (donnée refusée avant envoi) :', chemin, err);
    const b = hlBoite(); delete b[chemin]; hlLSset(HL_BOITE, b);
    showToast('⚠️ Enregistrement impossible : format de donnée refusé par le serveur');
    hlMajBadge();
    return;
  }
  requete.then(function(){
    const b = hlBoite();
    if(b[chemin]){
      if(b[chemin].n === n) delete b[chemin];
      else b[chemin].base = hlEmpreinte(valeur); // une écriture plus récente reste à confirmer : le serveur a maintenant celle-ci
      hlLSset(HL_BOITE, b);
    }
    hlNoterServeur(ref.cle, ref.sous, valeur);
    hlMajBadge();
  }).catch(function(err){
    console.error('Erreur de synchronisation Firebase :', err);
    if(err && /permission/i.test(String(err.code || err.message || ''))){
      const b = hlBoite(); delete b[chemin]; hlLSset(HL_BOITE, b); // refus définitif : inutile de réessayer
      showToast('⚠️ Enregistrement refusé par le serveur (droits insuffisants)');
    } else {
      showToast('⚠️ Non synchronisé (vérifiez la connexion)');
    }
    hlMajBadge();
  });
}

// --- Écriture confirmée (ex. un import) : UNE SEULE requête réseau, avec délai ---
// Utilisée quand l'appelant a besoin de savoir si le serveur a bien reçu la donnée.
// Important : elle ne fait PAS une deuxième requête séparée en plus de l'écriture
// normale — pour les plus grosses données (ex. des centaines de fiches client),
// envoyer deux fois la même chose en même temps double le temps de transfert et
// rend un délai dépassé bien plus probable alors que la connexion est bonne.
function hlEcrireConfirme(chemin, valeur, ref, timeoutMs){
  if(!firebaseConfigured()) return Promise.resolve({ok:true});
  const boite = hlBoite();
  const e = boite[chemin] || {cle: ref.cle, sous: ref.sous || null, base: hlEmpreinte(hlValeurServeur(ref.cle, ref.sous)), ts: Date.now(), n: 0};
  e.n = (e.n || 0) + 1;
  e.ts = Date.now();
  boite[chemin] = e;
  hlLSset(HL_BOITE, boite);
  const n = e.n;
  hlMajBadge();
  if(!firebaseReady || !fbRootRef) return Promise.resolve({ok:true});
  const t0 = Date.now();
  // set() peut lever une erreur IMMÉDIATEMENT (avant même d'envoyer quoi que ce soit au
  // réseau), par exemple si la donnée contient une valeur "undefined" quelque part —
  // sans ce filet, ce genre d'erreur remontait jusqu'à l'écran comme un vague "problème
  // de connexion", alors que la connexion n'y était pour rien et que la vraie cause
  // (visible ci-dessous) restait invisible.
  let requete;
  try {
    requete = fbRootRef.child(chemin).set(hlPourFirebase(valeur, ref));
  } catch(err){
    const b = hlBoite(); delete b[chemin]; hlLSset(HL_BOITE, b); hlMajBadge();
    console.error('Erreur de synchronisation Firebase (immédiate) :', err);
    const msg = (err && err.message) || String(err);
    return Promise.resolve({ok:false, raison:"Refusé avant l'envoi : " + msg});
  }
  // Nettoyage normal de la boîte d'attente dès que le serveur répond VRAIMENT —
  // même si notre délai ci-dessous s'est déjà écoulé entre-temps (la requête
  // réseau n'est jamais annulée, on se contente de ne plus attendre sa réponse
  // pour ce qu'on renvoie à l'appelant).
  requete.then(function(){
    const b = hlBoite();
    if(b[chemin]){
      if(b[chemin].n === n) delete b[chemin];
      else b[chemin].base = hlEmpreinte(valeur);
      hlLSset(HL_BOITE, b);
    }
    hlNoterServeur(ref.cle, ref.sous, valeur);
    hlMajBadge();
  }).catch(function(err){
    if(err && /permission/i.test(String(err.code || err.message || ''))){
      const b = hlBoite(); delete b[chemin]; hlLSset(HL_BOITE, b);
    }
    hlMajBadge();
  });
  return hlAvecDelai(requete, timeoutMs || 35000).then(function(){
    return {ok:true};
  }).catch(function(err){
    if(err && err.hlDelai){
      const etat = hlConnecte === true ? "l'application se croyait en ligne" : (hlConnecte === false ? "l'application se savait hors ligne" : "état de connexion inconnu");
      return {ok:false, raison:"Pas de confirmation du serveur après " + Math.round((Date.now()-t0)/1000) + "s (" + etat + "). Vérifiez votre connexion internet (essayez de changer de Wi-Fi/4G) puis réessayez."};
    }
    console.error('Erreur de synchronisation Firebase :', err);
    const msg = (err && (err.message || err.code)) || String(err);
    if(/permission/i.test(msg)) return {ok:false, raison:"Refusé par le serveur : droits insuffisants sur ce compte pour enregistrer dans MGT."};
    return {ok:false, raison:"Refusé par le serveur : " + msg};
  });
}
window.hlEcrireConfirme = hlEcrireConfirme;

// Avant toute écriture : les vraies données du dossier doivent être en mémoire,
// sinon on écraserait le serveur avec une base vide ou incomplète.
function hlEcritureAutorisee(key){
  if(!firebaseConfigured() || !currentUser) return true;
  if(typeof isPortail === 'function' && isPortail()) return true;
  const d = (typeof firebaseDossierDe === 'function') ? firebaseDossierDe(key) : null;
  if(!d || hlDossiersCharges.has(d)) return true;
  if(Date.now() - hlDernierToastBlocage > 8000){
    hlDernierToastBlocage = Date.now();
    showToast("Données pas encore chargées sur cet appareil : connexion internet nécessaire pour enregistrer.");
  }
  return false;
}
// Même vérification que hlEcritureAutorisee, mais SANS déclencher de message —
// pour qu'une page comme le module MGT (dans son propre cadre) puisse ATTENDRE
// que les données soient prêtes avant d'écrire, au lieu de découvrir après coup
// qu'un enregistrement (ex. un import de centaines de clients) a été ignoré.
window.gtmDonneesPretes = function(key){
  if(!firebaseConfigured() || !currentUser) return true;
  if(typeof isPortail === 'function' && isPortail()) return true;
  const d = (typeof firebaseDossierDe === 'function') ? firebaseDossierDe(key) : null;
  return !d || hlDossiersCharges.has(d);
};

// --- Réception des données d'un dossier (serveur ou copie locale) ---
// Une écriture restée sans réponse du serveur depuis longtemps (ex. une
// coupure en plein envoi, un onglet resté ouvert des heures) ne doit plus
// bloquer indéfiniment l'affichage des vraies données du serveur : passé ce
// délai, on arrête de la considérer "en cours" pour l'affichage (elle reste
// quand même dans la boîte pour être réessayée au prochain démarrage).
const HL_ATTENTE_MAX_MS = 90000;
function hlClesEnAttente(){
  const s = new Set();
  const maintenant = Date.now();
  Object.values(hlBoite()).forEach(e => { if((maintenant - (e.ts || 0)) < HL_ATTENTE_MAX_MS) s.add(e.cle); });
  return s;
}
function hlRecevoirDossier(dossier, data, depuisServeur){
  const enAttente = hlClesEnAttente();
  Object.keys(data || {}).forEach(k => {
    hlServeur[k] = data[k];
    if(enAttente.has(k)) return; // tant que l'envoi n'est pas confirmé, la version locale reste affichée
    memoryCache[CACHE_PREFIX + k] = data[k];
  });
  hlDossiersCharges.add(dossier);
  if(depuisServeur){
    hlTraiterDemarrage(dossier);
    hlSauverCopie(dossier, data);
  }
}
function hlCheminDansDossier(chemin, dossier){
  return chemin === dossier || chemin.indexOf(dossier + '/') === 0;
}
// Écritures restées en attente à l'ouverture : renvoi, ou conflit si la donnée
// a été modifiée ailleurs entre-temps.
function hlTraiterDemarrage(dossier){
  if(!hlBoiteDemarrage) return;
  const chemins = Object.keys(hlBoiteDemarrage).filter(c => hlCheminDansDossier(c, dossier));
  if(!chemins.length) return;
  let nbConflits = 0, nbRenvois = 0;
  chemins.forEach(chemin => {
    const e = hlBoite()[chemin] || hlBoiteDemarrage[chemin];
    delete hlBoiteDemarrage[chemin];
    const srv = hlValeurServeur(e.cle, e.sous), loc = hlValeurLocale(e.cle, e.sous);
    const hS = hlEmpreinte(srv), hL = hlEmpreinte(loc);
    if(hS === hL){
      const b = hlBoite(); delete b[chemin]; hlLSset(HL_BOITE, b);
    } else if(hS === e.base){
      nbRenvois++;
      hlEcrire(chemin, loc, e);
    } else {
      nbConflits++;
      const c = hlConflits();
      c.push({chemin, cle: e.cle, sous: e.sous || null, locale: loc === undefined ? null : loc, serveur: srv === undefined ? null : srv, dateLocale: e.ts, ts: Date.now()});
      hlLSset(HL_CONFLITS, c);
      const b = hlBoite(); delete b[chemin]; hlLSset(HL_BOITE, b);
      hlAppliquerLocal(e.cle, e.sous, srv === undefined ? null : srv);
    }
  });
  if(nbRenvois) showToast(`${nbRenvois} modification(s) faite(s) hors ligne envoyée(s)`);
  if(nbConflits) setTimeout(() => showToast(`⚠️ ${nbConflits} modification(s) hors ligne en conflit : touchez le badge de synchronisation`), 2700);
  hlMajBadge();
}

// --- Copie locale des données (IndexedDB), par compte ---
let hlDbPromesse = null;
function hlDb(){
  if(!hlDbPromesse) hlDbPromesse = new Promise((res, rej) => {
    try {
      const r = indexedDB.open('gtm-hors-ligne', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('dossiers'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch(e) { rej(e); }
  });
  return hlDbPromesse;
}
function hlIdb(mode, fn){
  return hlDb().then(db => new Promise((res, rej) => {
    const tx = db.transaction('dossiers', mode);
    const req = fn(tx.objectStore('dossiers'));
    tx.oncomplete = () => res(req ? req.result : undefined);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  }));
}
function hlCleCopie(dossier){ return (currentUser ? currentUser.uid : '?') + '|' + FIREBASE_PATH + '|' + dossier; }
const hlCopiesEnCours = {};
function hlSauverCopie(dossier, data){
  if(!currentUser || !currentUser.uid) return;
  const cle = hlCleCopie(dossier);
  clearTimeout(hlCopiesEnCours[cle]);
  hlCopiesEnCours[cle] = setTimeout(() => {
    hlIdb('readwrite', st => st.put({data, ts: Date.now()}, cle)).catch(err => console.warn('Copie locale impossible', err));
  }, 1500);
}
function hlAvecDelai(promesse, ms){
  return Promise.race([promesse, new Promise((_, rej) => setTimeout(() => { const e = new Error('délai dépassé'); e.hlDelai = true; rej(e); }, ms))]);
}
function hlDossiersAttendus(){
  const d = (typeof firebaseDossiersLisibles === 'function') ? firebaseDossiersLisibles().slice() : [];
  if(typeof isGroupe === 'function' && isGroupe()) d.push('users_v2');
  return d;
}
// Au démarrage : recharge la dernière copie locale de chaque dossier lisible.
async function hlChargerCopies(){
  hlBoiteDemarrage = JSON.parse(JSON.stringify(hlBoite()));
  if(!firebaseConfigured() || !currentUser || !currentUser.uid) return;
  const dossiers = hlDossiersAttendus();
  await Promise.all(dossiers.map(d => hlAvecDelai(hlIdb('readonly', st => st.get(hlCleCopie(d))), 3000).then(rec => {
    if(rec && rec.data && !hlDossiersCharges.has(d)) hlRecevoirDossier(d, hlDossierDepuisFirebase(rec.data), false);
  }).catch(() => {})));
}
function hlOublierCompte(uid){
  try { window.localStorage.removeItem(CACHE_PREFIX + HL_PROFIL + uid); } catch(e) {}
  hlIdb('readwrite', st => { const prefixe = uid + '|'; const r = st.getAllKeys(); r.onsuccess = () => (r.result || []).forEach(k => { if(String(k).indexOf(prefixe) === 0) st.delete(k); }); return r; }).catch(() => {});
}

// --- Profil mémorisé (démarrage immédiat, même sans réseau) ---
function hlProfilMemorise(uid){ return hlLS(HL_PROFIL + uid, null); }
function hlMemoriserProfil(uid, profile){ hlLSset(HL_PROFIL + uid, profile); }
function hlRafraichirProfil(fbUser, ancien){
  if(!firebaseReady || !fbRootRef) return;
  fbRootRef.child('users_v2/' + fbUser.uid).once('value').then(function(snap){
    if(!currentUser || currentUser.uid !== fbUser.uid) return;
    const p = snap.val();
    if(!p){ hlOublierCompte(fbUser.uid); forceLocalLogout(); renderLogin("Ce compte n'a plus accès à l'application. Contactez le responsable."); return; }
    if(hlEmpreinte(p) === hlEmpreinte(ancien)) return;
    hlMemoriserProfil(fbUser.uid, p);
    currentUser = profilVersUtilisateur(fbUser, p);
    try { window.sessionStorage.setItem(CACHE_PREFIX+'user', JSON.stringify(currentUser)); } catch(e) {}
    showToast('Vos accès ont été mis à jour');
    detachFirebaseDataListeners();
    attachFirebaseDataListeners();
    enterApp();
  }).catch(function(){});
}

// --- État de la connexion ---
function hlSurveillerConnexion(){
  if(!firebaseReady || typeof firebase === 'undefined') return;
  try {
    firebase.database().ref('.info/connected').on('value', function(s){
      const c = s.val() === true;
      if(c){
        if(hlConnecte !== true){
          const depuis = hlHorsLigneDepuis || hlLS(HL_ENLIGNE, null);
          hlDureeHorsLigne = depuis ? Date.now() - depuis : 0;
          hlReconnecteA = Date.now();
          // Après une longue coupure, la première vérification de session peut
          // trouver la session nettoyée par un autre appareil : on la tolère une fois.
          hlVerifSessionApresAbsence = hlDureeHorsLigne > (SESSION_STALE_MS - 60000);
          clearTimeout(hlVerifTimer);
          hlVerifTimer = setTimeout(() => { hlVerifSessionApresAbsence = false; }, 20000);
        }
        hlHorsLigneDepuis = null;
        hlLSset(HL_ENLIGNE, Date.now());
      } else {
        if(hlConnecte === null) return; // au démarrage, Firebase dit « non connecté » le temps de se connecter
        if(hlConnecte === true) hlHorsLigneDepuis = Date.now();
      }
      hlConnecte = c;
      hlMajBadge();
    });
  } catch(e) { console.warn('Suivi de connexion indisponible', e); }
  setInterval(() => { if(hlConnecte) hlLSset(HL_ENLIGNE, Date.now()); }, 30000);
  setTimeout(() => {
    if(hlConnecte === null){ hlConnecte = false; hlHorsLigneDepuis = hlLS(HL_ENLIGNE, null) || Date.now(); hlMajBadge(); }
  }, 4000);
}
// Une session supprimée pendant une longue coupure (nettoyage automatique des
// sessions inactives depuis 30 min par les autres appareils) : on la recrée au
// lieu de déconnecter la personne.
function hlSessionPerdueParAbsence(){
  if(!hlVerifSessionApresAbsence) return false;
  hlVerifSessionApresAbsence = false; // une seule fois : une vraie déconnexion par l'administrateur reste effective
  return true;
}

// --- Affichage : badge + bandeau ---
function hlEtat(){
  if(!firebaseConfigured() || !currentUser) return null;
  const nAtt = hlNbAttente(), nConf = hlConflits().length;
  let r = null;
  if(hlConnecte === false) r = {cls:'sync-off', txt: 'Hors ligne' + (nAtt ? ` · ${nAtt} en attente` : ''), n: nAtt || ''};
  else if(nAtt && hlConnecte) r = {cls:'sync-connecting', txt: `Envoi… (${nAtt})`, n: nAtt};
  if(nConf){
    r = r || {cls:'sync-error', txt:'Synchronisé', n:''};
    r.cls = 'sync-error';
    r.txt += ` · ⚠ ${nConf} conflit(s)`;
    r.n = '⚠';
  }
  return r;
}
function hlMajBadge(){
  if(typeof setSyncBadge === 'function') setSyncBadge(hlDernierEtatBadge, true);
  hlMajBandeau();
}
function hlMajBandeau(){
  let b = document.getElementById('hl-bandeau');
  const nAtt = hlNbAttente(), nConf = hlConflits().length;
  let txt = '';
  if(currentUser && firebaseConfigured()){
    if(nConf) txt = `⚠ ${nConf} modification(s) faite(s) hors ligne à vérifier — toucher ici`;
    else if(hlConnecte === false) txt = 'Hors ligne' + (nAtt ? ` — ${nAtt} enregistrement(s) en attente d'envoi` : ' — vos saisies seront envoyées au retour du réseau');
  }
  if(!txt){ if(b) b.remove(); return; }
  if(!b){
    b = document.createElement('div');
    b.id = 'hl-bandeau';
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom));z-index:900;max-width:92vw;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.18);cursor:pointer;text-align:center;';
    b.onclick = () => { if(hlConflits().length) hlOuvrirConflits(); };
    document.body.appendChild(b);
  }
  b.style.background = nConf ? 'var(--bad-bg, #FCEAEA)' : '#1F2937';
  b.style.color = nConf ? 'var(--bad, #D64545)' : '#fff';
  b.textContent = txt;
}

// --- Conflits : choisir la version à garder ---
function hlLibelleCle(c){
  const noms = {cmd_commandes:'Liste des commandes', mgt_clients:'Fiches clients MGT', ops_history:'Postes opératrices'};
  let base = noms[c.cle] || c.cle;
  if(/^prod_\d{4}-\d{2}-\d{2}$/.test(c.cle)) base = 'Saisie rendement du ' + c.cle.slice(5).split('-').reverse().join('/');
  else if(/^cmd_saisies_/.test(c.cle)) base = 'Saisies de production d\'une commande';
  else if(/^cmd_embjournal_/.test(c.cle)) base = 'Emballage d\'une commande';
  return base + (c.sous ? ` (${c.sous})` : '');
}
function hlOuvrirConflits(){
  const liste = hlConflits();
  let z = document.getElementById('hl-conflits');
  if(z) z.remove();
  if(!liste.length){ showToast('Aucun conflit'); return; }
  z = document.createElement('div');
  z.id = 'hl-conflits';
  z.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;';
  z.innerHTML = `<div style="background:var(--surface,#fff);color:var(--ink,#111);width:100%;max-width:560px;max-height:85vh;overflow:auto;border-radius:16px 16px 0 0;padding:16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><b style="font-size:15px;">Modifications hors ligne en conflit</b>
      <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="document.getElementById('hl-conflits').remove()">Fermer</button></div>
    <p style="font-size:12px;color:var(--ink-soft,#555);margin:0 0 10px;">Ces données ont été modifiées sur cet appareil sans réseau, et quelqu'un d'autre les a aussi modifiées entre-temps. C'est la version du serveur qui est affichée ; la vôtre est gardée ici. Choisissez celle à conserver.</p>
    ${liste.map((c, i) => `<div style="border:1px solid var(--border,#ddd);border-radius:10px;padding:10px;margin-bottom:8px;">
      <b style="font-size:13px;">${esc(hlLibelleCle(c))}</b>
      <div style="font-size:11px;color:var(--ink-faint,#888);margin:2px 0 8px;">Votre modification : ${cmdDateHeureFRsafe(c.dateLocale)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-primary" style="flex:1;min-width:120px;padding:8px 6px;font-size:12px;" onclick="hlResoudreConflit(${i}, 'locale')">Garder ma version</button>
        <button class="btn btn-ghost" style="flex:1;min-width:120px;padding:8px 6px;font-size:12px;" onclick="hlResoudreConflit(${i}, 'serveur')">Garder celle du serveur</button>
        <button class="btn btn-ghost" style="padding:8px 10px;font-size:12px;" onclick="hlExporterConflit(${i})" title="Enregistrer les deux versions dans un fichier">⬇</button>
      </div></div>`).join('')}
  </div>`;
  document.body.appendChild(z);
}
function cmdDateHeureFRsafe(ts){
  if(typeof cmdDateHeureFR === 'function') return cmdDateHeureFR(ts);
  return new Date(ts).toLocaleString('fr-FR');
}
window.hlOuvrirConflits = hlOuvrirConflits;
window.hlResoudreConflit = (i, choix) => {
  const liste = hlConflits();
  const c = liste[i];
  if(!c) return;
  if(choix === 'locale'){
    if(!confirm('Remplacer la version du serveur par la vôtre ? Les modifications faites entre-temps par l\'autre personne sur cette donnée seront remplacées.')) return;
    hlAppliquerLocal(c.cle, c.sous, c.locale);
    hlEcrire(c.chemin, c.locale, {cle: c.cle, sous: c.sous});
  }
  liste.splice(i, 1);
  hlLSset(HL_CONFLITS, liste);
  hlMajBadge();
  const z = document.getElementById('hl-conflits'); if(z) z.remove();
  if(liste.length) hlOuvrirConflits();
  showToast(choix === 'locale' ? 'Votre version a été envoyée' : 'Version du serveur conservée');
  try { if(typeof nav === 'function' && document.getElementById('main')) nav(activeTab); } catch(e) {}
};
window.hlExporterConflit = (i) => {
  const c = hlConflits()[i];
  if(!c) return;
  const blob = new Blob([JSON.stringify({donnee: hlLibelleCle(c), cle: c.cle, sous: c.sous, maVersion: c.locale, versionServeur: c.serveur}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `conflit_${c.cle}${c.sous?'_'+c.sous:''}_${getTodayISO()}.json`.replace(/[^\w.\-]+/g,'_');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
