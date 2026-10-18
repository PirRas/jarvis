// Selbsttest PK-Rechner: npx tsx scripts/pk-check.ts
import assert from "node:assert/strict";
import { plain } from "../src/lib/pharma/literature";
import { pkCurve, pkSteadyState } from "../src/lib/pharma/pk";

const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

// τ = t½ → Kumulationsfaktor 2, Cmax = 2 · D/Vd, Cmin = D/Vd
const p = { dose: 500, tau: 6, tHalf: 6, vd: 50, f: 1 };
const s = pkSteadyState(p);
near(s.r, 2);
near(s.cMax, 20);
near(s.cMin, 10);
near(s.cl, (Math.LN2 / 6) * 50);
near(s.cAvg, 500 / (s.cl * 6));
assert.ok(s.cMin < s.cAvg && s.cAvg < s.cMax);

// Kurve nähert sich nach vielen Gaben dem Steady State
const c = pkCurve(p, 20);
near(c.at(-1)!.c, s.cMin, 1e-4); // Tal vor der 21. Gabe
near(c.at(-31)!.c, s.cMax, 1e-4); // Spitze nach der 20. Gabe
near(c[0].c, 10); // erste Gabe: D/Vd

assert.throws(() => pkSteadyState({ ...p, f: 0 }));
assert.throws(() => pkSteadyState({ ...p, vd: -1 }));
// Literatur: HTML-Reste in Titeln von Europe PMC
assert.equal(plain("Seeds of &lt;i&gt;Brassica nigra&lt;/i&gt; &amp; sprouts"), "Seeds of Brassica nigra & sprouts");
console.log("pk-check ok");
