#!/bin/zsh
# Installe (ou réinstalle) la tâche launchd qui met les données à jour le lundi 18 h 30 et le vendredi 8 h,
# heure du Mac. Si le Mac dort à l'heure dite, macOS lance la tâche au réveil ; s'il est éteint, elle saute.
# Désinstaller : launchctl bootout gui/$(id -u)/com.searchl1.donnees && rm ~/Library/LaunchAgents/com.searchl1.donnees.plist
#   puis supprimer ~/Library/Application Support/SearchL1
set -eu
SRC="${0:A:h:h:h}"
LABEL="com.searchl1.donnees"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE_DIR="$(dirname "$(command -v node)")"
# macOS interdit aux tâches de fond de lire ~/Documents, ~/Desktop… : la tâche a sa propre copie du dépôt ici.
HOME_DIR="$HOME/Library/Application Support/SearchL1"
REPO="$HOME_DIR/depot"
SCRIPT="$HOME_DIR/mise-a-jour.sh"

mkdir -p "$HOME_DIR"
if [ ! -d "$REPO/.git" ]; then
  git clone --quiet "$(git -C "$SRC" remote get-url origin)" "$REPO"
fi
git -C "$REPO" pull --ff-only --quiet
(cd "$REPO" && npm ci --silent --no-audit --no-fund)
# Copie du script avec les chemins de ce Mac (launchd ne charge pas nvm).
sed -e "s|__NODE_DIR__|$NODE_DIR|" -e "s|__REPO__|$REPO|" "$SRC/scripts/mac/update-and-push.sh" > "$SCRIPT"
chmod +x "$SCRIPT"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$SCRIPT</string></array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>18</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/searchl1-donnees.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/searchl1-donnees.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Tâche installée : lundi 18 h 30 et vendredi 8 h. Journal : ~/Library/Logs/searchl1-donnees.log"
echo "Lancer tout de suite pour tester : launchctl kickstart gui/$(id -u)/$LABEL"
