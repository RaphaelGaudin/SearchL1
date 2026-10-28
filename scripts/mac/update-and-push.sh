#!/bin/zsh
# Mise à jour complète des données depuis le Mac (Sofascore y répond, pas depuis GitHub),
# puis commit et push de public/data : le push redéploie le site via la GitHub Action.
# launchd le lance toutes les 30 minutes (et au réveil du Mac) ; il ne fait quelque chose que si les données
# en ligne sont en retard sur le dernier créneau (lundi 18 h 30, vendredi 8 h). Un créneau manqué parce que
# le Mac dormait ou n'avait pas de réseau est ainsi rattrapé dès qu'il est de nouveau disponible.
# Il travaille dans une copie du dépôt hors de ~/Documents : macOS interdit aux tâches de fond d'y lire.
set -u
REPO="__REPO__"
LOG="$HOME/Library/Logs/searchl1-donnees.log"
NODE_DIR="__NODE_DIR__"
# Après un échec, on attend 2 h avant de réessayer (pour ne pas solliciter Sofascore toutes les 30 minutes).
RETRY_FILE="$HOME/Library/Application Support/SearchL1/dernier-echec"
export PATH="$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

exec >>"$LOG" 2>&1
cd "$REPO" || exit 1

# Rien à faire si la copie locale est à jour (vérification sans réseau, donc silencieuse).
npx --no-install tsx scripts/stale.mts --full >/dev/null 2>&1 || exit 0
if [ -f "$RETRY_FILE" ] && [ $(( $(date +%s) - $(stat -f %m "$RETRY_FILE") )) -lt 7200 ]; then exit 0; fi

echo "=== $(date '+%d/%m/%Y %H:%M') ==="
fail() { echo "$1"; touch "$RETRY_FILE"; exit 1; }

# Au réveil, le réseau met parfois une minute à revenir : on l'attend jusqu'à 5 minutes.
for i in {1..30}; do
  curl -sfI --max-time 5 https://github.com >/dev/null && break
  [ "$i" = 30 ] && { echo "Pas de réseau : nouvel essai dans 30 minutes."; exit 1; }
  sleep 10
done

# git pull, avec trois essais en cas de coupure.
for i in 1 2 3; do
  git pull --ff-only --quiet && break
  [ "$i" = 3 ] && fail "git pull impossible : nouvel essai plus tard."
  sleep 20
done
# Une autre source (la GitHub Action) a peut-être déjà publié une mise à jour complète.
npx --no-install tsx scripts/stale.mts --full >/dev/null 2>&1 || { echo "Déjà à jour."; rm -f "$RETRY_FILE"; exit 0; }

if [ -n "$(git status --porcelain -- public/data)" ]; then
  fail "public/data a des modifications locales non commitées : mise à jour annulée."
fi

if ! npm run --silent data -- --no-history; then
  fail "Mise à jour échouée : anciennes données conservées, nouvel essai dans 2 h."
fi
if ! grep -q '"season":"Sofascore"' public/data/meta.json; then
  git checkout -- public/data
  fail "Sofascore n'a pas répondu : rien n'est poussé, nouvel essai dans 2 h."
fi

# Palmarès (Wikidata, TheSportsDB) : facultatif, gardé en cache 30 jours.
npm run --silent palmares || echo "Palmarès non mis à jour (anciens conservés)."

# meta.json change toujours (horodatage) : même sans nouveau match, le créneau est marqué comme fait.
git add public/data public/photos public/logos
git commit --quiet -m "Données : mise à jour complète du $(date '+%d/%m/%Y %H:%M') (Mac)"
# Si la GitHub Action a poussé entre-temps, on rejoue notre commit par-dessus en gardant nos données.
git push --quiet || { git pull --rebase --quiet -X theirs && git push --quiet; } || fail "git push impossible."
rm -f "$RETRY_FILE"
echo "Poussé : le site se redéploie."
