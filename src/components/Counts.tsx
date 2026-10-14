import type { Counts as CountsT } from "@/lib/srs";

/** Ankis Dreiklang: Neu (blau), Lernen (rot), Fällig (grün). */
export function Counts({ counts, bare = false }: { counts: CountsT; bare?: boolean }) {
  const items = [
    { n: counts.new, cls: "c-new", label: "neu" },
    { n: counts.learning, cls: "c-learn", label: "in Lernphase" },
    { n: counts.review, cls: "c-review", label: "fällig" },
  ];
  const inner = items.map((i) => (
    <span key={i.cls} className={i.n ? i.cls : "c-zero"} title={`${i.n} ${i.label}`}>
      {i.n}
      <span className="sr-only"> {i.label}</span>
    </span>
  ));
  return bare ? <>{inner}</> : <span className="counts">{inner}</span>;
}
