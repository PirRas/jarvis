import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Literata } from "next/font/google";
import Link from "next/link";
import { RegisterSW } from "@/components/RegisterSW";
import { SyncBadge } from "@/components/SyncBadge";
import "katex/dist/katex.min.css";
import "./globals.css";

const literata = Literata({ subsets: ["latin"], variable: "--font-read", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: "Nachbereitung",
  description: "Vorlesungsfolien hochladen, nachbereiten lassen und mit Karteikarten und Quiz für die Prüfung lernen.",
  appleWebApp: { capable: true, title: "Nachbereitung", statusBarStyle: "default" },
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
            Nachbereitung
          </Link>
          <SyncBadge />
          <nav className="topnav">
            <Link href="/">Vorlesungen</Link>
            <Link href="/lernen">Lernen</Link>
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
