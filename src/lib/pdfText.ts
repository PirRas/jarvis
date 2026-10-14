"use client";

// Liest Folien (PDF) direkt im Browser aus und erkennt die Themen einer Lektion
// anhand der Folientitel: pro Seite die Zeile mit der größten Schrift im oberen Bereich.

export type SlideText = { page: number; title: string; text: string };

type TextItem = { str: string; transform: number[]; height: number };

export async function readPdf(file: File): Promise<SlideText[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: SlideText[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 250); p++) {
    const page = await doc.getPage(p);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = (content.items as TextItem[]).filter((i) => typeof i.str === "string" && i.str.trim());

    // Zeilen bilden: gleiche y-Position (gerundet) gehört zusammen
    const lines = new Map<number, { y: number; size: number; parts: { x: number; s: string }[] }>();
    for (const it of items) {
      const y = Math.round(it.transform[5] / 3) * 3;
      const size = Math.abs(it.transform[3]) || it.height;
      const line = lines.get(y) ?? { y, size: 0, parts: [] };
      line.size = Math.max(line.size, size);
      line.parts.push({ x: it.transform[4], s: it.str });
      lines.set(y, line);
    }
    const sorted = [...lines.values()]
      .map((l) => ({
        ...l,
        s: l.parts
          .sort((a, b) => a.x - b.x)
          .map((x) => x.s)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((l) => l.s)
      .sort((a, b) => b.y - a.y); // oben zuerst

    const text = sorted.map((l) => l.s).join("\n");
    // Titel: größte Schrift in der oberen Hälfte, keine reinen Zahlen
    const top = sorted.filter((l) => l.y > view.height * 0.45 && /[a-zA-ZäöüÄÖÜ]{3}/.test(l.s));
    const maxSize = Math.max(0, ...top.map((l) => l.size));
    const title = top
      .filter((l) => l.size >= maxSize * 0.92)
      .map((l) => l.s)
      .join(" ")
      .slice(0, 120);
    pages.push({ page: p, title, text });
  }
  return pages;
}

/** Themenliste: Folientitel ohne Wiederholungen, Kopf-/Fußzeilen und Allerweltsfolien. */
export function topicsFrom(pages: SlideText[], max = 12): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();
  const counts = new Map<string, number>();
  for (const p of pages) if (p.title) counts.set(norm(p.title), (counts.get(norm(p.title)) ?? 0) + 1);
  const boring =
    /^(inhalt|inhaltsverzeichnis|outline|agenda|übersicht|overview|literatur|references|quellen|fragen|questions|danke|thank you|vielen dank|zusammenfassung|summary|lernziele)$/;

  const out: string[] = [];
  for (const p of pages) {
    const t = p.title.trim();
    if (!t || t.length < 4) continue;
    const n = norm(t);
    if (boring.test(n)) continue;
    // auf vielen Seiten gleich: Kopfzeile oder Vorlesungstitel
    if ((counts.get(n) ?? 0) > Math.max(3, pages.length * 0.3)) continue;
    if (out.some((o) => norm(o) === n || norm(o).startsWith(n) || n.startsWith(norm(o)))) continue;
    out.push(t);
  }
  if (out.length <= max) return out;
  // gleichmäßig über den Foliensatz verteilt auswählen
  return Array.from({ length: max }, (_, i) => out[Math.round((i * (out.length - 1)) / (max - 1))]);
}

/** Folientext für den Prompt, auf eine handliche Länge gekürzt. */
export function textForPrompt(pages: SlideText[], maxChars = 24_000) {
  let out = "";
  for (const p of pages) {
    const chunk = `--- Folie ${p.page} ---\n${p.text}\n`;
    if (out.length + chunk.length > maxChars) {
      out += `\n[… gekürzt, ${pages.length - p.page + 1} weitere Folien]`;
      break;
    }
    out += chunk;
  }
  return out;
}
