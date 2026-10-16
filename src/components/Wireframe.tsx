"use client";

import { useEffect, useRef } from "react";

// Paracetamol (ohne H), grobe 3D-Koordinaten in Å: [Element, x, y, z]
const ATOMS: [string, number, number, number][] = [
  ["C", 1.4, 0, 0],
  ["C", 0.7, 1.21, 0.1],
  ["C", -0.7, 1.21, -0.1],
  ["C", -1.4, 0, 0],
  ["C", -0.7, -1.21, 0.1],
  ["C", 0.7, -1.21, -0.1],
  ["O", 2.75, 0, 0.2],
  ["N", -2.75, 0.1, 0.3],
  ["C", -3.7, -0.9, 0.9],
  ["O", -3.4, -2.1, 1.3],
  ["C", -5.1, -0.4, 0.8],
];
const BONDS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [3, 7], [7, 8], [8, 9], [8, 10]];
const FILL: Record<string, string> = { C: "var(--royal)", O: "var(--amber)", N: "#9be8fb" };
// Schwerpunkt, damit das Molekül mittig dreht
const CX = ATOMS.reduce((s, a) => s + a[1], 0) / ATOMS.length;
const CY = ATOMS.reduce((s, a) => s + a[2], 0) / ATOMS.length;
const R = 4.2; // grösster Abstand vom Schwerpunkt (Å), für Tiefe und Massstab
const D = 12; // Kameraabstand
const K = 80 / R; // Å → viewBox-Einheiten, Molekül füllt ca. 80 % des Rahmens

/** Langsam drehendes Drahtgitter-Molekül als Deko. Grösse per CSS auf dem SVG. */
export function Wireframe({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const lines = svg.querySelectorAll("line");
    const dots = svg.querySelectorAll("circle");
    // Fast flaches Molekül: in der Ebene drehen und nur sanft kippen, sonst steht es zeitweise hochkant als Strich.
    const draw = (a: number) => {
      const rx = 0.45 + 0.25 * Math.sin(a * 0.7), ry = 0.5 * Math.sin(a * 1.3);
      const cz = Math.cos(a), sz = Math.sin(a), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
      const p = ATOMS.map(([, x0, y0, z0]) => {
        const x1 = (x0 - CX) * cz - (y0 - CY) * sz;
        const y1 = (x0 - CX) * sz + (y0 - CY) * cz;
        const y2 = y1 * cx - z0 * sx;
        const z2 = y1 * sx + z0 * cx;
        const x = x1 * cy + z2 * sy;
        const z = -x1 * sy + z2 * cy;
        const s = D / (D - z);
        return { x: 100 + x * s * K, y: 100 + y2 * s * K, s, o: Math.min(1, Math.max(0.25, 0.7 + z / (2 * R))) };
      });
      BONDS.forEach(([i, j], k) => {
        const l = lines[k], u = p[i], v = p[j];
        l.setAttribute("x1", u.x.toFixed(1));
        l.setAttribute("y1", u.y.toFixed(1));
        l.setAttribute("x2", v.x.toFixed(1));
        l.setAttribute("y2", v.y.toFixed(1));
        const s = (u.s + v.s) / 2, o = (u.o + v.o) / 2;
        l.setAttribute("stroke-width", (1.4 * s).toFixed(2));
        l.setAttribute("opacity", o.toFixed(2));
      });
      p.forEach((q, i) => {
        const c = dots[i];
        c.setAttribute("cx", q.x.toFixed(1));
        c.setAttribute("cy", q.y.toFixed(1));
        c.setAttribute("r", (3.2 * q.s).toFixed(2));
        c.setAttribute("opacity", q.o.toFixed(2));
      });
    };

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0.8);
      return;
    }
    let raf = 0, last = 0, angle = 0.8, visible = true;
    const frame = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      angle += last ? Math.min(t - last, 100) * 0.0004 : 0;
      last = t;
      draw(angle);
      raf = requestAnimationFrame(frame);
    };
    const go = () => {
      if (raf || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      go();
    });
    io.observe(svg);
    document.addEventListener("visibilitychange", go);
    draw(angle);
    go();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", go);
    };
  }, []);

  return (
    <svg ref={ref} className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false" style={{ overflow: "visible", filter: "drop-shadow(0 0 4px rgba(70, 213, 245, 0.6))" }}>
      {BONDS.map(([i, j]) => (
        <line key={`${i}-${j}`} stroke="var(--royal)" strokeLinecap="round" />
      ))}
      {ATOMS.map(([el], i) => (
        <circle key={i} fill="none" stroke={FILL[el]} strokeWidth="1.5" />
      ))}
    </svg>
  );
}
