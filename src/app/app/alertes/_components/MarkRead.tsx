"use client";

import { useEffect, useRef } from "react";
import { markAlertsReadAction } from "../actions";

/**
 * Marque les livraisons comme lues quand les alertes sont réellement affichées
 * (effet client, pas au préchargement d'un lien). Un seul appel, silencieux
 * en cas d'échec réseau : la lecture sera enregistrée à la prochaine ouverture.
 */
export function MarkRead({ alertIds }: { alertIds: string[] }) {
  const sent = useRef<string | null>(null);
  const key = alertIds.join(",");
  useEffect(() => {
    if (!key || sent.current === key) return;
    sent.current = key;
    markAlertsReadAction(key.split(",")).catch(() => {});
  }, [key]);
  return null;
}
