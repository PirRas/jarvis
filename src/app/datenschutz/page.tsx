import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutz · Jarvis" };

// Werte in Vercel setzen (Environment Variables), nicht in .env: die Datei ist eingecheckt.
const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME;
const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const region = process.env.NEXT_PUBLIC_DATA_REGION;

export default function DatenschutzPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Datenschutz</h1>
          <p className="lede">
            Jarvis ist ein kostenloses Uni-Cockpit für Studierende, ohne Werbung und ohne Tracking. Die Seite orientiert
            sich am Schweizer Datenschutzgesetz (revDSG). Stand: 15. Oktober 2026.
          </p>
        </div>
      </div>

      <section className="sheet panel">
        <h2 className="panel-title">1. Wer ist verantwortlich</h2>
        {operator && contact ? (
          <p>
            Verantwortlich: {operator}, Kontakt: <a href={`mailto:${contact}`}>{contact}</a>
          </p>
        ) : (
          <p>Angaben zur verantwortlichen Person werden vor der Öffnung für weitere Nutzerinnen und Nutzer ergänzt.</p>
        )}
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">2. Was auf deinem Gerät bleibt</h2>
        <p>
          Vorlesungen, Karteikarten, Termine, Aufgaben und Notizen liegen im Browser deines Geräts (IndexedDB). Die
          Schlüssel für KI-Dienste (Gemini, OpenRouter, YouTube) werden nur im localStorage dieses Geräts gespeichert.
          Ohne Anmeldung gleicht die App nichts mit einem Server ab.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">3. Konto und Abgleich (nur wenn du angemeldet bist)</h2>
        <p>
          Mit einem Konto gleicht Jarvis deine Daten zwischen deinen Geräten ab. Dafür speichert Supabase deine
          E-Mail-Adresse, einen Passwort-Hash (nicht das Passwort selbst) und die abgeglichenen Daten. Dazu gehören
          Profil, Links, Lernstand und die Abo-Adressen für Kalender und RSS. Abo-Adressen können private Links
          enthalten; Passwörter gehören nicht hinein.
        </p>
        <p>{region ? `Die Datenbank läuft in der Region ${region}.` : "Der Serverstandort richtet sich nach dem Supabase-Projekt."}</p>
        <p>
          Jede Person hat ein eigenes Konto, und andere Nutzerinnen und Nutzer sehen deine Daten nie. Die Datenbank
          schützt die Zeilen so, dass nur das eigene Konto darauf zugreifen kann. Eine Zwei-Faktor-Anmeldung mit einer
          Authenticator-App ist optional. Wer sie einschaltet, erhält Daten nur nach Eingabe des Codes.
        </p>
        <p>
          Push-Benachrichtigungen sind optional. Das Geräte-Abo und der Erinnerungsplan werden bei Supabase gespeichert.
          Der Versand läuft über den Push-Dienst des jeweiligen Browsers.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">4. Hosting und Server-Routen</h2>
        <p>
          Die App läuft auf Vercel. Vercel führt technisch nötige Server-Logs, die auch deine IP-Adresse enthalten. Die
          Server-Routen von Jarvis holen Kalender-Abos (ICS), RSS-Feeds und das Vorlesungsverzeichnis der Universität
          Basel stellvertretend ab, damit dein Browser sie laden kann. Die Adressen dieser Abos speichert der Server nicht.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">5. Dienste, die nur auf deine Aktion hin Daten erhalten</h2>
        <p>Diese Anfragen gehen direkt von deinem Browser an den Dienst. Dabei sieht der Dienst deine IP-Adresse.</p>
        <ul>
          <li>
            <strong>Google Gemini:</strong> Folien und Fragen für den Sprachassistenten, mit deinem eigenen Schlüssel.
          </li>
          <li>
            <strong>OpenRouter:</strong> Ersatz, wenn Gemini nicht antwortet. Es wird nur der ausgelesene Folientext
            übermittelt.
          </li>
          <li>
            <strong>YouTube Data API:</strong> Suche nach Lernvideos.
          </li>
          <li>
            <strong>PubChem:</strong> Stoffsuche. Der gesuchte Stoff wird übermittelt.
          </li>
          <li>
            <strong>Have I Been Pwned:</strong> Beim Wählen eines neuen Passworts wird geprüft, ob es in bekannten
            Datenlecks vorkommt. Übermittelt werden nur die ersten 5{" "}Zeichen seines Hashwerts, nie das Passwort selbst.
          </li>
          <li>
            <strong>Spracherkennung des Browsers:</strong> Je nach Browser läuft sie über Server des Herstellers, bei Chrome
            zum Beispiel über Google.
          </li>
        </ul>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">6. Eingebettete Inhalte</h2>
        <p>
          YouTube-Videos starten erst nach einem Klick und laufen über youtube-nocookie.com. Vimeo-Videos funktionieren
          gleich über player.vimeo.com. Die Vorschaubilder der YouTube-Videos kommen von i.ytimg.com und laden schon beim
          Anzeigen. Pflanzenbilder stammen von Wikimedia. Dabei sieht der jeweilige Server deine IP-Adresse.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">7. Cookies und Speicher</h2>
        <p>
          Jarvis setzt keine Cookies für Werbung oder Analyse und verwendet kein Tracking. Darum gibt es auch kein
          Cookie-Banner. Die Schriften sind in der App eingebaut, es gibt keinen Abruf bei Google Fonts. Technisch nötig
          ist nur der Speicher (localStorage) für deine Anmeldesitzung und die Einstellungen dieses Geräts.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">8. Deine Rechte</h2>
        <p>
          Du kannst Auskunft über deine Daten verlangen sowie deren Berichtigung oder Löschung. Daten auf diesem Gerät
          löschst du unter „Konto“ mit „Abmelden und Gerät leeren“. Konto und alle Daten löschst du selbst unter „Konto“
          → „Konto endgültig löschen“. Auskunft und Berichtigung erhältst du über den Kontakt in Abschnitt 1.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">9. Hinweise zur Nutzung</h2>
        <p>
          Die Nutzung ist kostenlos und erfolgt ohne Gewähr. KI-Zusammenfassungen, Karteikarten und Quiz können Fehler
          enthalten und ersetzen weder die Vorlesung noch die Fachliteratur.
        </p>
        <ul>
          <li>
            <strong>Unterlagen:</strong> Lade nur Unterlagen hoch, die du nutzen darfst. Vorlesungsfolien sind
            urheberrechtlich geschützt. Zur Aufbereitung werden sie an Google Gemini bzw. OpenRouter übermittelt, mit
            deinem eigenen Schlüssel. Sie werden nicht mit anderen Nutzerinnen und Nutzern geteilt. Im kostenlosen
            Kontingent darf Google die Eingaben zur Verbesserung seiner Modelle verwenden; dasselbe gilt für
            OpenRouter-Gratismodelle.
          </li>
          <li>
            <strong>Stapel teilen:</strong> Über „Teilen“ bei einer Vorlesung entsteht ein Link oder eine Datei mit
            Nachbereitung, Karteikarten, Quiz und Klausuraufgaben. Der Link enthält den Inhalt selbst; er wird nicht auf
            einem Server gespeichert, und der Teil nach dem # wird nicht an einen Server gesendet. Wer den Link oder die
            Datei hat, kann den Inhalt lesen. Dein Lernfortschritt wird nicht geteilt.
          </li>
          <li>
            <strong>Sensible Angaben:</strong> Trage keine Passwörter und keine Gesundheitsdaten Dritter ein.
          </li>
        </ul>
      </section>
    </>
  );
}
