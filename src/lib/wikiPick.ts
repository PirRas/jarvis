// Auswahl eines Wikimedia-Commons-Bildes für `wiki:`-Bilder in Nachbereitungen (Anzeige in Diagram.tsx).
// Gilt für jede Nachbereitung, egal ob mit Gemini in der App oder über claude.ai erstellt: Die KI nennt nur
// den Suchbegriff, welches Bild erscheint, entscheidet allein diese Datei.
// Nur Bilder mit deutscher oder englischer (oder gar keiner) Beschriftung; lieber kein Bild als ein falsches.

type Meta = Record<string, { value?: unknown } | undefined>;
export type WikiCandidate = {
  index: number;
  title: string;
  imageinfo?: { thumburl: string; descriptionurl: string; width?: number; mime?: string; extmetadata?: Meta }[];
};

const ALLOWED_LANGS = /^(en|de|en-.*|de-.*|mul|zxx|und)$/i;
// Andere Schrift als Latein (Arabisch, Kyrillisch, Griechisch, Hebräisch, CJK, indische Schriften …)
const NON_LATIN = /[Ͱ-ϿЀ-ԯ԰-֏֐-׿؀-ۿ܀-ࣿऀ-෿฀-໿Ⴀ-ჿᄀ-ᇿ぀-ヿ㐀-鿿가-힯]/;
// Lateinische Buchstaben, die es weder im Deutschen noch im Englischen gibt (ê î û ş ç ñ ł …)
const FOREIGN_LETTER = /[À-ÃÅ-ÏÑ-ÕØ-ÛÝÞà-ãå-ïñ-õø-ûýþÿĀ-ɏ]/;
const LANG_CODE =
  /[ _(-](ar|fa|ku|ckb|kmr|ur|zh|ja|ko|ru|uk|be|bg|mk|sr|hr|bs|sl|cs|sk|pl|hu|ro|el|he|tr|az|ka|hy|hi|bn|ta|th|vi|id|ms|nl|es|fr|it|pt|ca|eu|gl|sv|da|no|nb|nn|fi|et|lt|lv|is|ga|cy|sq)\)?$/i;
const LANG_NAME =
  /\b(arabic|persian|farsi|kurdish|kurmanji|sorani|urdu|turkish|hebrew|chinese|japanese|korean|russian|ukrainian|bulgarian|serbian|croatian|bosnian|slovenian|czech|slovak|polish|hungarian|romanian|greek|hindi|bengali|tamil|thai|vietnamese|indonesian|malay|dutch|nederlands|spanish|español|espanol|french|français|francais|italian|italiano|portuguese|português|catalan|basque|galician|swedish|danish|norwegian|finnish|estonian|lithuanian|latvian|icelandic|irish|welsh|albanian|esperanto)\b/i;
// Typische kurze Wörter: Ein längerer Beschreibungstext ohne eines davon ist in einer anderen Sprache
const EN_DE_WORDS =
  /\b(the|of|and|in|with|from|for|is|showing|diagram|der|die|das|und|mit|von|im|des|ein|eine|zur|zum|schema)\b/i;
// Bewährte Quellen für fachlich korrekte Lehrbuch-Schemata
const TRUSTED = /openstax|blausen|bruceblaus|servier|ladyofhats|mariana ruiz|gray'?s anatomy|nih|national institutes|cdc|wellcome|smart servier|thomas shafee|jmarchn|boumphreyfr/i;
const EXPLAINS = /diagram|schem|label|anatomy|structure|cycle|cross.?section|overview|model|process|mechanism|pathway/i;

// Mehrsprachige Felder (Artist, ObjectName …) kommen als {en: …, de: …}: dann alle Fassungen
const text = (v: unknown): string =>
  typeof v === "string" ? v : v && typeof v === "object" ? Object.values(v).filter((x) => typeof x === "string").join(" ") : "";

/** Sprachen der Beschreibung: bei mehrsprachiger Abfrage ein Objekt {de: …, en: …, ku: …}. */
function descLangs(v: unknown): { langs: string[]; texts: string[] } {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const langs = Object.keys(o).filter((k) => k !== "_type");
    return { langs, texts: langs.map((k) => text(o[k])) };
  }
  return { langs: [], texts: [text(v)] };
}

// Wörter im Suchbegriff, die nichts über den Inhalt sagen
const FILLER = /^(diagram|diagrams|schema|schematic|scheme|illustration|labeled|labelled|image|picture|photo|of|the|and|in|an?|with|der|die|das|und)$/;

/** Inhaltswörter des Suchbegriffs: "single channel recording diagram" → single, channel, recording. */
export const termWords = (term: string) =>
  term.toLowerCase().split(/[^a-z0-9äöüß]+/).filter((w) => w.length > 1 && !FILLER.test(w));

/** Wie viele Inhaltswörter im Text vorkommen (Plural egal: "channels" zählt für "channel"). */
const hits = (words: string[], hay: string) => words.filter((w) => hay.toLowerCase().includes(w.replace(/e?s$/, ""))).length;

/** Titel, Beschreibung und Kategorien als Text, um zu prüfen, ob das Bild das Gesuchte zeigt. */
function about(p: WikiCandidate, plain: (html: string) => string) {
  const m = p.imageinfo?.[0]?.extmetadata ?? {};
  const name = p.title.replace(/^File:|^Datei:/i, "").replace(/\.[a-z0-9]+$/i, "");
  // Buchscans (archive.org) tragen den ganzen OCR-Text als Beschreibung und träfen sonst jeden Begriff: nur der Anfang zählt
  const desc = descLangs(m.ImageDescription?.value).texts.map((t) => plain(t).slice(0, 300));
  return { name, all: [name, plain(text(m.ObjectName?.value)), ...desc, text(m.Categories?.value)].join(" ") };
}

/** Grund, warum das Bild nicht passt, sonst null. plain wandelt HTML in Text (Browser: DOMParser). */
export function rejectReason(p: WikiCandidate, plain: (html: string) => string): string | null {
  const info = p.imageinfo?.[0];
  if (!info) return "keine Bildinfo";
  const m = info.extmetadata ?? {};
  const name = p.title.replace(/^File:|^Datei:/i, "").replace(/\.[a-z0-9]+$/i, "");
  // Mehrsprachiger Titel: nur die deutsche/englische Fassung prüfen, falls vorhanden
  const on = m.ObjectName?.value as Record<string, unknown> | string | undefined;
  const objectName = plain(on && typeof on === "object" && (on.en || on.de) ? text(on.de) + " " + text(on.en) : text(on));
  const cats = text(m.Categories?.value);

  for (const s of [name, objectName]) {
    if (NON_LATIN.test(s)) return "fremde Schrift im Titel";
    if (FOREIGN_LETTER.test(s)) return "fremdsprachiger Titel";
    if (LANG_CODE.test(s) || LANG_NAME.test(s)) return "Titel nennt andere Sprache";
  }
  // Commons-Kategorien wie "Kurdish-language diagrams", "SVG diagrams in Arabic", "Images with Persian text"
  for (const c of cats.split("|")) {
    const lang = /([A-Za-z]+)[- ]language/i.exec(c)?.[1] ?? /\b(?:in|with) ([A-Z][a-z]+)(?: text| labels?)?$/.exec(c)?.[1];
    if (lang && LANG_NAME.test(lang)) return `Kategorie ${c}`;
  }

  const { langs, texts } = descLangs(m.ImageDescription?.value);
  if (langs.length && !langs.some((l) => ALLOWED_LANGS.test(l))) return `Beschreibung nur auf ${langs.join(", ")}`;
  if (!langs.length) {
    const d = plain(texts[0]);
    const letters = d.replace(/[^\p{L}]/gu, "");
    const nonLatin = letters.replace(/[^Ͱ-ԯ֐-ࣿऀ-໿Ⴀ-ᇿ぀-ヿ㐀-鿿가-힯]/g, "");
    if (letters.length && nonLatin.length / letters.length > 0.2) return "Beschreibung in fremder Schrift";
    if (d.split(/\s+/).length >= 6 && !EN_DE_WORDS.test(d)) return "Beschreibung weder deutsch noch englisch";
  }

  // Zu kleine Rastergrafiken sind auf dem Handy unleserlich (SVG skaliert beliebig)
  if (info.mime !== "image/svg+xml" && (info.width ?? 0) < 500) return "zu klein";
  return null;
}

/** Punkte: erklärendes, beschriftetes Schema aus guter Quelle in hoher Qualität, deutsch vor englisch. */
export function score(p: WikiCandidate, plain: (html: string) => string): number {
  const info = p.imageinfo?.[0];
  const m = info?.extmetadata ?? {};
  const cats = text(m.Categories?.value);
  const credit = plain(text(m.Artist?.value)) + " " + plain(text(m.Credit?.value));
  const { langs } = descLangs(m.ImageDescription?.value);
  return (
    (/\.svg$/i.test(p.title) ? 2 : 0) +
    (EXPLAINS.test(p.title) ? 2 : 0) +
    (/label/i.test(p.title + cats) ? 1 : 0) +
    (/featured pictures|quality images|valued images/i.test(cats) ? 3 : 0) +
    (TRUSTED.test(credit + " " + cats) ? 2 : 0) +
    (/german[- ]language|[ _(-]de\)?$/i.test(cats + " " + p.title.replace(/\.[a-z0-9]+$/i, "")) || langs.includes("de") ? 1 : 0) +
    Math.min((info?.width ?? 0) / 1000, 1) -
    p.index * 0.3
  );
}

/**
 * Bestes passendes Bild oder null. Commons durchsucht den ganzen Seitentext, daher trifft "single channel recording"
 * auch ein Foto eines «Data Recording Room»: Bild nur, wenn die meisten Inhaltswörter des Begriffs darin vorkommen.
 */
export function pickWiki(pages: WikiCandidate[], plain: (html: string) => string, term = ""): WikiCandidate | null {
  const words = termWords(term);
  const need = Math.ceil((words.length * 2) / 3);
  const titleHits = (p: WikiCandidate) => hits(words, about(p, plain).name);
  return (
    pages
      .filter((p) => !rejectReason(p, plain) && hits(words, about(p, plain).all) >= need)
      .sort((x, y) => score(y, plain) + titleHits(y) - score(x, plain) - titleHits(x))[0] ?? null
  );
}
