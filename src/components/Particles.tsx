"use client";

import { useEffect, useRef, useState } from "react";

type P = { x: number; y: number; vy: number; ph: number; r: number; a: number; amber: boolean };

// Feine Partikel mit Netz im Hintergrund (z-index -1: über body::before, unter dem Inhalt und dem Jarvis-Bildschirm)
export function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (reduced || !canvas || !ctx) return;
    let w = 0;
    let h = 0;
    let raf = 0;
    let ps: P[] = [];

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = w < 640 ? 28 : 55;
      ps = Array.from({ length: n }, () => ({
        x: rnd(0, w),
        y: rnd(0, h),
        vy: rnd(0.08, 0.3),
        ph: rnd(0, 6.28),
        r: rnd(0.5, 1),
        a: rnd(0.2, 0.6),
        amber: Math.random() < 0.12,
      }));
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, w, h);
      const pos = ps.map((p) => {
        p.y -= p.vy;
        if (p.y < -4) p.y = h + 4;
        return { p, x: p.x + Math.sin(t / 2500 + p.ph) * 14, y: p.y };
      });
      ctx.lineWidth = 1;
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y);
          if (d < 110) {
            ctx.strokeStyle = `rgba(70, 213, 245, ${0.12 * (1 - d / 110)})`;
            ctx.beginPath();
            ctx.moveTo(pos[i].x, pos[i].y);
            ctx.lineTo(pos[j].x, pos[j].y);
            ctx.stroke();
          }
        }
      }
      for (const { p, x, y } of pos) {
        ctx.fillStyle = p.amber ? `rgba(255, 176, 60, ${p.a})` : `rgba(70, 213, 245, ${p.a})`;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, 6.283);
        ctx.fill();
      }
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };

    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }} />;
}
