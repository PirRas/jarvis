import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Chakra_Petch } from "next/font/google";
import Link from "next/link";
import { HudMark } from "@/components/HudRing";
import { JarvisButton } from "@/components/JarvisButton";
import { MainNav } from "@/components/MainNav";
import { NativeShell } from "@/components/NativeShell";
import { Particles } from "@/components/Particles";
import { PageTitleDecode } from "@/components/PageTitleDecode";
import { RegisterSW } from "@/components/RegisterSW";
import { SyncBadge } from "@/components/SyncBadge";
import { ProfilePill, TopbarClock } from "@/components/TopbarInfo";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./cockpit.css";

const chakra = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-hud", display: "swap" });
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-ui", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "Jarvis",
  description: "Dein Uni-Cockpit: Stundenplan mit Live-Räumen, Kalender, Prüfungen, Links und Nachbereitung mit Karteikarten und Quiz.",
  appleWebApp: { capable: true, title: "Jarvis", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050f1b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${chakra.variable} ${atkinson.variable}`}>
      <body>
        <Particles />
        <a href="#main" className="skip-link">
          Zum Inhalt
        </a>
        <header className="topbar">
          <Link href="/" className="brand">
            <HudMark />
            Jarvis
          </Link>
          <TopbarClock />
          <SyncBadge />
          <ProfilePill />
          <MainNav />
        </header>
        <main id="main" className="page">
          <PageTitleDecode>{children}</PageTitleDecode>
        </main>
        <JarvisButton />
        <RegisterSW />
        <NativeShell />
      </body>
    </html>
  );
}
