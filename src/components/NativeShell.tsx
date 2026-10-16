"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isNativeApp, safeAppPath } from "@/lib/native";

/** Nur in der Android-App: Zurück-Taste und Antippen von Erinnerungen. Auf der Website passiert nichts. */
export function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let off = false;
    const handles: { remove(): Promise<void> }[] = [];
    (async () => {
      const [{ App }, { LocalNotifications }] = await Promise.all([import("@capacitor/app"), import("@capacitor/local-notifications")]);
      const hs = await Promise.all([
        // Zurück-Taste: im Verlauf zurück, auf der ersten Seite die App in den Hintergrund (nicht beenden)
        App.addListener("backButton", ({ canGoBack }) => (canGoBack ? window.history.back() : App.minimizeApp())),
        LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
          router.push(safeAppPath((notification.extra as { url?: unknown } | undefined)?.url));
        }),
      ]);
      if (off) hs.forEach((h) => h.remove());
      else handles.push(...hs);
    })().catch(() => {});
    return () => {
      off = true;
      handles.forEach((h) => h.remove());
    };
  }, [router]);

  return null;
}
