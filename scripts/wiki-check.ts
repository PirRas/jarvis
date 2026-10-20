// Selbsttest Wikimedia-Bildauswahl: npx tsx scripts/wiki-check.ts
import assert from "node:assert";
import { pickWiki, rejectReason, type WikiCandidate } from "../src/lib/wikiPick";

const plain = (html: string) => html.replace(/<[^>]*>/g, "");

type Opts = { desc?: unknown; cats?: string; artist?: string; width?: number; index?: number; objectName?: string };
function cand(title: string, o: Opts = {}): WikiCandidate {
  const svg = /\.svg$/i.test(title);
  const meta: Record<string, { value: unknown }> = {};
  if (o.desc !== undefined) meta.ImageDescription = { value: o.desc };
  if (o.cats) meta.Categories = { value: o.cats };
  if (o.artist) meta.Artist = { value: o.artist };
  if (o.objectName) meta.ObjectName = { value: o.objectName };
  return {
    index: o.index ?? 0,
    title,
    imageinfo: [
      {
        thumburl: "https://upload.wikimedia.org/thumb/x.png",
        descriptionurl: "https://commons.wikimedia.org/wiki/" + title,
        width: o.width ?? 1200,
        mime: svg ? "image/svg+xml" : "image/png",
        extmetadata: meta,
      },
    ],
  };
}

const reject = (name: string, c: WikiCandidate) =>
  assert.ok(rejectReason(c, plain), `${name}: sollte abgelehnt werden, wurde angenommen`);
const accept = (name: string, c: WikiCandidate) => {
  const r = rejectReason(c, plain);
  assert.equal(r, null, `${name}: sollte angenommen werden, abgelehnt wegen "${r}"`);
};

// Kurdisch
reject("ku: Titel mit ê/û", cand("File:Gavên girjbûna peykeremasûlkeyê.png"));
reject("ku: Dateiname mit (ku)", cand("File:Cross bridge cycle (ku).svg"));
reject("ku: Kategorie", cand("File:Cross bridge cycle.svg", { cats: "Diagrams|Kurdish-language diagrams|SVG files" }));
reject("ku: Beschreibung nur ku", cand("File:Cross bridge cycle.svg", { desc: { ku: "Gavên girjbûna masûlkeyê", _type: "lang" } }));
reject(
  "ku: Kurmanji-Text ohne Sprache",
  cand("File:Cross bridge cycle.svg", { desc: "<p>Gavên girjbûna masûlkeyê bi kalsiyum û ATP, wergerandin ji OpenStax</p>" }),
);

// Arabisch
reject("ar: Titel arabisch", cand("File:ألياف العضلات الهيكلية.png"));
reject("ar: Beschreibung arabisch", cand("File:Excitation contraction coupling.png", { desc: "<p>ألياف العضلات الهيكلية والأنابيب التائية</p>" }));
reject("ar: Beschreibung arabisch (Objekt)", cand("File:Excitation contraction coupling.png", { desc: { ar: "ألياف العضلات", _type: "lang" } }));

// Spanisch: "de" im Titel ist kein Sprachcode, die Beschreibung muss greifen
reject(
  "es: Beschreibung spanisch",
  cand("File:Ciclo de puentes cruzados.svg", { desc: "Ciclo de los puentes cruzados en la contracción muscular" }),
);

// Angenommen
accept("en: Foto mit Objekt-Beschreibung", cand("File:Figure 10 02 03.jpg", { desc: { en: "Skeletal muscle fibre structure", _type: "lang" }, width: 1200 }));
accept("en: SVG ohne Beschreibung", cand("File:Sarcomere diagram.svg"));
accept("de: ü erlaubt", cand("File:Querbrückenzyklus de.svg", { desc: "Der Querbrückenzyklus mit ATP" }));
accept(
  "en: Autor José García",
  cand("File:Muscle fibre.png", { desc: "<p>Skeletal muscle fibre drawn by José García for the lecture on contraction</p>" }),
);

// Grösse
assert.equal(rejectReason(cand("File:Muscle fibre.png", { width: 300 }), plain), "zu klein");
accept("SVG klein", cand("File:Muscle fibre.svg", { width: 300 }));

// Reihenfolge
const photo = cand("File:Muscle photo.jpg", { index: 0 });
const featured = cand("File:Muscle overview.svg", { index: 1, cats: "Featured pictures|Muscles" });
assert.equal(pickWiki([photo, featured], plain), featured, "Featured pictures schlägt Foto auf Index 0");

const openstax = cand("File:Muscle overview.svg", { index: 1, artist: '<a href="https://openstax.org">OpenStax</a>' });
assert.equal(pickWiki([photo, openstax], plain), openstax, "OpenStax schlägt Foto auf Index 0");

const en = cand("File:Muscle cycle.svg", { index: 0 });
const de = cand("File:Muscle cycle de.svg", { index: 1 });
assert.equal(pickWiki([en, de], plain), de, "deutsche Fassung schlägt gleiche englische");

// Alles abgelehnt
const bad = [cand("File:Cross bridge cycle (ku).svg"), cand("File:Muscle small.png", { width: 200 })];
assert.equal(pickWiki(bad, plain), null);
assert.equal(pickWiki([], plain), null);

console.log("wikiPick: alles ok");
