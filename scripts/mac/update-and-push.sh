#!/bin/zsh
# Mise à jour complète des données depuis le Mac (Sofascore y répond, pas depuis GitHub),
# puis commit et push de public/data : le push redéploie le site via la GitHub Action.
# Lancé par launchd le lundi à 18 h 30 et le vendredi à 8 h (voir install.sh).
# Il travaille dans une copie du dépôt hors de ~/Documents : macOS interdit aux tâches de fond d'y lire.
set -u
REPO="__REPO__"
LOG="$HOME/Library/Logs/searchl1-donnees.log"
NODE_DIR="__NODE_DIR__"
export PATH="$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

exec >>"$LOG" 2>&1
echo "=== $(date '+%d/%m/%Y %H:%M') ==="
cd "$REPO" || exit 1

if [ -n "$(git status --porcelain -- public/data)" ]; then
  echo "public/data a des modifications locales non commitées : mise à jour annulée."
  exit 1
fi
git pull --ff-only --quiet || { echo "git pull impossible (branche divergente ?) : mise à jour annulée."; exit 1; }

if ! npm run --silent data -- --no-history; then
  echo "Mise à jour échouée : anciennes données conservées."
  exit 1
fi
if ! grep -q '"season":"Sofascore"' public/data/meta.json; then
  echo "Sofascore n'a pas répondu (données de secours) : rien n'est poussé."
  git checkout -- public/data
  exit 1
fi

git add public/data
if git diff --cached --quiet; then
  echo "Données inchangées."
  exit 0
fi
git commit --quiet -m "Données : mise à jour complète du $(date '+%d/%m/%Y %H:%M') (Mac)"
# Si la GitHub Action a poussé entre-temps, on rejoue notre commit par-dessus en gardant nos données.
git push --quiet || { git pull --rebase --quiet -X theirs && git push --quiet; } || { echo "git push impossible."; exit 1; }
echo "Poussé : le site se redéploie."
