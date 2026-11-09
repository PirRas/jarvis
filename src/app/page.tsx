import type { Metadata } from "next";
import Link from "next/link";
import { HudRing } from "@/components/HudRing";
import { JsonLd } from "@/components/JsonLd";
import { LandingRedirect } from "@/components/LandingRedirect";
import { FAQ, FEATURES, OPERATOR, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, UPDATED } from "@/lib/site";

// Öffentliche Startseite (für Suchmaschinen, KI-Suche und neue Besucher). Das Cockpit liegt unter /heute.
export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/", languages: { "de-CH": "/" }, types: { "text/plain": "/llms.txt" } },
};

const STEPS = [
  ["Stundenplan verbinden", "Kalender-Abo der Uni einfügen oder die Vorlage des Departements wählen. Räume und Änderungen kommen automatisch."],
  ["Folien hochladen", "Nach der Vorlesung die PDF hochladen. Jarvis erstellt Notizen, Karteikarten, Quiz und Prüfungsaufgaben."],
  ["Täglich lernen", "Jarvis plant Wiederholung und Nachbereitung in freie Zeiten und erinnert dich rechtzeitig vor Prüfungen."],
] as const;

const author = OPERATOR.name
  ? { "@type": "Person", "@id": `${SITE_URL}/#author`, name: OPERATOR.name, ...(OPERATOR.email ? { email: `mailto:${OPERATOR.email}` } : {}) }
  : null;
const byAuthor = author ? { author: { "@id": `${SITE_URL}/#author` } } : {};

const structured = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "de-CH",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.png`,
      description: SITE_DESCRIPTION,
      ...(OPERATOR.email ? { email: OPERATOR.email } : {}),
      ...(author ? { founder: { "@id": `${SITE_URL}/#author` } } : {}),
    },
    ...(author ? [author] : []),
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: SITE_TITLE,
      description: SITE_DESCRIPTION,
      inLanguage: "de-CH",
      dateModified: UPDATED,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}/opengraph-image`,
      ...byAuthor,
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/heute`,
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web, Android",
      inLanguage: "de-CH",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "CHF" },
      audience: { "@type": "EducationalAudience", educationalRole: "student" },
      featureList: FEATURES.map(([title]) => title),
      publisher: { "@id": `${SITE_URL}/#organization` },
      ...byAuthor,
    },
    {
      "@type": "HowTo",
      name: "So startest du mit Jarvis",
      step: STEPS.map(([name, text], i) => ({ "@type": "HowToStep", position: i + 1, name, text })),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

export default function LandingPage() {
  return (
    <>
      <LandingRedirect />
      <JsonLd data={structured} />

      <header className="landing-hero">
        <HudRing size={220}>
          <span className="hud-time">J</span>
        </HudRing>
        <div>
          <h1 className="page-title">Jarvis – dein Uni-Cockpit fürs Pharmaziestudium</h1>
          <p className="lede">
            Stundenplan mit Live-Räumen, Kalender, Prüfungen und KI-Nachbereitung von Vorlesungen mit Karteikarten und
            Quiz, an einem Ort. Gemacht für Studierende der Pharmazeutischen Wissenschaften an der Universität Basel.
          </p>
          <p className="hud-tags">
            <span className="hud-tag">Kostenlos</span>
            <span className="hud-tag">Ohne Werbung und Tracking</span>
            <span className="hud-tag">Web und Android</span>
          </p>
          <p className="landing-cta">
            <Link className="btn btn-primary" href="/heute">
              Jarvis öffnen
            </Link>
            <Link className="btn" href="/ueber">
              Mehr über Jarvis
            </Link>
          </p>
        </div>
      </header>

      <section aria-labelledby="funktionen">
        <h2 id="funktionen" className="landing-section">
          Was Jarvis kann
        </h2>
        <div className="feature-grid">
          {FEATURES.map(([title, text]) => (
            <article key={title} className="sheet panel">
              <h3 className="panel-title">{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sheet panel" aria-labelledby="start">
        <h2 id="start" className="panel-title">
          So startest du
        </h2>
        <ol>
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <strong>{title}:</strong> {text}
            </li>
          ))}
        </ol>
      </section>

      <section className="sheet panel" aria-labelledby="faq">
        <h2 id="faq" className="panel-title">
          Häufige Fragen
        </h2>
        {FAQ.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <section className="sheet panel" aria-labelledby="wer">
        <h2 id="wer" className="panel-title">
          Wer hinter Jarvis steht
        </h2>
        <p>
          {OPERATOR.name ? `Jarvis wird von ${OPERATOR.name} entwickelt, ` : "Jarvis wird von "}
          einem Studenten der Pharmazeutischen Wissenschaften an der Universität Basel, zuerst für das eigene Studium.
          {OPERATOR.email && (
            <>
              {" "}
              Fragen und Rückmeldungen an <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
            </>
          )}
        </p>
        <p className="muted">
          Stand: <time dateTime={UPDATED}>{fmtDate(UPDATED)}</time>
        </p>
      </section>
    </>
  );
}
