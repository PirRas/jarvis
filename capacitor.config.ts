import type { CapacitorConfig } from "@capacitor/cli";

// Android-App: lädt die Vercel-Seite in einer WebView mit nativen Erweiterungen (Sprache, Erinnerungen, Teilen).
// So bleibt es eine Codebasis; Änderungen an der Website sind ohne neue APK sofort in der App. Anleitung: ANDROID.md.
// Für Tests gegen eine Vorschau: JARVIS_APP_URL=https://… npx cap sync android
const url = process.env.JARVIS_APP_URL ?? "https://nachbereitung.vercel.app";
if (!url.startsWith("https://")) throw new Error("JARVIS_APP_URL muss mit https:// beginnen.");

const config: CapacitorConfig = {
  appId: "ch.jarvis.app",
  appName: "Jarvis",
  // Nur Platzhalter + Offline-Seite; die eigentliche App kommt von `server.url`.
  webDir: "android-shell",
  server: {
    url,
    // Ohne Netz beim ersten Start: lokale Seite mit «Erneut versuchen» (danach hilft der Service Worker).
    errorPath: "offline.html",
  },
  android: {
    // Nur https, keine fremden Seiten mit Zugriff auf die nativen Funktionen (andere Hosts öffnen im Browser).
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    appendUserAgent: "JarvisAndroid",
    // Ältere WebViews spritzen die Brücke anders ein (auch in fremde iframes, ohne CSP-Header): dann Hinweisseite statt App.
    minWebViewVersion: 100,
  },
  plugins: {
    SystemBars: { style: "DARK", insetsHandling: "css", initialViewportFitValueHint: "cover" },
    LocalNotifications: { smallIcon: "ic_stat_jarvis", iconColor: "#46d5f5" },
  },
};

export default config;
