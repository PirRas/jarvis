// HUD-Ring im Stil der Jarvis-Anzeigen: Skala aussen, Cyan-Segmente, ein Bernstein-Bogen, Kern innen.
// Rein dekorativ; der Inhalt in der Mitte (Uhrzeit) kommt als children darüber.
// Animationen (cockpit.css): Hochfahren beim Laden (Klasse is-boot), danach nur langsame Drehungen,
// ein schwacher Radar-Schweif und ein atmender Kern.

const C = "#46d5f5";
const AMBER = "#f2b13d";

/** Umfangsanteil als stroke-dasharray, damit Bögen und Skalen ohne Pfadberechnung auskommen. */
const circ = (r: number) => 2 * Math.PI * r;

export function HudRing({ children, size = 260, boot = false }: { children?: React.ReactNode; size?: number; boot?: boolean }) {
  const ticks = circ(140) / 72;
  const seg = circ(116) / 36;
  const fill = circ(116) * 0.74;
  const amber = circ(97) * 0.2;
  return (
    <div className={`hud-ring${boot ? " is-boot" : ""}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 320 320" aria-hidden focusable="false">
        <defs>
          <radialGradient id="hud-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0f3a52" />
            <stop offset="70%" stopColor="#071a2a" />
            <stop offset="100%" stopColor="#050f1b" />
          </radialGradient>
          <linearGradient id="hud-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C} stopOpacity="0" />
            <stop offset="100%" stopColor={C} stopOpacity="0.28" />
          </linearGradient>
          <filter id="hud-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <mask id="hud-arc" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
            <circle
              className="hud-fill"
              cx="160"
              cy="160"
              r="116"
              fill="none"
              stroke="#fff"
              strokeWidth="20"
              strokeDasharray={`${fill} ${circ(116)}`}
              style={{ "--len": fill } as React.CSSProperties}
              transform="rotate(-60 160 160)"
            />
          </mask>
        </defs>
        <g className="hud-frame">
          <circle cx="160" cy="160" r="152" fill="none" stroke={C} strokeOpacity="0.22" strokeWidth="1" />
          <g className="hud-spin">
            <circle cx="160" cy="160" r="140" fill="none" stroke={C} strokeOpacity="0.55" strokeWidth="7" strokeDasharray={`1.4 ${ticks - 1.4}`} />
            <circle cx="160" cy="160" r="140" fill="none" stroke={C} strokeWidth="11" strokeDasharray={`2.2 ${ticks * 6 - 2.2}`} />
          </g>
        </g>
        {/* Segmentring: schwach als ganzer Kreis, hell auf drei Vierteln (wie eine Füllanzeige) */}
        <circle cx="160" cy="160" r="116" fill="none" stroke={C} strokeOpacity="0.14" strokeWidth="16" strokeDasharray={`${seg - 3} 3`} />
        <g filter="url(#hud-glow)">
          <circle cx="160" cy="160" r="116" fill="none" stroke={C} strokeOpacity="0.75" strokeWidth="16" strokeDasharray={`${seg - 3} 3`} mask="url(#hud-arc)" />
          <circle
            className="hud-amber"
            cx="160"
            cy="160"
            r="97"
            fill="none"
            stroke={AMBER}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${amber} ${circ(97)}`}
            style={{ "--len": amber } as React.CSSProperties}
            transform="rotate(150 160 160)"
          />
        </g>
        <circle className="hud-core" cx="160" cy="160" r="90" fill="url(#hud-core)" stroke={C} strokeOpacity="0.8" strokeWidth="1.5" />
        {/* Radar-Schweif im Kern */}
        <g className="hud-radar">
          <path d="M160 160 L250 160 A90 90 0 0 0 223.6 96.4 Z" fill="url(#hud-sweep)" />
        </g>
        <circle className="hud-counter" cx="160" cy="160" r="82" fill="none" stroke={C} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 5" />
      </svg>
      {children && <div className="hud-ring-center">{children}</div>}
    </div>
  );
}

/** Kleine Marke für die Kopfzeile. */
export function HudMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden focusable="false">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke={C} strokeOpacity="0.5" strokeWidth="1" />
      <circle className="brand-mark-spin" cx="16" cy="16" r="11" fill="none" stroke={C} strokeWidth="3" strokeDasharray="5.2 1.7" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke={AMBER} strokeWidth="1.4" strokeDasharray="10 40" transform="rotate(140 16 16)" />
      <circle cx="16" cy="16" r="3" fill={C} />
    </svg>
  );
}
