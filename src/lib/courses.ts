// Erkennt, wenn verschiedene Schreibweisen dieselbe Lehrveranstaltung meinen,
// z. B. "Allgemeine Chemie (Chemie0), Universität Basel" und "Allgemeine Chemie (Chemie_0), Universität Basel".

/** Kleinbuchstaben, ohne Akzente, ohne Satz- und Leerzeichen. */
export function normalizeCourse(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Kern des Namens: alles vor Klammer, Komma oder Gedankenstrich ("Allgemeine Chemie"). */
function coreOf(name: string) {
  return normalizeCourse(name.split(/[(,–—|]| - /)[0] ?? name);
}

function bigrams(s: string) {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Ähnlichkeit 0–1 (Dice-Koeffizient über Buchstabenpaare). */
function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

/** Nummern im Namen ("Analysis II", "Physik 1"): unterschiedliche Nummern sind unterschiedliche Fächer. */
function numberSignature(name: string) {
  const digits = name.match(/\d+/g) ?? [];
  const roman = name.match(/\b(?:I{1,3}|IV|VI{0,3}|IX|X)\b/g) ?? [];
  return [...digits.map((d) => String(Number(d))), ...roman].join(",");
}

export function sameCourse(a: string, b: string) {
  const na = normalizeCourse(a);
  const nb = normalizeCourse(b);
  if (!na || !nb) return false;
  const sa = numberSignature(a);
  const sb = numberSignature(b);
  if (sa && sb && sa !== sb) return false;
  if (na === nb) return true;
  if (similarity(na, nb) >= 0.88) return true;
  // Gleicher Kern und ein Name ist eine Erweiterung des anderen ("Allgemeine Chemie" vs. "Allgemeine Chemie, Uni Basel")
  const ca = coreOf(a);
  const cb = coreOf(b);
  return ca.length >= 6 && ca === cb && (na.startsWith(nb) || nb.startsWith(na) || similarity(na, nb) >= 0.75);
}

/** Passt einen neuen Fachnamen an einen schon vorhandenen an, falls es dasselbe Fach ist. */
export function matchExistingCourse(name: string, existing: string[]) {
  return existing.find((e) => sameCourse(e, name)) ?? name;
}

export type CourseGroup<T> = { name: string; items: T[] };

/**
 * Fasst Einträge mit gleichem Fach zusammen. Als Gruppenname gilt die häufigste Schreibweise,
 * bei Gleichstand die zuerst verwendete.
 */
export function groupByCourse<T extends { course: string; createdAt: number }>(items: T[]): CourseGroup<T>[] {
  const groups: { names: string[]; items: T[] }[] = [];
  const oldestFirst = [...items].sort((a, b) => a.createdAt - b.createdAt);
  for (const item of oldestFirst) {
    const g = groups.find((g) => g.names.some((n) => sameCourse(n, item.course)));
    if (g) {
      g.items.push(item);
      g.names.push(item.course);
    } else groups.push({ names: [item.course], items: [item] });
  }
  return groups
    .map((g) => {
      const counts = new Map<string, number>();
      for (const n of g.names) counts.set(n, (counts.get(n) ?? 0) + 1);
      const name = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { name, items: g.items.sort((a, b) => b.createdAt - a.createdAt) };
    })
    .sort((a, b) => b.items[0].createdAt - a.items[0].createdAt);
}
