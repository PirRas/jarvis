"use client";

import { useState } from "react";

// Fallblattanzeige: jedes Zeichen in einer Kachel, nur geänderte Zeichen klappen (Animation in cockpit.css).

type Flip = { cur: string; prev: string; n: number };

function Tile({ ch }: { ch: string }) {
  const [s, setS] = useState<Flip>({ cur: ch, prev: ch, n: 0 });
  let t = s;
  if (ch !== s.cur) {
    // Zustand beim Rendern nachziehen (React-Muster für abgeleiteten Zustand), erster Render klappt nicht
    t = { cur: ch, prev: s.cur, n: s.n + 1 };
    setS(t);
  }
  return (
    <span className={`sf-tile${t.n ? " sf-on" : ""}`} key={t.n}>
      <span className="sf-h sf-top">
        <span>{t.cur}</span>
      </span>
      <span className="sf-h sf-bot">
        <span>{t.prev}</span>
      </span>
      <span className="sf-h sf-top sf-ft">
        <span>{t.prev}</span>
      </span>
      <span className="sf-h sf-bot sf-fb">
        <span>{t.cur}</span>
      </span>
    </span>
  );
}

export function SplitFlap({ value }: { value: string }) {
  return (
    <span className="sf" role="img" aria-label={value}>
      {Array.from(value).map((c, i) =>
        c === ":" || c === " " ? (
          <span key={i} className="sf-sep" aria-hidden>
            {c === " " ? " " : c}
          </span>
        ) : (
          <span key={i} aria-hidden className="sf-slot">
            <Tile ch={c} />
          </span>
        ),
      )}
    </span>
  );
}
