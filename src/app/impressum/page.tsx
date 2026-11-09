import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR } from "@/lib/site";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum von Jarvis, dem kostenlosen Uni-Cockpit für Studierende: verantwortliche Person, Kontakt und Haftungshinweise.",
  alternates: { canonical: "/impressum" },
};

export default function ImpressumPage() {
  const complete = OPERATOR.name && OPERATOR.address && OPERATOR.email;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Impressum</h1>
          <p className="lede">Angaben zur verantwortlichen Person für diese Website und die Jarvis-App.</p>
        </div>
      </div>

      <section className="sheet panel">
        <h2 className="panel-title">Verantwortlich</h2>
        {complete ? (
          <address style={{ fontStyle: "normal" }}>
            {OPERATOR.name}
            <br />
            {OPERATOR.address!.split(",").map((line, i) => (
              <span key={i}>
                {line.trim()}
                <br />
              </span>
            ))}
            E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
          </address>
        ) : (
          <p>Die Angaben zur verantwortlichen Person werden vor der Öffnung für weitere Nutzerinnen und Nutzer ergänzt.</p>
        )}
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">Haftung</h2>
        <p>
          Jarvis ist ein kostenloses Studienwerkzeug, die Nutzung erfolgt ohne Gewähr. KI-Zusammenfassungen, Karteikarten
          und Quiz können Fehler enthalten und ersetzen weder die Vorlesung noch die Fachliteratur. Für Inhalte verlinkter
          Websites sind deren Betreiber verantwortlich.
        </p>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">Datenschutz</h2>
        <p>
          Wie Jarvis Daten bearbeitet, steht in der <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </section>
    </>
  );
}
