import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Literata } from "next/font/google";
import Link from "next/link";
import { RegisterSW } from "@/components/RegisterSW";
import { SyncBadge } from "@/components/SyncBadge";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./cockpit.css";

const literata = Literata({ subsets: ["latin"], variable: "--font-read", display: "swap" });
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2150" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${literata.variable} ${hanken.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden />
            Jarvis
          </Link>
          <SyncBadge />
          <nav className="topnav">
            <Link href="/">Heute</Link>
            <Link href="/stundenplan">Stundenplan</Link>
            <Link href="/kalender">Kalender</Link>
            <Link href="/vorlesungen">Vorlesungen</Link>
            <Link href="/lernen">Lernen</Link>
            <Link href="/links">Links</Link>
            <Link href="/karten">Karten</Link>
            <Link href="/statistik">Statistik</Link>
            <Link href="/konto">Konto</Link>
          </nav>
        </header>
        <main className="page">{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
