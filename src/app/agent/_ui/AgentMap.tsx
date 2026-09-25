"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { AgentMapProps } from "./map-types";

/**
 * Carte agent (Leaflet + tuiles OSM). Les couleurs reprennent les tokens de
 * globals.css (Leaflet écrit des attributs SVG : var() n'y est pas résolu).
 * La forme distingue aussi les couches : point plein = parcelle, cercle
 * pointillé épais = signalement, zone translucide = rayon d'alerte.
 */
const COLORS = {
  parcel: "#1e6b3a",
  report: "#8f3f14",
  INFO: "#1d4f80",
  WARNING: "#7a4e00",
  CRITICAL: "#a1241b",
} as const;

export default function AgentMap({ parcels, alerts, reports, center, labels }: AgentMapProps) {
  const points: [number, number][] = [
    ...parcels.map((p) => [p.lat, p.lon] as [number, number]),
    ...reports.map((r) => [r.lat, r.lon] as [number, number]),
    ...alerts.filter((a) => a.lat !== null && a.lon !== null).map((a) => [a.lat!, a.lon!] as [number, number]),
  ];
  const bounds: LatLngBoundsExpression | undefined = points.length > 1 ? points : undefined;

  return (
    <MapContainer
      center={points[0] ?? center}
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
      {alerts.map((a) =>
        a.lat !== null && a.lon !== null ? (
          a.radiusKm ? (
            <Circle
              key={`a-${a.id}`}
              center={[a.lat, a.lon]}
              radius={a.radiusKm * 1000}
              pathOptions={{ color: COLORS[a.severity], weight: 2, fillOpacity: 0.12 }}
            >
              <Popup>
                <strong>{a.severityLabel}</strong> · {a.title}
                <br />
                {a.place ?? ""} · {labels.radius.replace("{count}", String(a.radiusKm))}
              </Popup>
            </Circle>
          ) : (
            <CircleMarker
              key={`a-${a.id}`}
              center={[a.lat, a.lon]}
              radius={10}
              pathOptions={{ color: COLORS[a.severity], weight: 3, fillOpacity: 0.25 }}
            >
              <Popup>
                <strong>{a.severityLabel}</strong> · {a.title}
                <br />
                {a.place ?? ""}
              </Popup>
            </CircleMarker>
          )
        ) : null,
      )}
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
      {reports.map((r) => (
        <CircleMarker
          key={`r-${r.id}`}
          center={[r.lat, r.lon]}
          radius={9}
          pathOptions={{ color: COLORS.report, weight: 4, dashArray: "4 3", fillOpacity: 0.1 }}
        >
          <Popup>
            <strong>{labels.report}</strong> · {r.pestName ?? labels.unknownPest}
            <br />
            {r.communeName} · {r.createdAt}
            <br />
            <a href={`/agent/signalements/${r.id}`}>{labels.examine}</a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
