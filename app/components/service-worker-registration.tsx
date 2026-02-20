"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        void registration.update();
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    }

    void register();
  }, []);

  return null;
}

