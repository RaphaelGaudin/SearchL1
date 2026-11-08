#!/bin/zsh
# Mise à jour des données depuis le Mac (Sofascore y répond, pas depuis GitHub),
# puis commit et push de public/data : le push redéploie le site via la GitHub Action.
# launchd le lance toutes les 10 minutes (et au réveil du Mac) ; il ne fait quelque chose que si :
#  - les données sont en retard sur le dernier créneau (lundi 18 h 30, vendredi 8 h) : mise à jour complète ;
#  - sinon, des matchs de L1 viennent de finir (2 h après le coup d'envoi) : récupération de leurs scores
#    seulement, une seule fois pour des matchs qui finissent ensemble, puis toutes les 15 minutes si un score manque.
# Un créneau manqué parce que le Mac dormait ou n'avait pas de réseau est rattrapé dès qu'il est de nouveau disponible.
# Il travaille dans une copie du dépôt hors de ~/Documents : macOS interdit aux tâches de fond d'y lire.
set -u
REPO="__REPO__"
LOG="$HOME/Library/Logs/searchl1-donnees.log"
NODE_DIR="__NODE_DIR__"
# Après un échec, on attend avant de réessayer : 2 h (mise à jour complète) ou 30 minutes (scores),
# pour ne pas solliciter Sofascore toutes les 10 minutes.
export PATH="$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

exec >>"$LOG" 2>&1
cd "$REPO" || exit 1

# Alertes « compo » sur le prochain match (indépendantes des mises à jour) : silencieux s'il n'y a rien à envoyer.
[ -f scripts/alerts.mts ] && { npx --no-install tsx scripts/alerts.mts || echo "Alertes compo : échec (nouvel essai dans 10 minutes)."; }

# Que faire ? (vérification sans réseau sur la copie locale, donc silencieuse quand il n'y a rien à faire)
# stale.mts : 0 = mise à jour complète due, 2 = scores de matchs qui viennent de finir, 1 = rien.
mode() { npx --no-install tsx scripts/stale.mts --full --scores >/dev/null 2>&1; echo $?; }
case "$(mode)" in
  0) MODE=complete; WAIT=7200 ;;
  2) MODE=scores; WAIT=1800 ;;
  *) exit 0 ;;
esac
RETRY_FILE="$HOME/Library/Application Support/SearchL1/dernier-echec-$MODE"
if [ -f "$RETRY_FILE" ] && [ $(( $(date +%s) - $(stat -f %m "$RETRY_FILE") )) -lt $WAIT ]; then exit 0; fi

echo "=== $(date '+%d/%m/%Y %H:%M') ($MODE) ==="
fail() { echo "$1"; touch "$RETRY_FILE"; exit 1; }

# Au réveil, le réseau met parfois une minute à revenir : on l'attend jusqu'à 5 minutes.
for i in {1..30}; do
  curl -sfI --max-time 5 https://github.com >/dev/null && break
  [ "$i" = 30 ] && { echo "Pas de réseau : nouvel essai dans 30 minutes."; exit 1; }
  sleep 10
done

# git pull, avec trois essais en cas de coupure.
for i in 1 2 3; do
  git fetch --quiet && break
  [ "$i" = 3 ] && fail "git fetch impossible : nouvel essai plus tard."
  sleep 20
done
# Un push raté (identifiants GitHub indisponibles, Mac verrouillé…) laisse un commit de données local qui
# bloquerait toutes les mises à jour suivantes : il ne contient que des données, refaites juste après, donc on l'abandonne.
if ! git merge --ff-only --quiet origin/main 2>/dev/null; then
  if [ -z "$(git diff --name-only origin/main...HEAD -- . ':!public/data' ':!public/photos' ':!public/logos')" ]; then
    echo "Données locales jamais poussées : remplacées par celles de GitHub."
    git reset --hard --quiet origin/main
  else
    fail "La copie du dépôt a des changements autres que des données : mise à jour annulée, à régler à la main."
  fi
fi
# Une autre source (la GitHub Action, un autre Mac) a peut-être déjà publié la mise à jour.
case "$(mode)" in
  0) [ "$MODE" = complete ] || { MODE=complete; WAIT=7200; RETRY_FILE="${RETRY_FILE%-*}-complete"; } ;;
  2) [ "$MODE" = scores ] || { echo "Déjà à jour."; rm -f "$RETRY_FILE"; exit 0; } ;;
  *) echo "Déjà à jour."; rm -f "$RETRY_FILE"; exit 0 ;;
esac

if [ -n "$(git status --porcelain -- public/data)" ]; then
  fail "public/data a des modifications locales non commitées : mise à jour annulée."
fi

LATER="nouvel essai dans $((WAIT / 60)) minutes"
if [ "$MODE" = scores ]; then
  npm run --silent data -- --scores || fail "Récupération des scores échouée : anciennes données conservées, $LATER."
  # Sofascore n'a pas encore validé le score (prolongations, retard) : on repasse dans 30 minutes.
  [ -n "$(git status --porcelain -- public/data)" ] || { touch "$RETRY_FILE"; echo "Pas encore de nouveau score : $LATER."; exit 0; }
  LABEL="scores du $(date '+%d/%m/%Y %H:%M')"
else
  npm run --silent data -- --no-history || fail "Mise à jour échouée : anciennes données conservées, $LATER."
  if ! grep -q '"season":"Sofascore"' public/data/meta.json; then
    git checkout -- public/data
    fail "Sofascore n'a pas répondu : rien n'est poussé, $LATER."
  fi
  # Palmarès (Wikidata, TheSportsDB) : facultatif, gardé en cache 30 jours.
  npm run --silent palmares || echo "Palmarès non mis à jour (anciens conservés)."
  LABEL="mise à jour complète du $(date '+%d/%m/%Y %H:%M')"
fi

# meta.json change toujours (horodatage) : même sans nouveau match, le créneau est marqué comme fait.
git add public/data public/photos public/logos
git commit --quiet -m "Données : $LABEL (Mac)"
# Si la GitHub Action a poussé entre-temps, on rejoue notre commit par-dessus en gardant nos données.
git push --quiet || { git pull --rebase --quiet -X theirs && git push --quiet; } || fail "git push impossible."
rm -f "$RETRY_FILE"
echo "Poussé : le site se redéploie."
