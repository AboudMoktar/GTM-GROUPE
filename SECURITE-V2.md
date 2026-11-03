# Sécurité V2 — rôles, règles Firebase et procédure de mise en production

État au 31/10/2026, 17 h 35 : **règles V2 publiées en production et application déployée**, en offre gratuite (sans fonctions serveur). Sauvegarde complète de la base et des anciennes règles faite juste avant (17 h 28). Vérification en production avec 10 comptes temporaires (supprimés ensuite) : **53 / 53 contrôles conformes**. Comptes : `mokhtar` (Administrateur / Développeur) et `responsable` (Responsable TEK-TREND).

## 1. Ce qui change

| Domaine | Avant | Après (V2) |
| --- | --- | --- |
| Définition des rôles | Dispersée (profils-module.js, rôles techniques, règles écrites à la main) | Un seul fichier, `roles-config.js`, lu par l'application, les règles et les fonctions serveur |
| Lecture des données | Toute la société (dossier entier) | Seulement les données du rôle (clé par clé), imposé par Firebase |
| Écriture | Tout le dossier de la société dès le rôle admin ou chef_chaine | Par ressource et par action (créer, modifier, supprimer) |
| Effacer un dossier entier d'un coup | Possible pour tout éditeur | Impossible pour tous |
| Direction (Damien, Ghazia) | Lecture seule dans l'interface | Lecture seule imposée par Firebase, même depuis la console du navigateur |
| Comptes | Gérés depuis le navigateur | Fonctions serveur (SDK Admin) : création, désactivation, nouveau mot de passe, suppression |
| Désactivation d'un compte | Inexistante | Champ `desactive` bloqué par les règles + compte Firebase Auth désactivé |
| Portail client externe | Présent | Supprimé (écran, profil, chemins `portail/` fermés ; données conservées) |
| Amorçage « premier compte = administrateur » | Actif | Supprimé |

## 2. Rôles

La matrice complète, ressource par ressource, est dans `MATRICE-PERMISSIONS.md` (générée depuis `roles-config.js`).

| Rôle | Sociétés | En résumé |
| --- | --- | --- |
| Administrateur / Développeur (`sysadmin`) | TEK, GADH, MGT | Tout, comptes, journal d'audit, maintenance |
| Responsable TEK-TREND (`responsable`) | TEK, GADH | Tout TEK-TREND, GADH et commandes ; pas de comptes |
| Secrétaire TEK-TREND (`secretaire_tek`) | TEK | RH et facturation ; lecture des horaires et des commandes |
| Cheftaine TEK-TREND (`agent_chaine`) | TEK | Saisie du rendement et fiche chaîne (sans suppression) ; lecture des salariés, présences, horaires et paramètres |
| Responsable GADH (`resp_gadh`) | GADH | Suivi et saisies des commandes reçues (sans suppression) ; lecture du catalogue |
| Secrétaire GADH (`secretaire_gadh`) | GADH | RH et facturation GADH ; lecture du suivi des commandes |
| Technico-commercial MGT (`technico_mgt`) | MGT | Tout MGT, dont les demandes SAV et les fichiers joints |
| Secrétaire MGT (`secretaire_mgt`) | MGT | Factures, offres et planning (lecture et écriture), clients en consultation ; ces données sont dans les fiches clients du CRM (validé le 01/11/2026) |
| Direction (`direction`) | TEK, GADH, MGT | Lecture seule de tout ; ni comptes, ni journal d'audit |

### Points déduits du code, à confirmer

1. **Cheftaine** : lit la liste des salariés, les présences et les absences, parce que la fiche chaîne ajuste l'objectif selon l'état RH du jour. Elle ne lit ni les dossiers RH (`rh_base_*`), ni la facturation.
2. **Secrétaires TEK et GADH** : lisent les commandes et le suivi, parce que les factures PERCKO (expéditions) et GADH (pièces retournées) sont générées depuis le suivi.
3. **Responsable GADH** : la production GADH ne se saisit plus, elle vient des retours du suivi. Ses droits portent donc sur le suivi et les saisies des commandes. Firebase ne peut pas limiter un document du suivi aux seules étapes GADH : la séparation par étape reste faite par l'écran.
4. **Machines et arrêts (TEK et GADH), stock TEK, messages** : non attribués dans tes consignes. Écriture réservée à l'Administrateur et au Responsable TEK-TREND ; lecture aussi pour la Direction.
5. **Journal d'audit** : lisible seulement par l'Administrateur.

## 3. Fichiers

| Fichier | Rôle |
| --- | --- |
| `roles-config.js` (nouveau) | Source unique : sociétés, ressources de données, rôles, interface, droits |
| `roles-interface.js` (nouveau) | Applique la partie interface de la configuration (chargé en dernier) |
| `outils/generer-regles.js` (nouveau) | Produit `database.rules.v2.json` et copie la configuration pour les fonctions |
| `outils/generer-matrice.js` (nouveau) | Produit `MATRICE-PERMISSIONS.md` |
| `database.rules.v2.json` (nouveau, généré) | Règles proposées. `database.rules.json` (règles actuelles) n'est pas modifié |
| `functions/` (nouveau) | Fonctions serveur `comptesCreer`, `comptesActiver`, `comptesMotDePasse`, `comptesSupprimer` |
| `profils-module.js` | Rôles lus depuis la configuration ; nouvel écran Comptes (droits, désactiver, mot de passe, supprimer) |
| `groupe-module.js` | Sources de données selon le rôle ; portail retiré |
| `index.html` | Abonnement aux seules données autorisées ; chargement des nouveaux fichiers ; portail retiré |
| `hors-ligne-module.js` | Copie locale et envois en attente compatibles avec la lecture clé par clé |
| `audit-module.js` | Accès au journal selon le rôle |
| `tests/` (nouveau) | Simulateur, scénarios, tests sur l'émulateur officiel, tests des fonctions, test de bout en bout |

`portail-module.js` (plus chargé) et `commande-module.js` (vide) ont été supprimés le 02/11/2026. `database.rules.json` est conservé comme archive des anciennes règles.

## 4. Résultats des tests (31/10/2026)

| Série | Outil | Résultat |
| --- | --- | --- |
| Règles V2, 194 scénarios (9 rôles, comptes désactivés, sans profil, visiteur, tentatives d'élévation, requêtes détournées, sessions, audit, validation) | Émulateur Firebase officiel | **194 / 194** |
| Mêmes scénarios | Simulateur local | 194 / 194 |
| Mêmes scénarios sur les règles actuelles (pour comparaison) | Simulateur local | 128 / 194 : 66 écarts |
| Fonctions serveur des comptes (droits de l'appelant, création, doublon, mot de passe faible, désactivation, connexion bloquée, nouveau mot de passe, suppression, données conservées, journal) | Émulateurs Auth, Database, Functions | **15 / 15** |
| Application réelle connectée aux émulateurs : connexion de chaque rôle, chargement sans refus, écritures autorisées et refusées | Émulateurs + navigateur | **34 / 34** |

Relancer les tests (dans `tests/`, après `npm install`) : `npm run simulateur`, `npm run emulateur`, `npm run fonctions`, `npm run synchro` (synchronisation CRM Supabase, faux Supabase) ; avec le serveur `node serveur.js` lancé : `npm run e2e`, `npm run e2e-ventes`, `npm run e2e-rapports`, `npm run csp`, `npm run mesures`.

## 5. Procédure de mise en production (après ta validation)

1. **Sauvegarde** : console Firebase, Realtime Database, ⋮, Exporter JSON. Garder aussi une copie des règles actuelles (onglet Règles, tout copier).
2. **Déployer l'application** : fusion de `securite-v2` dans `main`. L'application V2 fonctionne aussi avec les règles actuelles.
3. **Activer ton profil** : connecté avec `mokhtar`, Administration, Comptes, « Activer mon profil Administrateur ». À faire **avant** l'étape 6, sinon ton compte sans profil perdrait l'accès.
4. **Vérifier** le compte `responsable` (rôle Responsable TEK-TREND).
5. **Créer les comptes** (Secrétaires, Cheftaine, Responsable GADH, Technico MGT, Secrétaire MGT, Damien, Ghazia) depuis l'écran Comptes.
6. **Publier les règles** : onglet Règles, remplacer tout par `database.rules.v2.json`, Publier.
7. **Contrôler** : se connecter avec chaque compte et ouvrir ses modules.

### Offre gratuite (choix du 31/10/2026)

Les fonctions serveur (`functions/`) sont prêtes et testées, mais pas déployées : elles demandent l'offre Blaze. En offre gratuite, l'écran Comptes :
- crée les comptes par l'ancien mécanisme (sans privilège) ;
- désactive un compte par le champ `desactive` : lecture et écriture bloquées par les règles, connexion refusée par l'application ;
- pour redonner un accès (mot de passe oublié) : supprimer le compte, supprimer l'identifiant dans la console Firebase, puis le recréer avec le même identifiant.

Pour activer les fonctions plus tard : offre Blaze, `firebase deploy --only functions`, puis `PROFILS_FONCTIONS_SERVEUR = true` dans `profils-module.js`.

## 6. Retour arrière

| Problème | Action | Durée |
| --- | --- | --- |
| Un rôle ne peut plus travailler après publication des règles | Recoller les anciennes règles (copie de l'étape 1 ou `database.rules.json`), Publier | 2 min |
| L'application V2 pose problème | Revenir au commit précédent de `main` (« Revert ») | 5 min |
| Données abîmées | Importer l'export JSON de l'étape 1 sur le dossier concerné uniquement | 10 min |

Aucune étape ne supprime de données métier, d'historique ni de journal d'audit. Les anciens comptes ne sont pas supprimés par cette procédure.

## 5. Politique de sécurité du contenu (CSP, 02/11/2026)

Une balise `<meta http-equiv="Content-Security-Policy">` est présente dans `index.html`, `mgt-crm-app.html` et `suivi-commandes.html`. Son texte est **identique** à `tests/csp-politique.txt` : le modifier aux deux endroits (le test `npm run csp` avec `CSP_MODE=meta` vérifie qu'ils sont identiques).

Sites autorisés et pourquoi :
| Directive | Sites | Raison |
| --- | --- | --- |
| `script-src` | `www.gstatic.com`, `cdnjs.cloudflare.com`, `*.firebasedatabase.app`, `apis.google.com` | SDK Firebase ; Excel (xlsx, exceljs) ; Firebase en « long polling » quand le WebSocket est bloqué ; connexion Firebase sur téléphone (chargeur Google) |
| `connect-src` | `blob:`, `*.firebasedatabase.app` (https et wss), `identitytoolkit` et `securetoken.googleapis.com`, `www.gstatic.com`, `cdnjs`, `apis.google.com`, `*.supabase.co` | téléchargements (Excel, PDF), base, connexion des comptes, cache hors ligne ; lecture du CRM Supabase de l'associé (synchronisation MGT, sens unique, réglée dans Paramètres du CRM : adresse et compte jamais dans le code) |
| `frame-src` | `gtm-groupe.firebaseapp.com`, `tek-trend-35778.firebaseapp.com`, `*.firebasedatabase.app` | cadre invisible de connexion Firebase sur téléphone (et pour l'ancien projet, module de transfert) ; long polling |
| `style-src` / `font-src` | `fonts.googleapis.com` / `fonts.gstatic.com` | polices |
| `img-src` | `data:`, `blob:` | logos intégrés, impressions |

Limites : `'unsafe-inline'` reste nécessaire (plus de 900 actions écrites dans les boutons, `onclick`) ; `frame-ancestors` (protection contre l'intégration dans un autre site) est impossible avec une balise `<meta>` et GitHub Pages.

Tests (dans `tests/`) : `node serveur.js` remplace `python3 -m http.server 8790` (il ajoute les adresses des émulateurs à la politique, côté test uniquement) ; `npm run csp` (politique en Report-Only) et `CSP_MODE=meta npm run csp` (balise active) parcourent tous les rôles, téléphone Android, CRM, suivi, impression, Excel, hors ligne et long polling.
