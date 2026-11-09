"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Wer Jarvis schon nutzt (App, installierte Web-App oder Daten auf dem Gerät), kommt von der Infoseite direkt ins Cockpit.
// Das Inline-Skript greift beim ersten Laden vor dem Zeichnen, der Effekt bei Navigation innerhalb der App.
const CHECK = `(function(){try{var s=localStorage;if(s.getItem("jarvis-app")||s.getItem("links-seeded-v1")||window.Capacitor||matchMedia("(display-mode: standalone)").matches)location.replace("/heute"+location.search+location.hash)}catch(e){}})()`;

export function LandingRedirect() {
  const router = useRouter();
  useEffect(() => {
    try {
      if (localStorage.getItem("jarvis-app") || localStorage.getItem("links-seeded-v1")) router.replace("/heute");
    } catch {}
  }, [router]);
  return <script dangerouslySetInnerHTML={{ __html: CHECK }} />;
}
