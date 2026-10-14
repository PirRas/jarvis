/**
 * Kostenlose, ohne Anmeldung nutzbare Lernvideo-Seiten (überwiegend deutschsprachig).
 * Bewusst nicht enthalten: Abo-Plattformen wie sofatutor oder simpleclub.
 */
export const ALLOWED_SITES = [
  { name: "Studyflix", host: "studyflix.de" },
  { name: "Khan Academy", host: "khanacademy.org" },
  { name: "Serlo", host: "serlo.org" },
  { name: "TIB AV-Portal", host: "av.tib.eu" },
  { name: "Lecture2Go", host: "lecture2go.uni-hamburg.de" },
] as const;

export function allowedSite(host: string) {
  return ALLOWED_SITES.find((s) => host === s.host || host.endsWith(`.${s.host}`));
}
