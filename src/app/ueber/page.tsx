import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, FEATURES, UPDATED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Über Jarvis: Funktionen und häufige Fragen",
  description:
    "Was Jarvis kann: Stundenplan mit Live-Räumen der Uni Basel, Kalender, Prüfungen, KI-Nachbereitung mit Karteikarten und Quiz, Sprachassistent. Kostenlos, ohne Werbung und Tracking.",
  alternates: { canonical: "/ueber" },
};

export default function UeberPage() {
  return (
    <>
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
        <Link className="btn" href="/heute">
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
