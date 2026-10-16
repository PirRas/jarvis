"use client";

import { useEffect, useRef, useState } from "react";

/** Zählt beim ersten Anzeigen in ≤ 600 ms von 0 auf den Wert (easeOut); später oder bei reduzierter Bewegung sofort. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done.current = true;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let id = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) id = requestAnimationFrame(step);
      else done.current = true;
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <span className="countup">{shown}</span>;
}
