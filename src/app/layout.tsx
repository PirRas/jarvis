import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import Link from "next/link";
import { JarvisButton } from "@/components/JarvisButton";
import { MainNav } from "@/components/MainNav";
import { RegisterSW } from "@/components/RegisterSW";
import { SyncBadge } from "@/components/SyncBadge";
import { ProfilePill, TopbarClock } from "@/components/TopbarInfo";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./cockpit.css";

const ui = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Jarvis",
  description: "Dein Uni-Cockpit: Stundenplan mit Live-Räumen, Kalender, Prüfungen, Links und Nachbereitung mit Karteikarten und Quiz.",
  appleWebApp: { capable: true, title: "Jarvis", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#111617" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${ui.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="skip-link">Zum Inhalt</a>
        <header className="topbar">
          <Link href="/" className="brand">
            <svg className="brand-mark" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="1" y="5" width="18" height="10" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M10 5h4a5 5 0 0 1 0 10h-4z" fill="currentColor" />
            </svg>
            Jarvis
          </Link>
          <TopbarClock />
          <SyncBadge />
          <ProfilePill />
          <MainNav />
        </header>
        <main id="main" className="page">{children}</main>
        <JarvisButton />
        <RegisterSW />
      </body>
    </html>
  );
}
