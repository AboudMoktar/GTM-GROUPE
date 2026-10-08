# GTM Groupe — Guide de mise en ligne (Firebase)

Résultat : une adresse web (https://votre-projet.web.app) que toute l'équipe ouvre sur téléphone ou PC,
avec des données partagées en temps réel entre TEK-TREND, GADH TUNISIA et MGT, et les portails clients PERCKO / MGT.

Durée : environ 20 minutes. Coût : le forfait gratuit « Spark » suffit pour démarrer.

## Contenu du dossier
- `public/` : l'application (à publier tel quel)
- `public/firebase-config.js` : **le seul fichier à modifier** (vos identifiants Firebase)
- `database.rules.json` : règles de sécurité (qui lit / écrit quoi)
- `firebase.json`, `.firebaserc` : configuration de l'hébergement

## Étape 1 — Créer le projet
1. Allez sur https://console.firebase.google.com, « Ajouter un projet », nom : `gtm-groupe` (Google Analytics : non).
2. Dans le projet : **Build > Authentication > Commencer > Adresse e-mail/Mot de passe > Activer**.
3. **Build > Realtime Database > Créer une base de données** (région : Belgique/europe-west1 si proposée, mode **verrouillé**).
   Notez l'URL affichée en haut (ex. `https://gtm-groupe-default-rtdb.europe-west1.firebasedatabase.app`).

## Étape 2 — Copier les règles de sécurité
Realtime Database > onglet **Règles** > remplacez tout par le contenu de `database.rules.json` > **Publier**.
(Si vous utilisez la ligne de commande à l'étape 5, elles sont publiées automatiquement.)

## Étape 3 — Récupérer la configuration
Paramètres du projet (⚙️) > Vos applications > icône **</>** (Web) > enregistrer l'app `gtm`.
Copiez les valeurs affichées dans `public/firebase-config.js` (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId).
`databaseURL` doit être l'URL notée à l'étape 1.

## Étape 4 — Premier compte (direction du groupe)
Dans Authentication > Utilisateurs > **Ajouter un utilisateur** :
- E-mail : `direction@tek-trend.app` (l'identifiant de connexion est la partie avant `@`, ici `direction`)
- Mot de passe : au choix (6 caractères minimum)

Au tout premier accès, ce compte est automatiquement créé comme **Direction du groupe (administrateur)**.
Ensuite, tous les autres comptes (personnel, comptes clients des portails) se créent **dans l'application** : Sessions > Ajouter.

## Étape 5 — Publier
Option A — ligne de commande (recommandée) :
```
npm install -g firebase-tools
firebase login
# éditez .firebaserc : remplacez VOTRE-PROJET par l'identifiant du projet
firebase deploy
```
Option B — sans installation : Hosting > Commencer, puis suivez l'assistant et déposez le dossier `public/`.
(Les règles se collent alors à la main, étape 2.)

Adresse obtenue : `https://<projet>.web.app`. Sur téléphone : ouvrir > menu du navigateur > « Ajouter à l'écran d'accueil ».

## Étape 6 — Vérifications avant de donner l'accès à l'équipe
Les règles n'ont pas pu être exécutées dans un simulateur lors de la préparation. Faites ces vérifications :
1. **Realtime Database > Règles > Simulateur de règles** : lecture de `/groupe1/mgt` sans authentification → refusée.
2. Créez un compte client PERCKO (destinataire NEOLYS) et un compte client MGT. Connectez-vous avec chacun :
   - le client PERCKO ne voit que ses commandes, sans GADH, marges ni prix ;
   - le client MGT ne voit que ses machines, tickets et contrats ;
   - dans la console du navigateur (F12), aucune lecture de `groupe1/mgt` ou `groupe1/tek` ne doit réussir pour eux.
3. Créez un compte « chef de chaîne » limité à TEK-TREND : il ne doit pas accéder à MGT ni GADH.

## Bon à savoir
- Les portails clients lisent uniquement des **copies assainies** (`portail/...`) publiées par le personnel dès qu'il modifie des données ;
  si aucun membre du personnel ne s'est connecté depuis la création du compte client, le portail reste vide.
- Un client ne peut que **créer** une demande SAV (statut « en attente ») : le personnel la transforme en ticket.
- Le journal d'audit est lisible uniquement par la direction du groupe.
- Sauvegarde : Realtime Database > onglet Données > ⋮ > « Exporter JSON », à faire régulièrement.
- Mots de passe oubliés : Authentication > Utilisateurs > ⋮ > « Réinitialiser le mot de passe », ou recréer le compte depuis l'application.
- Pour un nom de domaine propre : Hosting > « Ajouter un domaine personnalisé ».
