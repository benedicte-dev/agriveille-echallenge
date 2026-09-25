"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { AgentMapProps, MapReportStatus } from "./map-types";

/**
 * Carte agent (Leaflet + tuiles OSM), centrée sur le Bénin. Couleurs = tokens
 * de globals.css en dur (Leaflet écrit des attributs SVG : var() n'y est pas
 * résolu). La forme distingue aussi les couches (la couleur n'est jamais
 * seule) : point plein = parcelle, anneau épais = signalement (pointillé si en
 * attente), zone translucide = rayon d'alerte. Le tableau sous la carte porte
 * les mêmes données pour le clavier et les lecteurs d'écran.
 */
const COLORS = {
  parcel: "#1e6b3a",
  INFO: "#1d4f80",
  WARNING: "#7a4e00",
  CRITICAL: "#a1241b",
} as const;

const REPORT_STYLE: Record<MapReportStatus, { color: string; dashArray?: string }> = {
  PENDING: { color: "#8f3f14", dashArray: "4 3" },
  CONFIRMED: { color: "#a1241b" },
  REJECTED: { color: "#5b5146", dashArray: "1 4" },
};

export default function AgentMap({ parcels, alerts, reports, center, labels }: AgentMapProps) {
  const points: [number, number][] = [
    ...parcels.map((p) => [p.lat, p.lon] as [number, number]),
    ...reports.map((r) => [r.lat, r.lon] as [number, number]),
    ...alerts.flatMap((a) => (a.lat !== null && a.lon !== null ? [[a.lat, a.lon] as [number, number]] : [])),
  ];
  const bounds: LatLngBoundsExpression | undefined = points.length > 1 ? points : undefined;

  return (
    <MapContainer
      center={center}
      zoom={7}
      bounds={bounds}
      boundsOptions={{ padding: [24, 24], maxZoom: 11 }}
      scrollWheelZoom={false}
      className="h-[420px] w-full rounded-lg border-2 border-line-strong"
      aria-label={labels.map}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        subdomains={["a", "b", "c"]}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={18}
      />
      {alerts.map((a) => {
        if (a.lat === null || a.lon === null) return null;
        const popup = (
          <Popup>
            <strong>{a.severityLabel}</strong> · {a.title}
            <br />
            {a.place ?? ""}
            {a.radiusKm ? ` · ${labels.radius.replace("{count}", String(a.radiusKm))}` : ""}
          </Popup>
        );
        return a.radiusKm ? (
          <Circle
            key={`a-${a.id}`}
            center={[a.lat, a.lon]}
            radius={a.radiusKm * 1000}
            pathOptions={{ color: COLORS[a.severity], weight: 2, fillOpacity: 0.12 }}
          >
            {popup}
          </Circle>
        ) : (
          <CircleMarker key={`a-${a.id}`} center={[a.lat, a.lon]} radius={10} pathOptions={{ color: COLORS[a.severity], weight: 3, fillOpacity: 0.25 }}>
            {popup}
          </CircleMarker>
        );
      })}
      {parcels.map((p) => (
        <CircleMarker
          key={`p-${p.id}`}
          center={[p.lat, p.lon]}
          radius={5}
          pathOptions={{ color: "#ffffff", weight: 1, fillColor: COLORS.parcel, fillOpacity: 1 }}
        >
          <Popup>
            <strong>{labels.parcel}</strong> · {p.name}
            <br />
            {p.communeName}
          </Popup>
        </CircleMarker>
      ))}
      {reports.map((r) => {
        const style = REPORT_STYLE[r.status];
        return (
          <CircleMarker
            key={`r-${r.id}`}
            center={[r.lat, r.lon]}
            radius={9}
            pathOptions={{ color: style.color, dashArray: style.dashArray, weight: 4, fillOpacity: 0.1 }}
          >
            <Popup>
              <strong>{labels.report}</strong> · {r.pestName ?? labels.unknownPest}
              <br />
              {r.statusLabel} · {r.communeName} · {r.createdAt}
              <br />
              <a href={`/agent/signalements/${r.id}`}>{labels.examine}</a>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
