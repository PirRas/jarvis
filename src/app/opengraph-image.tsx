import { ImageResponse } from "next/og";
import { SITE_TITLE } from "@/lib/site";

export const alt = SITE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Vorschaubild für geteilte Links (WhatsApp, Teams, Suchmaschinen), im Stil des Jarvis-HUD.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: "radial-gradient(circle at 25% 50%, #0f2639 0%, #050f1b 60%)",
          color: "#dcf3ff",
        }}
      >
        <div
          style={{
            width: 260,
            height: 260,
            borderRadius: "50%",
            border: "10px solid #46d5f5",
            boxShadow: "0 0 80px #46d5f588, inset 0 0 60px #46d5f555",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 120,
            fontWeight: 700,
            color: "#46d5f5",
          }}
        >
          J
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: 4 }}>JARVIS</div>
          <div style={{ fontSize: 40, marginTop: 16, color: "#98bbd0" }}>Uni-Cockpit fürs Pharmaziestudium</div>
          <div style={{ fontSize: 28, marginTop: 28, color: "#6f93ab" }}>Stundenplan · Prüfungen · KI-Nachbereitung · Quiz</div>
        </div>
      </div>
    ),
    size,
  );
}
