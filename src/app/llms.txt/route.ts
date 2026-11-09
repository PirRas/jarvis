import { FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

// Kurzbeschreibung für KI-Assistenten und KI-Suche (Format nach llmstxt.org).
export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Jarvis ist ein Uni-Cockpit für Studierende der Pharmazeutischen Wissenschaften an der Universität Basel. Es läuft im Browser, als installierbare Web-App und als Android-App. Daten bleiben zuerst auf dem Gerät; ein Konto für den Abgleich zwischen Geräten ist optional. Die App ist kostenlos, ohne Werbung und ohne Tracking. Alle Seiten ausser den unten genannten zeigen persönliche Daten und sind nicht für Suchmaschinen gedacht.

## Seiten

- [Startseite](${SITE_URL}/): Überblick, Funktionen, häufige Fragen
- [Jarvis öffnen](${SITE_URL}/heute): die App selbst (persönliche Daten, nicht indexiert)
- [Über Jarvis](${SITE_URL}/ueber): Funktionen und häufige Fragen
- [Datenschutz](${SITE_URL}/datenschutz): welche Daten wohin gehen
- [Impressum](${SITE_URL}/impressum): verantwortliche Person und Kontakt

## Optional

- [Vollständige Beschreibung](${SITE_URL}/llms-full.txt): alle öffentlichen Inhalte als Text

## Häufige Fragen

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
