# Jarvis – Uni-Cockpit

Persönliches Cockpit für das Studium der Pharmazeutischen Wissenschaften an der Universität Basel.

> **English summary:** Jarvis is an open-source study cockpit (Next.js PWA + Android app) for pharmacy students at the
> University of Basel. It combines the timetable with live room changes from the course catalogue, a calendar with
> subscribed feeds, a lecture follow-up planner that reschedules itself when you miss a slot, AI-generated lecture
> notes, flashcards and quizzes (free Gemini tier, key stays in the browser) and a German voice assistant.
> Data lives in the browser (IndexedDB) and syncs via Supabase with row-level security. The UI is German.
> Setup: see [Eigene Instanz aufsetzen](#eigene-instanz-aufsetzen). License: [MIT](LICENSE).
> Contributions: [CONTRIBUTING.md](CONTRIBUTING.md).

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Supabase (Auth, Postgres mit RLS), IndexedDB (`idb`),
Web-Push, Zod, Gemini (Gratis-Stufe), Capacitor 8 für Android, Hosting auf Vercel.

## Was Jarvis kann

- **Heute**: Beim Öffnen siehst du sofort, was als Nächstes kommt, wie lange es noch dauert und in welchem Raum.
  Dazu die Tagesliste, Prüfungen und Fristen mit Countdown und Lernstand sowie Empfehlungen für den Tag.
- **Räume live aus dem Vorlesungsverzeichnis**: Für jede Lektion mit Veranstaltungsnummer (z. B. 10380) holt Jarvis
  die Einzeltermine aus vorlesungsverzeichnis.unibas.ch. Je näher die Lektion, desto häufiger wird geprüft
  (alle 10 Minuten in den letzten 3 Stunden). Weicht der Raum vom üblichen Raum ab, erscheint eine auffällige,
  gelb-rote Warnung „Anderer Raum!“ mit dem sonst üblichen Raum durchgestrichen daneben. Fehlt ein Termin im
  Verzeichnis, weist Jarvis darauf hin, dass die Lektion vielleicht ausfällt.
- **Stundenplan**: Vorlage „Pharmazeutische Wissenschaften, 1. Semester, HS 2026“ nach dem Wochenplan des
  Departements, eigene Einträge oder Import aus Foto/PDF über Claude.
- **Kalender**: Stundenplan, eigene Termine, Prüfungen, Fristen und abonnierte Kalender (ADAM, Outlook) an einem Ort.
  Termine lassen sich aus kopiertem Text erkennen (Ankündigungen, Mails, Prüfungsübersicht) und als .ics exportieren.
- **Lektions-Vorschau**: Folien (PDF) vor der Lektion hinzufügen; Jarvis zeigt sofort die Themen und auf Wunsch eine
  Kurzzusammenfassung von Claude.
- **Links**: ADAM, Online-Services, Outlook, Vorlesungsverzeichnis, Departement, Fachgruppe, Compendium,
  Swissmedicinfo, Bibliothek und mehr. ADAM und services.unibas.ch verbieten das Einbetten in andere Seiten
  (`frame-ancestors 'self'`), daher öffnen sie sich in einem neuen Tab.
- **Nachbereitungsplan** (Lernplan, `src/lib/prepPlan.ts`): Jede Vorlesung seit Semesterbeginn, die noch nicht
  nachbereitet ist, bekommt eine Einheit in freier Zeit (werktags 13–20 Uhr, Wochenende 10–17 Uhr, einstellbar unter
  „Lernzeiten“). Neue Vorlesungen kommen am selben Tag dran, der Rückstand der Reihe nach. Der Plan wird nie
  gespeichert, sondern immer neu gerechnet: Neue Termine, „keine Zeit“ oder eine verpasste Einheit verschieben
  automatisch. Was nach hinten gerutscht ist, zeigt Jarvis mit Grund und drei freien Alternativen. Abhaken pro Woche,
  Erinnerung 10 Minuten vorher (Push), Einheiten im Kalender und im .ics-Export.
- **Nachbereitung**: Vorlesungsfolien mit Claude nachbereiten, Karteikarten mit verteilter Wiederholung, Quiz und
  Klausuraufgaben (siehe unten).

## Mit Jarvis sprechen

Beim Öffnen der App (Handy oder Browser) erscheint zuerst der Sprachbildschirm. Reaktor antippen (am PC: Leertaste),
sprechen, Jarvis antwortet laut und erledigt es: Termine nennen, eintragen, verschieben und löschen, Aufgaben anlegen und
abhaken, Lernstand und Lernzeit, Noten eintragen, Fokus-Timer starten, Seiten und Links öffnen. „Cockpit“ führt zur
normalen App, der Mikrofon-Knopf unten rechts wieder zurück.

- Braucht denselben kostenlosen Gemini-Schlüssel wie die Nachbereitung (Funktionsaufrufe, `src/lib/jarvisAgent.ts`,
  Werkzeuge in `src/lib/voiceTools.ts`). Spracherkennung und Stimme kommen vom Browser (Chrome/Edge am besten;
  wo es keine Spracherkennung gibt, z. B. Firefox, tippt man).
- Schalter: „Stimme“ (vorlesen), „Gespräch“ (nach der Antwort gleich wieder zuhören), „Beim Start“ (Sprachbildschirm beim Öffnen).
- Termine aus dem Stundenplan oder aus Abos ändert Jarvis nicht, nur eigene. Vor dem Löschen fragt Jarvis nach.
- Beim Öffnen begrüsst Jarvis dich mit deinem Vornamen (aus „Konto“ → Profil), sagt, was heute noch ansteht und welche Aufgaben bald fällig sind. Browser lesen erst nach der ersten Berührung vor: einmal tippen, Jarvis begrüsst dich und hört danach zu.
- Stimme: Jarvis nimmt die beste männliche deutsche Stimme des Geräts (am natürlichsten in Edge: „Jan“/„Conrad“ Online). Wo keine männliche Stimme erkennbar ist (z. B. Chrome), klingt die vorhandene etwas tiefer.
- **Nachbereitung per Sprache:** „Wie viel muss ich noch nachbereiten?“, „Anatomie vom Montag ist erledigt“, „heute Nachmittag habe ich keine Zeit“ (trägt eine Sperre ein, die Einheiten rutschen), „leg Physik auf Samstag 15 Uhr“, „am Wochenende will ich nicht lernen“. Neue Termine meldet Jarvis mit Überschneidungen und verschobenen Einheiten samt Vorschlägen.
- **Gedächtnis und Verlauf:** Gespräche werden gespeichert und abgeglichen („Verlauf“, höchstens 50; ein Gespräch der letzten 3 Stunden wird beim Öffnen fortgesetzt). Dauerhaftes („ich arbeite freitags bis 21 Uhr“) merkt sich Jarvis mit `merken` und gibt es jedem Gespräch mit; „vergiss …“ löscht es.
- **Serientermine:** „Ich arbeite jeden Samstag von 12 bis 17 Uhr in der Zentralapotheke in Olten“ trägt einen wöchentlichen Termin ein; im Kalender geht das mit „Jede Woche wiederholen“ (optional mit Enddatum). Löschen entfernt die ganze Serie.

## Automatisch erstellen (kostenlos)

1. Einmal einen kostenlosen Gemini-Schlüssel holen: https://aistudio.google.com/apikey (Google-Konto genügt, keine Kreditkarte) und unter „Vorlesungen“ → „Neue Vorlesung hinzufügen“ eintragen.
2. Danach PDF wählen: Jarvis erstellt Nachbereitung, Karteikarten und Quiz und sucht Videos selbst (1–3 Minuten).

- Die Ausweichkette: Gemini 3.5 Flash → Gemini Flash-Lite → Gemini Flash (neuestes Modell, unter Last oft sehr langsam) → OpenRouter-Gratismodelle (Nemotron). Überlastete Modelle werden nach 3 Sekunden einmal neu versucht; hängende Anfragen brechen nach 3 Minuten ab und das nächste Modell übernimmt. Optional kann man zusätzlich einen kostenlosen OpenRouter-Schlüssel eintragen (https://openrouter.ai/settings/keys); dann nutzt Jarvis als letzte Ausweiche Gratismodelle von OpenRouter (ca. 50 Anfragen pro Tag). Dabei wird nur der Folientext gelesen (Bilder/Diagramme fehlen) und es werden keine Videos gesucht – Videos kommen dann nur über YouTube (falls Schlüssel eingetragen). Die Statuszeile zeigt, welches Modell gearbeitet hat.
- **Videos**: Mit einem kostenlosen YouTube-Schlüssel (Google Cloud Console → „YouTube Data API v3“ aktivieren → „Anmeldedaten“ → „API-Schlüssel“; am besten auf die YouTube Data API und die eigene Website beschränken) sucht Jarvis pro Thema ein passendes deutsches Video direkt bei YouTube – zuverlässig, ohne erfundene Links, ca. 100 Suchen pro Tag. Ohne YouTube-Schlüssel versucht es Gemini mit Google-Suche, die im Gratis-Kontingent aber oft gesperrt ist.
- Der Aufruf läuft direkt im Browser zu Google (`src/lib/gemini.ts`). Die Schlüssel bleiben auf dem Gerät (localStorage) und müssen pro Gerät einmal eingetragen werden.
- Grenzen: kostenloses Tageskontingent von Google; PDFs bis 18 MB. Im kostenlosen Kontingent darf Google die Eingaben zur Verbesserung seiner Modelle verwenden; dasselbe gilt für OpenRouter-Gratismodelle. Keine vertraulichen Unterlagen hochladen.
- Der Weg über claude.ai (Prompts kopieren) bleibt als Ausweichweg erhalten, siehe unten.

## Nachbereitung hinzufügen

1. Unter „Vorlesungen“ auf „Neue Vorlesung hinzufügen“ tippen.
2. Auf claude.ai einen neuen Chat öffnen und die Folien als PDF anhängen.
3. „Prompt 1 kopieren“, im Chat einfügen, senden und Claudes Antwort zurück in die App kopieren.
4. „Prompt 2 kopieren“, im selben Chat senden und die Antwort ebenfalls einfügen.
5. „Vorlesung speichern“.

## Nachbereitung mit Claude Code

`/nachbereitung <pdf>` in Claude Code: Claude liest die PDF selbst (Abo, keine API, kein Gemini), erstellt Notizen, Karteikarten und Quiz und speichert sie über `scripts/nachbereitung-save.ts` direkt in Supabase; beim nächsten Abgleich erscheint die Vorlesung in der App. Einmalig in `.env.local` setzen: `JARVIS_EMAIL` und `JARVIS_PASSWORD` (das Konto aus der App). Mit `--dry-run` wird nur geprüft.

## Technik

- Next.js auf Vercel (Gratis-Stufe). Zwei kleine Server-Routen:
  - `GET /api/vv?nr=10380` liest Termine und Räume aus dem Vorlesungsverzeichnis (10 Minuten zwischengespeichert).
  - `POST /api/ics` holt Kalender-Abos ab (Browser dürfen fremde Kalender nicht direkt laden).
- Alle Daten liegen im Browser (IndexedDB) und werden über Supabase zwischen Handy und PC abgeglichen,
  sobald du unter „Konto“ angemeldet bist. Tabelle: `supabase/schema.sql`.
- Android-App: Capacitor-Hülle in `android/`, lädt die Vercel-Seite und ergänzt native Sprache, Erinnerungen und Teilen (`src/lib/native.ts`). Details in `ANDROID.md`.

```
npm install
npm run dev
```

Dann http://localhost:3000 öffnen.

## Eigene Instanz aufsetzen

Voraussetzungen: Node.js 22 und npm 10, ein kostenloses [Supabase](https://supabase.com)-Projekt, optional ein
Vercel-Konto zum Hosten.

1. Repository klonen und Abhängigkeiten installieren: `npm ci`.
2. In Supabase im SQL-Editor `supabase/schema.sql` (Abgleich) und `supabase/push.sql` (Push-Erinnerungen) ausführen.
3. `.env.example` nach `.env.local` kopieren und ausfüllen. `.env` enthält die Werte der offiziellen Instanz
   (nur öffentliche Angaben); `.env.local` überschreibt sie.
4. `npm run dev` und http://localhost:3000 öffnen. Ohne Supabase-Werte läuft die App nur lokal ohne Abgleich.
5. Hosten: Projekt in Vercel importieren und dieselben Variablen dort setzen. Danach die Launch-Checkliste unten
   durchgehen.

| Variable | Wo | Wofür |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | öffentlich | Anmeldung und Abgleich |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | öffentlich / geheim | Web-Push (`npx web-push generate-vapid-keys`) |
| `SUPABASE_SECRET_KEY` | geheim | Push-Versand und „Konto löschen“ (Server) |
| `PUSH_CRON_SECRET` | geheim | Cron-Job in Supabase → `/api/push/tick` |
| `NEXT_PUBLIC_OPERATOR_NAME`, `…_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_DATA_REGION` | öffentlich | Impressum, Datenschutz |
| `NEXT_PUBLIC_SITE_URL` | öffentlich | eigene Domain (Sitemap, Canonical) |

Gemini-, OpenRouter- und YouTube-Schlüssel sind keine Server-Variablen: Jede Person trägt sie in der App ein.
Die Android-App lädt standardmässig `nachbereitung.vercel.app`; für eine eigene Instanz `JARVIS_APP_URL` beim Build
setzen (siehe `ANDROID.md`).

## Installieren

- **Android-App (empfohlen):** eigenständige App, Anleitung zum Installieren und Bauen in [`ANDROID.md`](ANDROID.md). Neueste APK: GitHub → Releases → „Jarvis Android (neueste)“.
- **Android im Browser:** Seite in Chrome öffnen, Menü → „Zum Startbildschirm hinzufügen“.
- **Windows:** Seite in Edge oder Chrome öffnen, in der Adressleiste „App installieren“.

## Tastenkürzel beim Lernen

| Taste | Aktion |
|---|---|
| Leertaste / Enter | Antwort zeigen |
| 1 / 2 / 3 / 4 | Nochmal / Schwer / Gut / Einfach |
| Strg+Z | Letzte Bewertung rückgängig |
| @ | Karte zurückstellen |

## Vor dem Öffnen für andere (Launch-Checkliste)

- **Vercel → Environment Variables:** `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_ADDRESS` (Strasse, PLZ Ort, mit Kommas getrennt), `NEXT_PUBLIC_CONTACT_EMAIL` und `NEXT_PUBLIC_DATA_REGION` setzen (sie erscheinen im Impressum und in der Datenschutzerklärung). Mit eigener Domain zusätzlich `NEXT_PUBLIC_SITE_URL` (Canonical, Sitemap, robots.txt, llms.txt).
- **Suchmaschinen:** öffentlich sind nur `/` (Infoseite; das Cockpit liegt unter `/heute`, wer die App schon nutzt, wird von `/` dorthin weitergeleitet), `/ueber`, `/datenschutz`, `/impressum` (`PUBLIC_PAGES` in `src/lib/site.ts`); alle App-Seiten senden `X-Robots-Tag: noindex` (`next.config.ts`). Neue App-Seite → in `PRIVATE_ROUTES` eintragen.
- Geheimnisse (`SUPABASE_SECRET_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_CRON_SECRET`) nur in Vercel oder `.env*.local`, nie in `.env`. Diese Datei ist eingecheckt und enthält nur öffentliche Werte.
- **Supabase → Authentication:** E-Mail-Bestätigung an; minimale Passwortlänge 10; MFA (TOTP) aktivieren; „Leaked password protection“ an (falls im Plan verfügbar).
- **CAPTCHA:** Cloudflare Turnstile (gratis) gegen Bot-Registrierungen. Danach muss die CSP in `next.config.ts` den CAPTCHA-Host erlauben.
- **Supabase → Rate-Limits** prüfen. **Site URL** und **Redirect URLs** auf die Vercel-Domain setzen (für Bestätigungs- und Passwort-Links).
- **SQL-Editor:** `supabase/schema.sql` und `supabase/push.sql` erneut ausführen (neue 2FA-Regel).
- **Vercel → Firewall:** Rate-Limit-Regel für `/api/*` anlegen. Das eingebaute Limit in `src/middleware.ts` gilt nur pro Server-Instanz.
- Supabase-Region in `NEXT_PUBLIC_DATA_REGION` eintragen, damit die Datenschutzerklärung stimmt.
- **Android-App:** einmal `scripts/android-keystore.sh` ausführen und die vier `ANDROID_*`-Secrets in GitHub setzen (siehe `ANDROID.md`), sonst signiert GitHub jede APK mit einem anderen Test-Schlüssel (Updates nur nach Deinstallation). Für den Play Store bräuchte es zusätzlich ein AAB, einen Store-Eintrag und eine Datenschutz-URL (`/datenschutz`).

## Mitmachen und Lizenz

Beiträge sind willkommen, siehe [`CONTRIBUTING.md`](CONTRIBUTING.md). Sicherheitslücken bitte privat melden
([`SECURITY.md`](SECURITY.md)). Lizenz: [MIT](LICENSE).
