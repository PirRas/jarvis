/** Strukturierte Daten (schema.org) für Suchmaschinen und KI-Suche. `<` wird maskiert, damit der Inhalt das Skript nicht beenden kann. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
