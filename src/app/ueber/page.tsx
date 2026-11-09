import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { FAQ, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Über Jarvis: Funktionen und häufige Fragen",
  description:
    "Was Jarvis kann: Stundenplan mit Live-Räumen der Uni Basel, Kalender, Prüfungen, KI-Nachbereitung mit Karteikarten und Quiz, Sprachassistent. Kostenlos, ohne Werbung und Tracking.",
  alternates: { canonical: "/ueber" },
};

const FEATURES = [
  ["Stundenplan mit Live-Räumen", "Lektionen aus dem Kalender-Abo der Uni, Raumänderungen aus dem Vorlesungsverzeichnis der Universität Basel."],
  ["Kalender und Prüfungen", "Termine, Abgaben und Prüfungen an einem Ort, mit wiederkehrenden Terminen und Erinnerungen per Push."],
  ["Nachbereitung mit KI", "Aus den Folien einer Vorlesung entstehen Notizen mit Diagrammen, Strukturformeln und Abbildungen."],
  ["Karteikarten und Quiz", "Wiederholung nach Plan, Quiz mit KI-Korrektur offener Antworten und mögliche Prüfungsaufgaben."],
  ["Lernplan", "Jarvis verteilt die Nachbereitung auf freie Zeiten und plant um, wenn etwas dazwischenkommt."],
  ["Sprachassistent", "Frag Jarvis nach deinem Tag, lass Termine und Aufgaben anlegen oder die Nachbereitung verschieben."],
  ["Pharmazie-Werkzeuge", "Pharmakokinetik-Rechner, Stoffsuche mit Strukturformeln und Literatursuche mit Zitat."],
  ["Auf allen Geräten", "Im Browser, als installierbare Web-App und als Android-App, mit Abgleich über ein optionales Konto."],
] as const;

const faqData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  url: `${SITE_URL}/ueber`,
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
