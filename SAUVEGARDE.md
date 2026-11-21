# Sauvegarde quotidienne de la base

Chaque nuit (vers 2 h 17, heure de Tunis), GitHub Actions lit **toute** la base Firebase et ses règles,
compresse le tout, le **chiffre** et le conserve **30 jours** (onglet *Actions* > *Sauvegarde* > fichier joint).
Le script ne fait que **lire** : il n'écrit jamais dans Firebase. Le dépôt étant public, le fichier est chiffré
(AES-256-GCM) : sans la phrase secrète, il est illisible.

Chaque sauvegarde vérifie aussi que les règles en production sont bien `database.rules.v2.json`
(sinon : avertissement dans le résumé et fichier `ALERTE-REGLES.txt`).

## Mise en service (une seule fois, environ 10 minutes)

1. **Compte de service en lecture seule**
   - Console Google Cloud du projet `gtm-groupe` > *IAM et administration* > *Comptes de service* > **Créer**
     (nom : `sauvegarde-lecture`).
   - Rôle : **Firebase Realtime Database Viewer** (lecture seule).
   - Onglet *Clés* > *Ajouter une clé* > *JSON* : un fichier est téléchargé.
2. **Phrase secrète** : choisissez une phrase d'au moins 16 caractères. **Notez-la hors de GitHub**
   (sans elle, les sauvegardes sont perdues).
3. **Secrets GitHub** : dépôt > *Settings* > *Secrets and variables* > *Actions* > *New repository secret* :
   - `FIREBASE_SA` : collez **tout le contenu** du fichier JSON de l'étape 1 ;
   - `SAUVEGARDE_CLE` : la phrase secrète.
4. Supprimez le fichier JSON téléchargé de votre ordinateur.
5. Premier essai : onglet *Actions* > *Sauvegarde* > **Run workflow**. Le résumé (tailles par dossier,
   sans aucune donnée) s'affiche dans le journal ; le fichier chiffré est joint à l'exécution.

## Récupérer une sauvegarde

1. *Actions* > *Sauvegarde* > choisir la nuit voulue > télécharger le fichier joint (zip).
2. Sur votre poste, dans le dossier du projet :
   `SAUVEGARDE_CLE='votre phrase' node outils/dechiffrer-sauvegarde.js gtm-AAAA-MM-JJ.json.gz.chiffre`
   → `gtm-AAAA-MM-JJ.json` (base complète + règles), en clair, **à ne jamais publier**.
3. Une restauration dans Firebase se fait **à la main**, après vérification, depuis la console Firebase
   (*Realtime Database* > *⋮* > *Importer un fichier JSON*) — de préférence d'abord sur un seul dossier.
