"use client";

import { useEffect } from "react";

/**
 * Enregistre /sw.js (fourni par un autre module) s'il existe. Vérifie d'abord sa présence
 * pour ne pas polluer la console en développement. Production uniquement par défaut.
 */
export function ServiceWorkerRegister({ src = "/sw.js", enabledInDev = false }: { src?: string; enabledInDev?: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !enabledInDev) return;
    let cancelled = false;
    const register = async () => {
      try {
        const res = await fetch(src, { method: "HEAD", cache: "no-store" });
        if (!res.ok || cancelled) return;
        await navigator.serviceWorker.register(src, { scope: "/" });
      } catch {
        /* hors ligne au premier chargement ou SW absent : on réessaiera à la prochaine visite */
      }
    };
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, [src, enabledInDev]);
  return null;
}
