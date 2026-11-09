import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { FAQ, FEATURES, SITE_URL, UPDATED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Über Jarvis: Funktionen und häufige Fragen",
  description:
    "Was Jarvis kann: Stundenplan mit Live-Räumen der Uni Basel, Kalender, Prüfungen, KI-Nachbereitung mit Karteikarten und Quiz, Sprachassistent. Kostenlos, ohne Werbung und Tracking.",
  alternates: { canonical: "/ueber" },
};

const faqData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  url: `${SITE_URL}/ueber`,
  inLanguage: "de-CH",
  dateModified: UPDATED,
  isPartOf: { "@id": `${SITE_URL}/#website` },
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function UeberPage() {
  return (
    <>
      <JsonLd data={faqData} />
      <div className="page-head">
        <div>
          <h1 className="page-title">Über Jarvis</h1>
          <p className="lede">
            Jarvis ist ein kostenloses Uni-Cockpit für Studierende der Pharmazeutischen Wissenschaften an der Universität
            Basel. Es bündelt Stundenplan, Kalender, Prüfungen und die Nachbereitung von Vorlesungen, ohne Werbung und ohne
            Tracking.
          </p>
          <p className="muted">
            Stand: <time dateTime={UPDATED}>{new Date(UPDATED).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })}</time>
          </p>
        </div>
        <Link className="btn" href="/">
          Jarvis öffnen
        </Link>
      </div>

      <section className="sheet panel">
        <h2 className="panel-title">Funktionen</h2>
        <ul>
          {FEATURES.map(([title, text]) => (
            <li key={title}>
              <strong>{title}:</strong> {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">Häufige Fragen</h2>
        {FAQ.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <section className="sheet panel">
        <h2 className="panel-title">Datenschutz und Anbieter</h2>
        <p>
          Wie Jarvis mit deinen Daten umgeht, steht unter <Link href="/datenschutz">Datenschutz</Link>, wer Jarvis
          betreibt im <Link href="/impressum">Impressum</Link>.
        </p>
      </section>
    </>
  );
}
