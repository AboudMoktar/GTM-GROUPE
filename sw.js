// GTM Groupe — Service Worker
// Change ce numéro de version à chaque mise à jour du site pour forcer
// les téléphones déjà installés à récupérer la nouvelle version.
const CACHE_NAME = 'groupe-v144';

// Fichiers de l'application (même dossier que sw.js) : tous mis en cache dès
// l'installation, pour que l'application s'ouvre aussi SANS réseau.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './mgt-crm-app.html',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './hero-bg.jpg',
  './logo-mgt.png',
  './logo-tek.png',
  './logo-gadh.png',
  './firebase-config.js',
  './rh-module.js',
  './gadh-module.js',
  './prod-module.js',
  './commandes-module.js',
  './groupe-module.js',
  './suivi-module.js',
  './pointeuse-module.js',
  './mgt-module.js',
  './mgt-sav-module.js',
  './factures-module.js',
  './facturation-percko-module.js',
  './machines-module.js',
  './notif-module.js',
  './audit-module.js',
  './portail-module.js',
  './mgt-crm-module.js',
  './mgt-crm-ecrans.js',
  './mgt-fichiers-module.js',
  './mgt-export-module.js',
  './mgt-accueil-module.js',
  './mgt-calendrier-module.js',
  './mgt-historique-2026.js',
  './mgt-lettrage-module.js',
  './mgt-communication-module.js',
  './mgt-theme-module.js',
  './tek-theme-module.js',
  './grp-hub-theme-module.js',
  './profils-module.js',
  './theme-nav-module.js',
  './direction-dashboard-module.js',
  './dashboards-pc-module.js',
  './dashboards-modules-module.js',
  './enregistrer-module.js',
  './rh-rapports-module.js',
  './fiche-chaine-module.js',
  './suivi-chaine-module.js',
  './nav-historique-module.js',
  './tek-dashboard-module.js',
  './gadh-dashboard-module.js',
  './hors-ligne-module.js'
];
// Bibliothèques Firebase (autre site) : indispensables pour démarrer hors ligne.
const EXTERNES = [
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js'
];

// --- Installation : chaque fichier est mis en cache séparément, pour qu'un ---
// --- seul fichier indisponible n'empêche pas tout le reste.              ---
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      const locaux = APP_SHELL.map(function(u){ return cache.add(new Request(u, {cache:'reload'})).catch(function(err){ console.warn('Non mis en cache :', u, err); }); });
      const ext = EXTERNES.map(function(u){ return fetch(u, {mode:'cors'}).then(function(r){ if(r && r.ok) return cache.put(u, r); }).catch(function(err){ console.warn('Non mis en cache :', u, err); }); });
      return Promise.all(locaux.concat(ext));
    }).then(function(){ return self.skipWaiting(); })
  );
});

// --- Activation : on supprime les anciennes versions du cache ---
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

// Scripts et feuilles de style du site : réseau d'abord, pour que chaque mise à jour s'applique dès l'ouverture suivante.
function isSiteCode(request){
  const url = new URL(request.url);
  return url.origin === self.location.origin && /\.(js|css|json|html)$/.test(url.pathname);
}
function isAppShellDocument(request){
  // La page principale (index.html / "./") doit toujours être la plus fraîche
  // possible : on la traite différemment des icônes/scripts qui, eux, peuvent
  // rester en cache sans risque.
  if(request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return url.origin === self.location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html'));
}

self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;

  // --- Page principale : RÉSEAU D'ABORD ---
  // Garantit que toute mise à jour publiée s'affiche dès la prochaine ouverture,
  // sans avoir besoin de rouvrir l'app une seconde fois. Le cache ne sert que
  // de secours si l'appareil est hors connexion.
  if(isAppShellDocument(event.request) || isSiteCode(event.request)){
    event.respondWith(
      fetch(event.request, {cache:'no-cache'}).then(function(response){
        if(response && response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){
        return caches.match(event.request).then(function(cached){ return cached || caches.match('./index.html'); });
      })
    );
    return;
  }

  // --- Tout le reste (icônes, polices, scripts CDN) : CACHE D'ABORD ---
  // Affichage instantané, mise à jour en arrière-plan pour la prochaine fois.
  event.respondWith(
    caches.match(event.request).then(function(cached){
      const networkFetch = fetch(event.request).then(function(response){
        if(response && (response.ok || response.type === 'opaque')){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){
        return cached;
      });
      return cached || networkFetch;
    })
  );
});
