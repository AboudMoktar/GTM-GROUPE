# Audit et optimisation multiplateforme — GTM GROUPE

Branche : `interface-multiplateforme` (non fusionnée, rien en production).

## 1. Ce qui a été réellement testé

| Environnement | Statut |
|---|---|
| Chromium récent sans écran, fenêtres de 1280×720, 1280×1024, 1366×768, 1440×900, 1600×900, 1920×1080, 2560×1440 | **Testé** (mesures automatiques + captures) |
| Tablette 820×1180 et téléphone 390×844 (mêmes moteur et méthode) | **Simulé** (taille d'écran et tactile émulés) |
| Windows 7 + Chrome 109 | **Non testé sur une vraie machine.** Seul l'identifiant du navigateur a été simulé ; le moteur reste un Chromium récent. La compatibilité est vérifiée par lecture du code (liste des fonctions CSS/JS utilisées), pas par exécution. |
| Windows 10 / 11 (Chrome, Edge) | Non testé sur machine réelle ; même moteur que le test automatique. |
| macOS (Safari, Chrome), Firefox | **Non testé.** |
| Écran réel peu contrasté (photo fournie) | Non reproductible ici ; le mode « contraste renforcé » existant reste actif sous Windows 7. |

Les écrans RH et rendement ont été remplis avec des **données inventées** (la base de
production TEK-TREND est presque vide). Le suivi des commandes a été vérifié avec une
copie locale d'une commande réelle, non enregistrée dans le dépôt.

## 2. Navigateurs à prévoir

- **Windows 7 / 8** : dernier Chrome disponible = 109 (plus de mises à jour), Firefox ESR 115.
  Internet Explorer n'est pas pris en charge (l'application utilise JavaScript moderne et Firebase 10).
- **Windows 10 / 11, macOS** : Chrome, Edge, Firefox ou Safari à jour.

### Limites connues sous Windows 7 (Chrome 109)

| Fonction | Présence dans l'application | Effet sous Chrome 109 |
|---|---|---|
| `color-mix()` | module MGT, calendrier, écran direction | couleur de repli unie (ajoutée partout où elle manquait) |
| `:has()` | 3 règles | reconnu par Chrome 109 ; ignoré par Firefox ESR 115 (repli : fond et grille d'origine) |
| `zoom` (grilles « Excel » agrandies) | suivi des commandes | reconnu par Chrome 109 ; Firefox ESR 115 garde la taille d'origine |
| `dvh` | hauteurs plein écran | repli `vh` déjà présent |
| `showSaveFilePicker` | « enregistrer sous » | repli par téléchargement classique déjà présent |
| flous, ombres, animations | décor | coupés automatiquement sous Windows 7 / 8 pour alléger l'affichage |

Chrome 109 ne reçoit plus de correctifs de sécurité : limite du poste, pas de l'application.

## 3. Problèmes constatés (avant)

1. **Suivi des commandes sur ordinateur** : le cadre restait dans les marges de la page
   (976 px utiles sur un écran de 1280) et basculait en présentation « téléphone »
   (onglets en bas, indicateurs sur deux rangées) à 1280×720 et 1280×1024.
2. **1366×768** : les onglets du suivi débordaient de 67 px (« Réglages » coupé, défilement horizontal).
3. **Grands écrans** : contenu limité à 1480 px — 74 % de la largeur à 1920, 55 % à 2560 ;
   texte à la même taille qu'à 1280.
4. **Pointage** : libellés des boutons et compteurs à 11–11,5 px (340 textes sous 12 px).
5. **Synthèse RH** : filtres empilés sur 5 lignes, indicateurs sur 2 rangées, détail par
   employé sur 3 lignes par personne.
6. **Grilles « Excel » du suivi** : texte de 9,5 à 11 px quelle que soit la taille d'écran.

## 4. Corrections apportées (présentation uniquement)

- `multiplateforme.css` (nouveau, chargé après `charte.css`) :
  - largeur utile 1760 px à partir de 1700 px d'écran, 2240 px à partir de 2200 px ;
    textes, tableaux, boutons et champs agrandis par paliers ;
  - cadre du suivi sur toute la zone de travail (1040 px à 1280, 1680 px à 1920) ;
  - pointage : aucun libellé sous 12 px, plus grand sur grands écrans ;
  - synthèse : filtres sur une ligne, six indicateurs sur une rangée, une ligne par employé ;
  - hauteur faible (720 / 768) : marges réduites, fenêtres limitées à la hauteur d'écran ;
  - anciens ordinateurs : flous, animations et ombres coupés.
- `suivi-commandes.html` : onglets resserrés puis défilants, contenu plus large et texte
  plus grand sur grands écrans, grilles « Excel » agrandies selon la place disponible.
- `rh-module.js` : classes de mise en page ajoutées au gabarit de la synthèse (aucun calcul touché).
- `affichage-module.js` : repère « ancien ordinateur » (Windows 7 / 8).
- `mgt-crm-app.html` : 21 couleurs de repli devant `color-mix()`.

Non modifiés : règles métier, calculs, données, permissions, règles Firebase, IndexedDB,
fonctionnement hors ligne (seul le numéro de cache change pour distribuer les fichiers).

## 5. Résultats mesurés (après)

| Mesure | Avant | Après |
|---|---|---|
| Largeur du suivi à 1280 px | 976 px (présentation téléphone) | 1040 px (présentation ordinateur) |
| Débordement des onglets à 1366 px | 67 px | 0 |
| Largeur utilisée à 1920 px | 74 % | 84–96 % |
| Largeur utilisée à 2560 px | 55 % | 84–86 % |
| Textes sous 12 px, écrans TEK-TREND sur ordinateur | jusqu'à 340 (pointage) | 0 |
| Défilement horizontal de page, 7 résolutions | 1 cas | 0 |

Test automatique ajouté : `tests/multiplateforme.js`. Les 18 suites existantes passent toujours.

## 6. Reste à faire / à vérifier par un utilisateur

- Essai réel sur le poste Windows 7 (Chrome 109) : vitesse ressentie, lisibilité sur l'écran peu contrasté.
- Essai réel sur macOS (Safari) et Firefox.
- Grilles « Excel » du suivi en dessous de 1320 px de large : texte d'origine (pas assez de place pour agrandir sans défilement).
- Modules GADH et MGT : vérifiés sans régression (pas de débordement, pas d'erreur), mais pas réorganisés écran par écran.
- Tableau de bord rendement : grand espace vide quand aucune production n'est saisie.
