/** Données sérialisables passées du serveur à la carte client (dates en ISO/texte déjà formaté). */
export type MapSeverity = "INFO" | "WARNING" | "CRITICAL";
export type MapReportStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export interface AgentMapProps {
  center: [number, number];
  parcels: { id: string; name: string; lat: number; lon: number; communeName: string }[];
  alerts: {
    id: string;
    severity: MapSeverity;
    severityLabel: string;
    title: string;
    lat: number | null;
    lon: number | null;
    radiusKm: number | null;
    place: string | null;
  }[];
  reports: {
    id: string;
    lat: number;
    lon: number;
    communeName: string;
    pestName: string | null;
    status: MapReportStatus;
    statusLabel: string;
    createdAt: string;
  }[];
  labels: { map: string; parcel: string; report: string; unknownPest: string; examine: string; radius: string };
}
