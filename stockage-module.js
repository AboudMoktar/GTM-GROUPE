// ============================================================
// COUCHE DE STOCKAGE — point de passage UNIQUE de toutes les lectures et écritures de données
// ============================================================
// Correction C8 de l'audit (première étape de la migration progressive) : ces fonctions étaient dans
// index.html ; elles sont regroupées ici SANS AUCUN CHANGEMENT DE COMPORTEMENT. Tous les modules
// continuent d'appeler getJSON / setJSON / gtmEcrireEtConfirmer exactement comme avant.
//
// Interface (à conserver telle quelle lors d'un changement de back-end) :
//   getJSON(cle, defaut)                    → valeur (copie) depuis la mémoire, sinon le téléphone, sinon defaut
//   setJSON(cle, valeur)                    → true si prise en compte (mémoire + téléphone + envoi), false si refusée
//   gtmEcrireEtConfirmer(cle, valeur, ms)   → Promise {ok, raison?} résolue quand le SERVEUR a confirmé
//   syncToFirebase(cle, valeur)             → envoi réseau (file d'attente hors ligne : hors-ligne-module.js)
//
// STOCKAGE_MODE dit où partent les écritures. Aujourd'hui : 'firebase' (seule valeur utilisée).
// Plus tard (migration vers un serveur Node.js + PostgreSQL) : 'double' (Firebase reste maître, copie
// vers le serveur) puis 'serveur' ; ce fichier sera alors le seul à changer côté navigateur.
// Chargé AVANT le script principal d'index.html (qui définit CACHE_PREFIX, firebaseReady, fbRootRef…,
// utilisés seulement au moment des appels).
var STOCKAGE_MODE = 'firebase';

// --- Lecture / écriture locales + envoi ---
let memoryCache = {};
function getJSON(key, fallback){ 
  let fullKey = CACHE_PREFIX + key;
  if(memoryCache[fullKey] !== undefined) return JSON.parse(JSON.stringify(memoryCache[fullKey]));
  try { const v = window.localStorage.getItem(fullKey); if(v) { memoryCache[fullKey] = JSON.parse(v); return JSON.parse(v); } } catch(e) {} 
  return fallback; 
}
// Renvoie true si l'écriture a bien été prise en compte, false si elle a été
// refusée (données pas encore chargées sur cet appareil — voir hlEcritureAutorisee).
// Un appelant important (ex. un gros import) doit vérifier ce retour : avant cet
// ajout, un refus passait totalement inaperçu (aucune valeur de retour), ce qui a
// déjà fait croire à tort qu'un enregistrement avait réussi alors qu'il avait été
// silencieusement abandonné.
function setJSON(key, value){
  if(typeof hlEcritureAutorisee === 'function' && !hlEcritureAutorisee(key)) return false;
  let fullKey = CACHE_PREFIX + key;
  memoryCache[fullKey] = JSON.parse(JSON.stringify(value));
  try { window.localStorage.setItem(fullKey, JSON.stringify(value)); } catch(e) {}
  syncToFirebase(key, value);
  return true;
}
// Comme setJSON (même enregistrement local, même file d'attente hors-ligne au cas où la
// connexion lâche), mais renvoie en plus une PROMESSE qui ne se résout que lorsque le
// SERVEUR Firebase a réellement confirmé l'écriture. setJSON seul ne permettait pas de le
// savoir : un enregistrement pouvait sembler réussi localement (écran, mémoire du
// téléphone) tout en étant REFUSÉ par le serveur sans que personne ne s'en aperçoive (par
// exemple si le compte connecté n'a pas les droits nécessaires sur ce dossier) — c'est
// exactement le genre de défaillance invisible qui a fait croire à tort qu'un import de
// clients avait réussi. Réservé aux enregistrements importants (ex. un import) : l'utiliser
// partout doublerait inutilement chaque écriture normale.
function gtmEcrireEtConfirmer(key, value, timeoutMs){
  // Enregistrement local (mémoire + téléphone) identique à setJSON, mais SANS passer par
  // syncToFirebase : l'envoi réseau est fait une seule fois ci-dessous (hlEcrireConfirme),
  // pour ne jamais envoyer deux fois la même donnée en même temps (ce qui doublait le temps
  // de transfert des plus gros enregistrements, ex. un import de centaines de clients, et
  // rendait un délai dépassé bien plus probable alors que la connexion était pourtant bonne).
  if(typeof hlEcritureAutorisee === 'function' && !hlEcritureAutorisee(key)) return Promise.resolve({ok:false, raison:"Données pas encore chargées sur cet appareil."});
  let fullKey = CACHE_PREFIX + key;
  try {
    memoryCache[fullKey] = JSON.parse(JSON.stringify(value));
    try { window.localStorage.setItem(fullKey, JSON.stringify(value)); } catch(e) {}
  } catch(err){
    // Erreur de conversion de la donnée elle-même (avant même d'essayer le réseau) :
    // on l'indique clairement plutôt que de laisser planter l'écran sans explication.
    return Promise.resolve({ok:false, raison:"Donnée invalide avant l'envoi : " + ((err && err.message) || String(err))});
  }
  if(typeof hlEcrireConfirme === 'function') return hlEcrireConfirme(firebaseCheminDe(key), value, {cle:key, memoire:true}, timeoutMs);
  if(!firebaseReady || !fbRootRef) return Promise.resolve({ok:true}); // hors ligne : la file d'attente habituelle prendra le relais
  const t = timeoutMs || 35000;
  const t0 = Date.now();
  return new Promise(function(resolve){
    let fini = false;
    const minuteur = setTimeout(function(){
      if(fini) return; fini = true;
      const etat = hlConnecte === true ? "l'application se croyait en ligne" : (hlConnecte === false ? "l'application se savait hors ligne" : "état de connexion inconnu");
      resolve({ok:false, raison:"Pas de confirmation du serveur après " + Math.round((Date.now()-t0)/1000) + "s (" + etat + "). Vérifiez votre connexion internet (essayez de changer de Wi-Fi/4G) puis réessayez."});
    }, t);
    fbRootRef.child(firebaseCheminDe(key)).set(value).then(function(){
      if(fini) return; fini = true; clearTimeout(minuteur); resolve({ok:true});
    }).catch(function(err){
      if(fini) return; fini = true; clearTimeout(minuteur);
      const msg = (err && (err.message || err.code)) || String(err);
      resolve({ok:false, raison: /permission/i.test(msg) ? "Refusé par le serveur : droits insuffisants sur ce compte pour enregistrer dans MGT." : ("Refusé par le serveur : " + msg)});
    });
  });
}
window.gtmEcrireEtConfirmer = gtmEcrireEtConfirmer;

// --- Envoi réseau ---
function syncToFirebase(key, value){
  // memoire:true -> setJSON vient de placer exactement cette valeur en mémoire (voir hlEcrire).
  if(typeof hlEcrire === 'function'){ hlEcrire(firebaseCheminDe(key), value, {cle: key, memoire: true}); return; }
  if(!firebaseReady || !fbRootRef) return;
  fbRootRef.child(firebaseCheminDe(key)).set(value).then(function(){
    setSyncBadge('ok');
  }).catch(function(err){
    console.error('Erreur de synchronisation Firebase :', err);
    setSyncBadge('error');
    showToast("⚠️ Non synchronisé (vérifiez la connexion)");
  });
}

window.gtmStockage = {mode: function(){ return STOCKAGE_MODE; }, getJSON: getJSON, setJSON: setJSON, ecrireEtConfirmer: gtmEcrireEtConfirmer, envoyer: syncToFirebase};
