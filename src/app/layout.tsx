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
import { OPERATOR, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";
import "./cockpit.css";

const chakra = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-hud", display: "swap" });
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-ui", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Jarvis" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["Uni-Cockpit", "Pharmazie", "Pharmaziestudium", "Universität Basel", "Stundenplan", "Nachbereitung", "Karteikarten", "Quiz", "Lernplan", "Studium"],
  category: "education",
  ...(OPERATOR.name ? { authors: [{ name: OPERATOR.name }], creator: OPERATOR.name } : {}),
  openGraph: {
    type: "website",
    locale: "de_CH",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  // Erlaubt Suchmaschinen und KI-Suche lange Textausschnitte und grosse Vorschaubilder (noindex-Seiten bleiben gesperrt, siehe next.config.ts)
  robots: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  formatDetection: { telephone: false },
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
          <Link href="/heute" className="brand">
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
          <footer className="site-footer">
            <Link href="/ueber">Über Jarvis</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/impressum">Impressum</Link>
          </footer>
        </main>
        <JarvisButton />
        <RegisterSW />
        <NativeShell />
      </body>
    </html>
  );
}
