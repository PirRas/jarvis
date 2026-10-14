// Stapel teilen: Eine Vorlesung (Nachbereitung, Karten, Quiz, Klausuraufgaben, Videos) ohne Lernfortschritt
// wird als JSON verpackt, mit gzip komprimiert und als base64url in den Link geschrieben (/teilen#d=…).
// Ist der Link zu lang, gibt es stattdessen eine Datei (.jarvis.json), die /teilen ebenfalls öffnen kann.

import { z } from "zod";
import { NotesSchema, StudySchema, VideoSchema, type Notes, type Study, type Video } from "./schema";

export const SHARE_VERSION = 1;
/** Längere Links werden von Messengern und Browsern teils abgeschnitten. */
export const SHARE_LINK_LIMIT = 12_000;

const DeckSchema = z.object({
  jarvis: z.literal("stapel"),
  v: z.literal(SHARE_VERSION),
  title: z.string(),
  course: z.string(),
  notes: NotesSchema,
  study: StudySchema,
  videos: z.array(VideoSchema).optional(),
});

export type SharedDeck = z.infer<typeof DeckSchema>;

type LectureLike = { title: string; course: string; notes: Notes; study: Study; videos?: Video[] };

/** Nur der Inhalt, kein Lernfortschritt und keine IDs. */
export function deckFromLecture(l: LectureLike): SharedDeck {
  return {
    jarvis: "stapel",
    v: SHARE_VERSION,
    title: l.title,
    course: l.course,
    notes: l.notes,
    study: l.study,
    ...(l.videos?.length ? { videos: l.videos } : {}),
  };
}

// ---------- base64url ----------

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

// ---------- Verpacken und Entpacken ----------

/** Stapel → kompakter Text für den Link. */
export async function encodeDeck(deck: SharedDeck) {
  const json = new TextEncoder().encode(JSON.stringify(deck));
  return toBase64Url(await pipe(json, new CompressionStream("gzip")));
}

export function shareUrl(origin: string, data: string) {
  return `${origin}/teilen#d=${data}`;
}

export type DecodeResult = { ok: true; deck: SharedDeck } | { ok: false; error: string };

function validate(value: unknown): DecodeResult {
  const r = DeckSchema.safeParse(value);
  if (r.success) return { ok: true, deck: r.data };
  if (value && typeof value === "object" && (value as { jarvis?: unknown }).jarvis !== "stapel")
    return { ok: false, error: "Das ist kein geteilter Jarvis-Stapel." };
  if (value && typeof value === "object" && (value as { v?: unknown }).v !== SHARE_VERSION)
    return { ok: false, error: "Dieser Stapel stammt aus einer anderen Jarvis-Version und kann nicht gelesen werden." };
  return { ok: false, error: "Der Stapel ist unvollständig oder beschädigt." };
}

/** Text aus dem Link → Stapel. */
export async function decodeDeck(data: string): Promise<DecodeResult> {
  const clean = data.trim();
  if (!clean) return { ok: false, error: "Der Link enthält keinen Stapel." };
  if (!/^[A-Za-z0-9_-]+$/.test(clean))
    return { ok: false, error: "Der Link ist beschädigt. Vermutlich wurde er beim Kopieren abgeschnitten." };
  let text: string;
  try {
    text = new TextDecoder().decode(await pipe(fromBase64Url(clean), new DecompressionStream("gzip")));
  } catch {
    return { ok: false, error: "Der Link ist unvollständig. Vermutlich wurde er beim Kopieren abgeschnitten." };
  }
  try {
    return validate(JSON.parse(text));
  } catch {
    return { ok: false, error: "Der Link ist beschädigt." };
  }
}

/** Inhalt einer .jarvis.json-Datei → Stapel. */
export function parseDeckFile(text: string): DecodeResult {
  try {
    return validate(JSON.parse(text));
  } catch {
    return { ok: false, error: "Die Datei ist keine gültige Jarvis-Stapeldatei." };
  }
}

/** Dateiname ohne Sonderzeichen, z. B. "einfuehrung-in-die-chemie.jarvis.json". */
export function deckFileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "stapel"}.jarvis.json`;
}
