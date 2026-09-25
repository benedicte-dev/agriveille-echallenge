"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueueFailure, QueueItem } from "./policy";
import { dismissFailure, failures, flushQueue, pendingItems, startAutoReplay, subscribe } from "./sync";

export interface OfflineQueueState {
  /** false tant que la file n'a pas été lue (rendu serveur / premier rendu). */
  ready: boolean;
  pending: number;
  items: QueueItem[];
  failures: QueueFailure[];
  /** Nombre d'envois partis depuis l'ouverture de la page. */
  sentSinceMount: number;
  flush: () => void;
  dismiss: (id: string) => void;
}

/**
 * État de la file hors ligne, tenu à jour entre onglets et avec le service
 * worker. Installe le rejeu automatique au premier usage.
 */
export function useOfflineQueue(): OfflineQueueState {
  const [state, setState] = useState<{ ready: boolean; items: QueueItem[]; failures: QueueFailure[]; sent: number }>({
    ready: false,
    items: [],
    failures: [],
    sent: 0,
  });

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void Promise.all([pendingItems(), failures()]).then(([items, fails]) => {
        if (alive) setState((s) => ({ ...s, ready: true, items, failures: fails.sort((a, b) => b.at - a.at) }));
      });
    };
    const unsubscribe = subscribe((e) => {
      if (e.type === "sent") setState((s) => ({ ...s, sent: s.sent + 1 }));
      refresh();
    });
    refresh();
    startAutoReplay();
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const flush = useCallback(() => void flushQueue({ force: true }), []);
  const dismiss = useCallback((id: string) => void dismissFailure(id), []);

  return {
    ready: state.ready,
    pending: state.items.length,
    items: state.items,
    failures: state.failures,
    sentSinceMount: state.sent,
    flush,
    dismiss,
  };
}

/**
 * Composant sans rendu à monter dans une coquille (ex. layout /app) pour que
 * la file se vide dès le chargement de n'importe quelle page.
 */
export function OfflineQueueRunner(): null {
  useEffect(() => {
    startAutoReplay();
  }, []);
  return null;
}
