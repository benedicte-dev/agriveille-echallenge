/** Données sérialisables passées du serveur à la carte client. */
export interface AgentMapProps {
  center: [number, number];
  parcels: { id: string; name: string; lat: number; lon: number; communeName: string }[];
  alerts: {
    id: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    severityLabel: string;
    title: string;
    lat: number | null;
    lon: number | null;
    radiusKm: number | null;
    place: string | null;
  }[];
  reports: { id: string; lat: number; lon: number; communeName: string; pestName: string | null; createdAt: string }[];
  labels: { map: string; parcel: string; report: string; unknownPest: string; examine: string; radius: string; loading: string };
}
