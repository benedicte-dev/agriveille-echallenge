"use client";

import { useSyncExternalStore } from "react";
import { IconHorsLigne } from "@/components/icons";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const getSnapshot = () => navigator.onLine;
/** Rendu serveur : on suppose en ligne (pas de bandeau), pour éviter un faux positif. */
const getServerSnapshot = () => true;

/** Vrai quand le navigateur signale une connexion. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type OfflineBannerProps = {
  /** Mot court, ex. « Hors ligne ». */
  title?: string;
  /** Phrase rassurante, ex. « Vous pouvez continuer. Tout sera envoyé au retour du réseau. » */
  message?: string;
};

/**
 * Bandeau collé en haut quand le réseau tombe. Pictogramme + mot + phrase, fond soleil pâle
 * (information, pas une erreur : l'app continue de marcher). Annoncé via role="status".
 * La région reste montée pour que l'annonce soit lue à l'apparition.
 */
export function OfflineBanner({
  title = "Hors ligne",
  message = "Vous pouvez continuer. Tout sera envoyé au retour du réseau.",
}: OfflineBannerProps) {
  const online = useOnline();
  return (
    <div role="status" className="sticky top-0 z-50">
      {online ? null : (
        <div className="flex items-center gap-3 border-b-2 border-warning bg-warning-soft px-4 py-2.5 text-ink">
          <IconHorsLigne size={24} className="shrink-0 text-warning" />
          <p className="text-base">
            <strong className="font-bold">{title}</strong>
            <span className="text-ink"> · {message}</span>
          </p>
        </div>
      )}
    </div>
  );
}
