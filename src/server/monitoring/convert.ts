/**
 * Conversions pures entre les lignes Prisma et les types du moteur de règles
 * (`@/lib/monitoring`). Aucun accès base ici : testable seul.
 */
import type { ActiveAlertRef, PestInput, PlantingInput, Severity } from "@/lib/monitoring";

/** Durée de vie d'un snapshot météo (SPEC §4 : cache 3 h). */
export const SNAPSHOT_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * « Actualiser » forcé : si le dernier snapshot a moins de 5 minutes, on le
 * réutilise. Évite qu'un appui répété martèle Open-Meteo (service gratuit).
 */
export const FORCE_COOLDOWN_MS = 5 * 60 * 1000;

/** Concurrence maximale du monitoring global (Open-Meteo + 229langues). */
export const MONITORING_CONCURRENCY = 4;

/** Nombre maximal de parcelles traitées par un passage (liste bornée). */
export const MONITORING_MAX_PARCELS = 500;

export interface PlantingRow {
  id: string;
  parcelId: string;
  status: "PLANNED" | "GROWING" | "HARVESTED";
  sowingDate: Date;
  expectedHarvestDate: Date;
  crop: { slug: string; nameFr: string; sowingMonths: number[] };
}

export function toPlantingInput(row: PlantingRow): PlantingInput {
  return {
    plantingId: row.id,
    parcelId: row.parcelId,
    cropSlug: row.crop.slug,
    cropName: row.crop.nameFr,
    status: row.status,
    sowingDate: row.sowingDate,
    expectedHarvestDate: row.expectedHarvestDate,
    sowingMonths: row.crop.sowingMonths,
  };
}

export interface PestRow {
  id: string;
  slug: string;
  nameFr: string;
  kind: "PEST" | "DISEASE";
  riskTempMin: number | null;
  riskTempMax: number | null;
  riskHumidityMin: number | null;
  preventionFr: string | null;
  crops: { slug: string }[];
}

export function toPestInput(row: PestRow): PestInput {
  return {
    pestId: row.id,
    slug: row.slug,
    nameFr: row.nameFr,
    kind: row.kind,
    cropSlugs: row.crops.map((c) => c.slug),
    riskTempMin: row.riskTempMin,
    riskTempMax: row.riskTempMax,
    riskHumidityMin: row.riskHumidityMin,
    preventionFr: row.preventionFr,
  };
}

export interface ActiveAlertRow {
  type: string;
  parcelId: string | null;
  pestId: string | null;
  severity: Severity;
  validUntil: Date;
}

export function toActiveRef(row: ActiveAlertRow): ActiveAlertRef {
  return {
    type: row.type,
    parcelId: row.parcelId,
    pestId: row.pestId,
    severity: row.severity,
    validUntil: row.validUntil,
  };
}

/**
 * Exécute `fn` sur chaque élément avec au plus `limit` appels simultanés.
 * L'ordre des résultats suit l'ordre d'entrée. Une erreur de `fn` n'arrête pas
 * les autres : elle est renvoyée dans le résultat.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const size = Math.max(1, Math.floor(limit));
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await fn(items[i], i) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}
