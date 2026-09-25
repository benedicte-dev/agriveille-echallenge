/**
 * Règles pures de l'alerte de zone PEST_OUTBREAK (SPEC §4) : sévérité,
 * textes construits depuis la fiche Pest du CMS, boîte englobante, commune
 * la plus proche. Aucun accès base : testé seul.
 */
import { haversineKm } from "@/lib/monitoring";

/** Au-delà de ce nombre de foyers confirmés proches et récents, l'alerte passe CRITICAL. */
export const OUTBREAK_CRITICAL_COUNT = 3;
/** Voisinage retenu pour compter les foyers du même ravageur (km). */
export const OUTBREAK_CLUSTER_RADIUS_KM = 20;
/** Fenêtre de comptage et durée de validité de l'alerte (jours). */
export const OUTBREAK_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function outbreakWindowStart(now: Date): Date {
  return new Date(now.getTime() - OUTBREAK_WINDOW_DAYS * DAY_MS);
}

export function outbreakValidUntil(now: Date): Date {
  return new Date(now.getTime() + OUTBREAK_WINDOW_DAYS * DAY_MS);
}

export function outbreakDedupKey(reportId: string): string {
  return `PEST_OUTBREAK:${reportId}`;
}

/**
 * `confirmedNearby` : signalements confirmés du même ravageur à moins de
 * 20 km sur 14 jours, **y compris** celui qu'on confirme.
 */
export function outbreakSeverity(confirmedNearby: number): "WARNING" | "CRITICAL" {
  return confirmedNearby >= OUTBREAK_CRITICAL_COUNT ? "CRITICAL" : "WARNING";
}

export interface GeoBox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

/**
 * Boîte englobante d'un cercle (préfiltre SQL indexable), toujours plus large
 * que le cercle ; le filtre exact est fait ensuite par haversine.
 */
export function boundingBox(center: { lat: number; lon: number }, radiusKm: number): GeoBox {
  const dLat = radiusKm / 110.574;
  const cos = Math.cos((center.lat * Math.PI) / 180);
  const dLon = radiusKm / (111.32 * Math.max(cos, 0.01));
  return {
    latMin: center.lat - dLat,
    latMax: center.lat + dLat,
    lonMin: center.lon - dLon,
    lonMax: center.lon + dLon,
  };
}

/** Commune la plus proche d'un point (liste non vide attendue ; null sinon). */
export function nearestCommune<T extends { id: string; lat: number; lon: number }>(
  point: { lat: number; lon: number },
  communes: readonly T[],
): (T & { distanceKm: number }) | null {
  let best: (T & { distanceKm: number }) | null = null;
  for (const c of communes) {
    const d = haversineKm(point, c);
    if (!best || d < best.distanceKm) best = { ...c, distanceKm: d };
  }
  return best;
}

export interface PestSheet {
  nameFr: string;
  kind: "PEST" | "DISEASE";
  symptomsFr: string;
  preventionFr: string;
  treatmentFr: string;
}

export interface OutbreakTexts {
  titleFr: string;
  messageFr: string;
  adviceFr: string;
}

/**
 * Textes de l'alerte (français, traduits ensuite par publishAlert). Le titre et
 * le début du message tiennent dans un SMS ; le détail vient de la fiche CMS.
 */
export function buildOutbreakTexts(
  pest: PestSheet,
  ctx: { communeName: string; radiusKm: number; severity: "WARNING" | "CRITICAL"; confirmedNearby: number },
): OutbreakTexts {
  const what = pest.kind === "DISEASE" ? "Maladie" : "Ravageur";
  const radius = formatKm(ctx.radiusKm);
  const titleFr = `${what} confirmé près de vous : ${pest.nameFr}`;
  const cluster =
    ctx.severity === "CRITICAL"
      ? ` ${ctx.confirmedNearby} foyers confirmés dans la zone en 14 jours.`
      : "";
  const messageFr =
    `Un agent a confirmé un foyer à ${ctx.communeName}, à moins de ${radius} km de vos champs.${cluster} ` +
    `Regardez vos plants. Signes : ${pest.symptomsFr}`;
  const adviceFr = `Pour protéger vos champs : ${pest.preventionFr} Si vous voyez ces signes : ${pest.treatmentFr}`;
  return { titleFr, messageFr, adviceFr };
}

function formatKm(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toFixed(1).replace(".", ",");
}
