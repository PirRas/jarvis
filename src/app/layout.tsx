import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Hanken_Grotesk } from "next/font/google";
import Link from "next/link";
import { HudMark } from "@/components/HudRing";
import { JarvisButton } from "@/components/JarvisButton";
import { MainNav } from "@/components/MainNav";
import { RegisterSW } from "@/components/RegisterSW";
import { SyncBadge } from "@/components/SyncBadge";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./cockpit.css";

const chakra = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-hud", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

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
    <html lang="de" className={`${chakra.variable} ${hanken.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <HudMark />
            Jarvis
          </Link>
          <SyncBadge />
          <MainNav />
        </header>
        <main className="page">{children}</main>
        <JarvisButton />
        <RegisterSW />
      </body>
    </html>
  );
}
