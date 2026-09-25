"use client";

import dynamic from "next/dynamic";
import { LoadingBlock } from "@/components/ui";
import type { AgentMapProps } from "./map-types";

/** Leaflet touche `window` : chargé seulement côté client (ssr: false), et seulement sur /agent. */
const AgentMap = dynamic(() => import("./AgentMap"), {
  ssr: false,
  loading: () => <LoadingBlock shape="cards" count={1} className="h-[420px]" />,
});

export function AgentMapLoader(props: AgentMapProps) {
  return <AgentMap {...props} />;
}
