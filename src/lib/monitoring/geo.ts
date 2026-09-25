/**
 * Distances à vol d'oiseau (haversine) pour les alertes de zone (PEST_OUTBREAK,
 * rayon par défaut 15 km — SPEC §4).
 */
import type { GeoPoint } from './types';

/** Rayon moyen de la Terre (IUGG), en km. */
export const EARTH_RADIUS_KM = 6371.0088;

export function isValidPoint(p: GeoPoint): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180
  );
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance orthodromique entre deux points, en km. Lève RangeError si un point est invalide. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  if (!isValidPoint(a) || !isValidPoint(b)) throw new RangeError('Coordonnées invalides');
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Parcelles situées à `radiusKm` ou moins du centre (bord inclus), triées par
 * distance croissante. Les parcelles aux coordonnées invalides sont ignorées.
 */
export function parcelsWithinRadius<T extends GeoPoint>(
  center: GeoPoint,
  radiusKm: number,
  parcels: readonly T[],
): Array<T & { distanceKm: number }> {
  if (!isValidPoint(center)) throw new RangeError('Centre invalide');
  if (!Number.isFinite(radiusKm) || radiusKm < 0) throw new RangeError('Rayon invalide');
  const out: Array<T & { distanceKm: number }> = [];
  for (const p of parcels) {
    if (!isValidPoint(p)) continue;
    const distanceKm = haversineKm(center, p);
    if (distanceKm <= radiusKm) out.push({ ...p, distanceKm });
  }
  return out.sort((x, y) => x.distanceKm - y.distanceKm);
}
