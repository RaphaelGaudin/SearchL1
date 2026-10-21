#!/bin/zsh
# Installe (ou réinstalle) la tâche launchd qui met les données à jour le lundi 18 h 30 et le vendredi 8 h,
# heure du Mac. Si le Mac dort à l'heure dite, macOS lance la tâche au réveil ; s'il est éteint, elle saute.
# Désinstaller : launchctl bootout gui/$(id -u)/com.searchl1.donnees && rm ~/Library/LaunchAgents/com.searchl1.donnees.plist
set -eu
REPO="${0:A:h:h:h}"
LABEL="com.searchl1.donnees"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE_DIR="$(dirname "$(command -v node)")"
SCRIPT="$REPO/scripts/mac/.update-and-push.local.sh"

# Copie locale du script avec le chemin de Node de ce Mac (launchd ne charge pas nvm).
sed "s|__NODE_DIR__|$NODE_DIR|" "$REPO/scripts/mac/update-and-push.sh" > "$SCRIPT"
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
