# Jarvis als Android-App

Jarvis gibt es als eigenständige Android-App (kein Browser, kein «Zum Startbildschirm hinzufügen»).
Die Website für Laptop und PC bleibt unverändert.

## So funktioniert es

- **Capacitor 8** baut eine Android-App (`android/`, App-ID `ch.jarvis.app`), die die Vercel-Seite
  `https://nachbereitung.vercel.app` in einer WebView öffnet (`capacitor.config.ts`, `server.url`).
  Damit gibt es nur eine Codebasis: Änderungen an der Website sind sofort auch in der App, ohne neue APK.
- Was die Android-WebView nicht kann, übernehmen native Plugins. Die Brücke steht in `src/lib/native.ts`;
  auf der Website ist `isNativeApp()` false und kein Plugin wird geladen.

| Funktion | Website | App |
|---|---|---|
| Zuhören | Web Speech API | `@capacitor-community/speech-recognition` (Spracherkennung des Handys) |
| Vorlesen | `speechSynthesis` | `@capacitor-community/text-to-speech` |
| Erinnerungen | Web Push über `/api/push/tick` | `@capacitor/local-notifications`: das Handy plant dieselben Erinnerungen (`buildReminders`) lokal, bei jedem Öffnen neu, höchstens 60 im Voraus. Kein Konto nötig. |
| Fokus-Timer | Meldung nur bei offener Seite | Ende von Fokus und Pause wird vorausgeplant, kommt auch bei geschlossener App |
| .ics-Export, Stapel als Datei | Download | Datei im App-Cache + Android-Teilen-Menü (`@capacitor/filesystem`, `@capacitor/share`) |
| Zurück-Taste | – | im Verlauf zurück, auf der ersten Seite App in den Hintergrund (`@capacitor/app`) |

- Ohne Netz beim allerersten Start zeigt die App `android-shell/offline.html`; danach hält der Service Worker
  die Seiten offline bereit wie im Browser.
- Statusleiste und Ränder: Capacitor-`SystemBars` (dunkler Stil, `safe-area-inset-*` wie bisher im CSS).

## Sicherheit

- Die nativen Funktionen sind nur für die eigene Adresse freigegeben (Capacitor bindet die Brücke an
  `server.url`). Fremde Seiten und Links öffnen im normalen Browser, YouTube-iframes haben keinen Zugriff.
- Benachrichtigungen tragen nur interne Pfade (`safeAppPath`), fremde Adressen werden ignoriert.
- Keine Geheimnisse in der APK: sie enthält nur die öffentliche Adresse. Supabase-Session und Daten liegen
  wie im Browser in der WebView.
- Kein Android-Backup und keine Geräteübertragung der App-Daten (`allowBackup=false`,
  `data_extraction_rules.xml`), kein unverschlüsselter Verkehr, Dateifreigabe nur aus dem Cache-Ordner.
- Berechtigungen: Internet, Mikrofon (erst beim ersten Zuhören gefragt), Benachrichtigungen (erst beim
  Einschalten gefragt), «Wecker und Erinnerungen» (optional, für minutengenaue Erinnerungen).
- Die CSP aus `next.config.ts` gilt auch in der App. Sie muss `'unsafe-inline'` für Skripte behalten, sonst
  blockiert sie auf alten WebViews die eingespritzte Capacitor-Brücke.

## App installieren (Handy)

1. Auf GitHub unter **Releases → «Jarvis Android (neueste)»** die Datei `jarvis.apk` auf dem Handy herunterladen
   (bei privatem Repo vorher im Browser bei GitHub anmelden).
2. Öffnen und installieren. Android fragt einmal, ob der Browser Apps installieren darf: erlauben.
3. In der App unter «Konto» anmelden; Daten kommen über den Abgleich. Erinnerungen in der App neu einschalten
   (gelten pro Gerät).

Updates: neue APK genauso installieren, die Daten bleiben. Das klappt nur, wenn beide APKs mit demselben
Schlüssel signiert sind (siehe unten). Wechsel von einer Debug-APK zu einer signierten: alte App einmal
deinstallieren (Daten danach per Anmeldung zurückholen).

## Bauen in GitHub (Standard)

Workflow `.github/workflows/android.yml` («Android-App») baut bei Änderungen an `android/`, `android-shell/`,
`capacitor.config.ts`, `package*.json` oder von Hand (Actions → Android-App → Run workflow):

- Mit Signierschlüssel (Secrets gesetzt): signierte Release-APK. Auf `main` wird das Release `android-latest`
  aktualisiert (`jarvis.apk` + SHA-256).
- Ohne Schlüssel: Debug-APK mit Warnung. Debug-APKs aus verschiedenen Läufen lassen sich nicht übereinander
  installieren.
- Jeder Lauf legt die APK zusätzlich als Artefakt `jarvis-android` ab (30 Tage).
- `versionCode` = Laufnummer, damit jede neue APK als Update gilt.

### Signierschlüssel einrichten (einmalig, auf dem Laptop)

```bash
scripts/android-keystore.sh            # legt ~/.jarvis/jarvis-release.jks an
```

Das Skript fragt ein Passwort (mind. 12 Zeichen) und setzt die Secrets per `gh`, wenn angemeldet, sonst zeigt es,
was in GitHub → Settings → Secrets and variables → Actions einzutragen ist:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`jarvis`), `ANDROID_KEY_PASSWORD`.
**Datei und Passwort sicher aufbewahren** (Passwortmanager). Ohne sie lassen sich keine Updates mehr über die
installierte App spielen. Der Schlüssel gehört nie ins Repo.

## Lokal bauen (Laptop mit Android Studio)

Voraussetzungen: Node 22, JDK 21, Android Studio (bringt das SDK mit; `ANDROID_HOME` gesetzt).

```bash
git pull
npm install
npm run android:sync      # kopiert Konfiguration und Plugins nach android/
npm run android:build     # Debug-APK: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open      # oder in Android Studio öffnen und auf ein Handy/Emulator starten
```

Gegen eine Vercel-Vorschau statt der Hauptseite testen:
`JARVIS_APP_URL=https://<vorschau>.vercel.app npm run android:sync` (danach wieder ohne Variable syncen).

Signierte Release-APK lokal: `JARVIS_KEYSTORE_FILE`, `JARVIS_KEYSTORE_PASSWORD`, `JARVIS_KEY_ALIAS`,
`JARVIS_KEY_PASSWORD` setzen, dann `cd android && ./gradlew assembleRelease`.

## Ändern

- Neues Capacitor-Plugin: `npm install <plugin>`, dann `npm run android:sync`; im Web-Code nur dynamisch
  importieren (`await import(...)`) und hinter `isNativeApp()`, damit die Website es nicht lädt.
- App-Symbole und Startbild neu erzeugen: `python3 scripts/android-icons.py` (aus `public/icon-512.png`).
- Benachrichtigungs-Symbol: `android/app/src/main/res/drawable/ic_stat_jarvis.xml`.
- Neue Adresse (eigene Domain): `server.url` in `capacitor.config.ts` und Knopf in `android-shell/offline.html`.
- Generierte Dateien (`android/app/src/main/assets/public`, `capacitor.config.json`, `capacitor.plugins.json`,
  `capacitor-cordova-android-plugins/`) sind nicht eingecheckt; `npx cap sync android` erzeugt sie.

## Grenzen

- Erinnerungen der App werden beim Öffnen neu geplant. Änderungen am Laptop erreichen das Handy also erst,
  wenn die App einmal geöffnet war (Web Push vom Server gibt es in der App nicht; dafür bräuchte es Firebase).
- iPhone-App gibt es noch nicht (Capacitor könnte es, braucht aber einen Mac und ein Apple-Konto).
- «Passwort vergessen»-Links aus der E-Mail öffnen im Browser; danach in der App normal anmelden.
