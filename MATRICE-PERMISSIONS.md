# Matrice des permissions GTM Groupe (V2)

Générée automatiquement depuis `roles-config.js`, la même source que les règles Firebase. Ne pas modifier à la main.

« Supprimer » = effacer la clé entière (une collection). Retirer un élément d'une collection est une modification.

Collections dont la suppression entière est réservée aux rôles complets : `employees`, `factures`, `fact_clients`, `gadh_employees`, `gadh_factures`, `gadh_fact_clients`, `cmd_commandes`, `suivi_index`.

## Administrateur / Développeur

Accès complet aux trois sociétés · gestion des comptes · configuration · sauvegardes. Rôle technique : `admin`. Sociétés : TEK-TREND, GADH TUNISIA, MGT. Administration des comptes : oui. Journal d'audit : lecture.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| TEK-TREND | Rendement | Saisie du rendement par jour (prod_AAAA-MM-JJ) | oui | oui | oui | oui |
| TEK-TREND | Rendement | Fiche chaîne du jour (fc_AAAA-MM-JJ) | oui | oui | oui | oui |
| TEK-TREND | Rendement | Horaires de travail (schedule) | oui | oui | oui | oui |
| TEK-TREND | Rendement | Paramètres de production : cadence, postes, modèles | oui | oui | oui | oui |
| TEK-TREND | Rendement | Suivi de commande v4 (prod_commandes, bons, saisies, étapes) | oui | oui | oui | oui |
| TEK-TREND | RH | Salariés, pointages, absences | oui | oui | oui | oui |
| TEK-TREND | RH | Dossiers RH et départements | oui | oui | oui | oui |
| TEK-TREND | Facturation | Factures, clients facturés, paramètres, compteurs | oui | oui | oui | oui |
| TEK-TREND | Machines | Machines, arrêts, horaires machines | oui | oui | oui | oui |
| TEK-TREND | Stock | Stock : mouvements, commandes fournisseurs, réglages | oui | oui | oui | oui |
| TEK-TREND | Messages | Messages internes (onglet retiré de l'interface) | oui | oui | oui | oui |
| GADH TUNISIA | RH GADH | Salariés, pointages, absences, horaires | oui | oui | oui | oui |
| GADH TUNISIA | Facturation | Factures GADH, clients, paramètres, compteurs | oui | oui | oui | oui |
| GADH TUNISIA | Machines | Machines et arrêts GADH | oui | oui | oui | oui |
| TEK-TREND ↔ GADH | Commandes | Commandes PERCKO : commandes, saisies, historique, expéditions, emballage | oui | oui | oui | oui |
| TEK-TREND ↔ GADH | Commandes | Suivi PERCKO : lots, envois et retours GADH | oui | oui | oui | oui |
| TEK-TREND ↔ GADH | Commandes | Catalogue des références | oui | oui | oui | oui |
| MGT | MGT | Toutes les données MGT (clients, offres, SAV, demandes, factures…) | oui | oui | oui | oui |
| MGT | MGT | Fichiers joints (PDF, photos) | oui | oui | oui | oui |

## Responsable TEK-TREND

Accès complet à TEK-TREND et GADH TUNISIA. Rôle technique : `admin`. Sociétés : TEK-TREND, GADH TUNISIA. Administration des comptes : non. Journal d'audit : non.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| TEK-TREND | Rendement | Saisie du rendement par jour (prod_AAAA-MM-JJ) | oui | oui | oui | oui |
| TEK-TREND | Rendement | Fiche chaîne du jour (fc_AAAA-MM-JJ) | oui | oui | oui | oui |
| TEK-TREND | Rendement | Horaires de travail (schedule) | oui | oui | oui | oui |
| TEK-TREND | Rendement | Paramètres de production : cadence, postes, modèles | oui | oui | oui | oui |
| TEK-TREND | Rendement | Suivi de commande v4 (prod_commandes, bons, saisies, étapes) | oui | oui | oui | oui |
| TEK-TREND | RH | Salariés, pointages, absences | oui | oui | oui | oui |
| TEK-TREND | RH | Dossiers RH et départements | oui | oui | oui | oui |
| TEK-TREND | Facturation | Factures, clients facturés, paramètres, compteurs | oui | oui | oui | oui |
| TEK-TREND | Machines | Machines, arrêts, horaires machines | oui | oui | oui | oui |
| TEK-TREND | Stock | Stock : mouvements, commandes fournisseurs, réglages | oui | oui | oui | oui |
| TEK-TREND | Messages | Messages internes (onglet retiré de l'interface) | oui | oui | oui | oui |
| GADH TUNISIA | RH GADH | Salariés, pointages, absences, horaires | oui | oui | oui | oui |
| GADH TUNISIA | Facturation | Factures GADH, clients, paramètres, compteurs | oui | oui | oui | oui |
| GADH TUNISIA | Machines | Machines et arrêts GADH | oui | oui | oui | oui |
| TEK-TREND ↔ GADH | Commandes | Commandes PERCKO : commandes, saisies, historique, expéditions, emballage | oui | oui | oui | oui |
| TEK-TREND ↔ GADH | Commandes | Suivi PERCKO : lots, envois et retours GADH | oui | oui | oui | oui |
| TEK-TREND ↔ GADH | Commandes | Catalogue des références | oui | oui | oui | oui |

## Secrétaire TEK-TREND

Ressources humaines et facturation TEK-TREND. Rôle technique : `admin`. Sociétés : TEK-TREND. Administration des comptes : non. Journal d'audit : non.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| TEK-TREND | Rendement | Horaires de travail (schedule) | oui | — | — | — |
| TEK-TREND | RH | Salariés, pointages, absences | oui | oui | oui | oui (sauf collections protégées) |
| TEK-TREND | RH | Dossiers RH et départements | oui | oui | oui | oui (sauf collections protégées) |
| TEK-TREND | Facturation | Factures, clients facturés, paramètres, compteurs | oui | oui | oui | oui (sauf collections protégées) |
| TEK-TREND ↔ GADH | Commandes | Commandes PERCKO : commandes, saisies, historique, expéditions, emballage | oui | — | — | — |
| TEK-TREND ↔ GADH | Commandes | Suivi PERCKO : lots, envois et retours GADH | oui | — | — | — |
| TEK-TREND ↔ GADH | Commandes | Catalogue des références | oui | — | — | — |

## Cheftaine TEK-TREND

Saisie du rendement de la chaîne. Rôle technique : `chef_chaine`. Sociétés : TEK-TREND. Administration des comptes : non. Journal d'audit : non.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| TEK-TREND | Rendement | Saisie du rendement par jour (prod_AAAA-MM-JJ) | oui | oui | oui | — |
| TEK-TREND | Rendement | Fiche chaîne du jour (fc_AAAA-MM-JJ) | oui | oui | oui | — |
| TEK-TREND | Rendement | Horaires de travail (schedule) | oui | — | — | — |
| TEK-TREND | Rendement | Paramètres de production : cadence, postes, modèles | oui | — | — | — |
| TEK-TREND | RH | Salariés, pointages, absences | oui | — | — | — |

## Responsable GADH

Pièces de production et commandes reçues par GADH. Rôle technique : `admin`. Sociétés : GADH TUNISIA. Administration des comptes : non. Journal d'audit : non.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| TEK-TREND ↔ GADH | Commandes | Commandes PERCKO : commandes, saisies, historique, expéditions, emballage | oui | oui | oui | — |
| TEK-TREND ↔ GADH | Commandes | Suivi PERCKO : lots, envois et retours GADH | oui | oui | oui | — |
| TEK-TREND ↔ GADH | Commandes | Catalogue des références | oui | — | — | — |

## Secrétaire GADH

Ressources humaines et facturation GADH. Rôle technique : `admin`. Sociétés : GADH TUNISIA. Administration des comptes : non. Journal d'audit : non.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| GADH TUNISIA | RH GADH | Salariés, pointages, absences, horaires | oui | oui | oui | oui (sauf collections protégées) |
| GADH TUNISIA | Facturation | Factures GADH, clients, paramètres, compteurs | oui | oui | oui | oui (sauf collections protégées) |
| TEK-TREND ↔ GADH | Commandes | Commandes PERCKO : commandes, saisies, historique, expéditions, emballage | oui | — | — | — |
| TEK-TREND ↔ GADH | Commandes | Suivi PERCKO : lots, envois et retours GADH | oui | — | — | — |
| TEK-TREND ↔ GADH | Commandes | Catalogue des références | oui | — | — | — |

## Technico-commercial MGT

Accès complet au module MGT, y compris les demandes SAV. Rôle technique : `admin`. Sociétés : MGT. Administration des comptes : non. Journal d'audit : non.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| MGT | MGT | Toutes les données MGT (clients, offres, SAV, demandes, factures…) | oui | oui | oui | oui |
| MGT | MGT | Fichiers joints (PDF, photos) | oui | oui | oui | oui |

## Secrétaire MGT

Responsabilités à définir : aucun accès pour le moment. Rôle technique : `viewer`. Sociétés : aucune. Administration des comptes : non. Journal d'audit : non.

Aucun droit sur les données.

## Direction (lecture seule)

Lecture seule sur les trois sociétés · aucune modification. Rôle technique : `viewer`. Sociétés : TEK-TREND, GADH TUNISIA, MGT. Administration des comptes : non. Journal d'audit : non.

| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |
| --- | --- | --- | --- | --- | --- | --- |
| TEK-TREND | Rendement | Saisie du rendement par jour (prod_AAAA-MM-JJ) | oui | — | — | — |
| TEK-TREND | Rendement | Fiche chaîne du jour (fc_AAAA-MM-JJ) | oui | — | — | — |
| TEK-TREND | Rendement | Horaires de travail (schedule) | oui | — | — | — |
| TEK-TREND | Rendement | Paramètres de production : cadence, postes, modèles | oui | — | — | — |
| TEK-TREND | Rendement | Suivi de commande v4 (prod_commandes, bons, saisies, étapes) | oui | — | — | — |
| TEK-TREND | RH | Salariés, pointages, absences | oui | — | — | — |
| TEK-TREND | RH | Dossiers RH et départements | oui | — | — | — |
| TEK-TREND | Facturation | Factures, clients facturés, paramètres, compteurs | oui | — | — | — |
| TEK-TREND | Machines | Machines, arrêts, horaires machines | oui | — | — | — |
| TEK-TREND | Stock | Stock : mouvements, commandes fournisseurs, réglages | oui | — | — | — |
| TEK-TREND | Messages | Messages internes (onglet retiré de l'interface) | oui | — | — | — |
| GADH TUNISIA | RH GADH | Salariés, pointages, absences, horaires | oui | — | — | — |
| GADH TUNISIA | Facturation | Factures GADH, clients, paramètres, compteurs | oui | — | — | — |
| GADH TUNISIA | Machines | Machines et arrêts GADH | oui | — | — | — |
| TEK-TREND ↔ GADH | Commandes | Commandes PERCKO : commandes, saisies, historique, expéditions, emballage | oui | — | — | — |
| TEK-TREND ↔ GADH | Commandes | Suivi PERCKO : lots, envois et retours GADH | oui | — | — | — |
| TEK-TREND ↔ GADH | Commandes | Catalogue des références | oui | — | — | — |
| MGT | MGT | Toutes les données MGT (clients, offres, SAV, demandes, factures…) | oui | — | — | — |
| MGT | MGT | Fichiers joints (PDF, photos) | oui | — | — | — |

