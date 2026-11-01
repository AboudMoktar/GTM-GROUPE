#!/usr/bin/env bash
# ============================================================
# Nettoyage de l'historique Git (dépôt public) — À LANCER UNE SEULE FOIS, avec l'accord du propriétaire.
# ============================================================
# Retire de TOUTES les anciennes versions du dépôt :
#   - le fichier mgt-historique-2026.js (historique des factures 2026) ;
#   - le contenu de la constante HISTORIQUE_2026 dans mgt-crm-app.html ;
#   - le matricule fiscal, le téléphone et l'e-mail de la constante PERC_SOCIETE.
# Les motifs ci-dessous sont génériques : ils ne recopient pas les données à effacer.
#
# ATTENTION : réécrit tout l'historique puis l'envoie en force sur GitHub (y compris main).
#   - Toutes les autres copies du dépôt deviennent obsolètes : les supprimer et recloner.
#   - Lancer d'abord sans --pousser pour vérifier ; une copie de sécurité est faite à côté.
# Usage : bash outils/nettoyer-historique-git.sh            (prépare et vérifie, n'envoie rien)
#         bash outils/nettoyer-historique-git.sh --pousser  (envoie en force sur GitHub)
set -euo pipefail
DEPOT=${DEPOT:-https://github.com/AboudMoktar/GTM-GROUPE.git}
TRAVAIL=${TRAVAIL:-$HOME/gtm-nettoyage}
mkdir -p "$TRAVAIL" && cd "$TRAVAIL"
if ! git filter-repo --version >/dev/null 2>&1; then                         # outil git-filter-repo (un seul fichier)
  python3 -m pip install --quiet --break-system-packages git-filter-repo 2>/dev/null || {
    git clone -q --depth 1 https://github.com/newren/git-filter-repo.git outil-gfr && export PATH="$PWD/outil-gfr:$PATH"; }
fi

[ -d sauvegarde.git ] || git clone --mirror "$DEPOT" sauvegarde.git          # copie de sécurité intacte
rm -rf propre.git && git clone --mirror "$DEPOT" propre.git && cd propre.git

cat > ../motifs.txt <<'EOF'
regex:const HISTORIQUE_2026=\[[^\]]*\];==>const HISTORIQUE_2026=[];
regex:const MGT_HISTORIQUE_2026 = \[[^\]]*\];==>const MGT_HISTORIQUE_2026 = [];
regex:mf:'[0-9]{7}[A-Z]/[A-Z]/[A-Z]/[0-9]{3}'==>mf:''
regex:tel:'00216 [0-9 ]+'==>tel:''
regex:email:'[A-Za-z0-9._-]+@gmail\.com'==>email:''
EOF
git filter-repo --force --invert-paths --path mgt-historique-2026.js --replace-text ../motifs.txt

echo "--- Vérification : aucune trace ne doit rester ---"
if git log --all -p | grep -Eq '[0-9]{7}[A-Z]/[A-Z]/[A-Z]/[0-9]{3}|"sourceClient"|@gmail\.com'; then
  echo "DES TRACES RESTENT : ne pas pousser." >&2; exit 1
fi
echo "Historique propre."
if [ "${1:-}" = "--pousser" ]; then
  git remote add origin "$DEPOT" 2>/dev/null || true
  git push --force --mirror origin
  echo "Envoyé. Demander ensuite au support GitHub de purger les vues en cache (guide « Removing sensitive data from a repository »)."
else
  echo "Rien n'a été envoyé. Relancer avec --pousser pour remplacer l'historique sur GitHub."
fi
