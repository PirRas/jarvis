#!/usr/bin/env bash
# Erzeugt den Release-Schlüssel für die Jarvis-Android-App (ausserhalb des Repos).
# Aufruf: scripts/android-keystore.sh [pfad/zur/datei.jks]
# Nicht-interaktiv: Passwort in JARVIS_KEYSTORE_PASSWORD setzen.
set -euo pipefail

ALIAS="jarvis"
FILE="${1:-$HOME/.jarvis/jarvis-release.jks}"

command -v keytool >/dev/null || { echo "keytool nicht gefunden (Java installieren)." >&2; exit 1; }

if [ -e "$FILE" ]; then
  echo "Abbruch: $FILE existiert bereits (wird nicht überschrieben)." >&2
  exit 1
fi

if [ -n "${JARVIS_KEYSTORE_PASSWORD:-}" ]; then
  PASS="$JARVIS_KEYSTORE_PASSWORD"
else
  read -r -s -p "Passwort (mind. 12 Zeichen): " PASS; echo
  read -r -s -p "Passwort wiederholen: " PASS2; echo
  [ "$PASS" = "$PASS2" ] || { echo "Abbruch: Passwörter stimmen nicht überein." >&2; exit 1; }
fi
if [ "${#PASS}" -lt 12 ]; then
  echo "Abbruch: Passwort muss mindestens 12 Zeichen haben." >&2
  exit 1
fi

DIR="$(dirname "$FILE")"
mkdir -p "$DIR"
chmod 700 "$DIR"

# Passwort über Umgebungsvariable statt Argument (nicht in der Prozessliste sichtbar)
export KS_PASS="$PASS"
keytool -genkeypair -v \
  -keystore "$FILE" -storetype JKS \
  -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Jarvis, O=Jarvis, C=CH" \
  -storepass:env KS_PASS -keypass:env KS_PASS >/dev/null
chmod 600 "$FILE"

echo
echo "Schlüssel erstellt: $FILE (Alias: $ALIAS)"
echo
echo "WICHTIG: Datei UND Passwort sicher aufbewahren (z. B. im Passwortmanager)."
echo "Ohne sie lassen sich keine Updates über die installierte App installieren."
echo

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  echo "gh ist angemeldet. Secrets setzen (im Repo-Ordner ausführen):"
else
  echo "gh fehlt oder ist nicht angemeldet. Manuell in GitHub setzen:"
  echo "Repository -> Settings -> Secrets and variables -> Actions -> New repository secret"
fi
echo "  ANDROID_KEYSTORE_BASE64  = $(printf 'base64 < %q | tr -d "\\n"' "$FILE")"
echo "  ANDROID_KEYSTORE_PASSWORD = dein Passwort"
echo "  ANDROID_KEY_ALIAS         = $ALIAS"
echo "  ANDROID_KEY_PASSWORD      = dein Passwort"

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  echo
  read -r -p "Secrets jetzt mit gh setzen? [j/N] " ANS || ANS=""
  if [ "$ANS" = "j" ]; then
    base64 < "$FILE" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
    printf '%s' "$PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD
    printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS
    printf '%s' "$PASS" | gh secret set ANDROID_KEY_PASSWORD
    echo "Secrets gesetzt."
  fi
fi
