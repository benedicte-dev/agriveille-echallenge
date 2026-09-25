import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  WeatherUnavailableError,
  evaluate,
  fetchForecast,
  filterAlreadyActive,
  parseForecast,
  type CandidateAlert,
  type Forecast,
  type WeatherUnavailableReason,
} from "@/lib/monitoring";
import { audit } from "@/lib/security/audit";
import { publishAlert } from "@/server/alerts/deliver";
import {
  FORCE_COOLDOWN_MS,
  MONITORING_CONCURRENCY,
  MONITORING_MAX_PARCELS,
  SNAPSHOT_TTL_MS,
  mapWithConcurrency,
  toActiveRef,
  toPestInput,
  toPlantingInput,
} from "./convert";
import {
  ALERT_TEXT_ROW_SELECT,
  applyTranslations,
  fillMissingTranslations,
  fullyTranslated,
  translateTexts,
  type TextTranslations,
} from "./translate";

/**
 * Orchestration du monitoring (SPEC §4) :
 * Parcel → Open-Meteo → WeatherSnapshot (cache 3 h) → evaluate() → publishAlert().
 *
 * Toutes les fonctions prennent un identifiant déjà autorisé : le contrôle de
 * rôle et de propriété est fait par l'appelant (page, Server Action, cron).
 */

export class ParcelNotFoundError extends Error {
  constructor(parcelId: string) {
    super(`Parcelle introuvable : ${parcelId}`);
    this.name = "ParcelNotFoundError";
  }
}

export type WeatherResult = {
  /** Prévision utilisable (fraîche ou dernier snapshot), null si aucune. */
  forecast: Forecast | null;
  fetchedAt: Date | null;
  /** true si la prévision vient du cache sans appel réseau. */
  fromCache: boolean;
  /** true si Open-Meteo a échoué et qu'on sert un snapshot expiré. */
  stale: boolean;
  /** Raison de l'échec Open-Meteo (log / signalement), absente si succès. */
  error?: WeatherUnavailableReason | "unknown";
};

export interface RefreshOptions {
  /** Ignore le cache 3 h (bouton « Actualiser »), sauf snapshot de moins de 5 min. */
  force?: boolean;
  now?: Date;
  /** Injection pour les tests. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function readPayload(payload: unknown): Forecast | null {
  try {
    return parseForecast(payload);
  } catch {
    return null;
  }
}

/**
 * Renvoie la prévision 7 jours d'une parcelle : snapshot en cache s'il n'a pas
 * expiré, sinon appel Open-Meteo et nouveau snapshot. Si Open-Meteo échoue, le
 * dernier snapshot (même expiré) est renvoyé avec `stale: true`. Ne lève que si
 * la parcelle n'existe pas.
 */
export async function refreshParcel(parcelId: string, opts: RefreshOptions = {}): Promise<WeatherResult> {
  const now = opts.now ?? new Date();
  const parcel = await prisma.parcel.findUnique({ where: { id: parcelId }, select: { id: true, lat: true, lon: true } });
  if (!parcel) throw new ParcelNotFoundError(parcelId);

  const latest = await prisma.weatherSnapshot.findFirst({
    where: { parcelId },
    orderBy: { fetchedAt: "desc" },
    select: { id: true, fetchedAt: true, expiresAt: true, payload: true },
  });
  const cached = latest ? readPayload(latest.payload) : null;

  if (latest && cached) {
    const fresh = latest.expiresAt.getTime() > now.getTime();
    const veryRecent = now.getTime() - latest.fetchedAt.getTime() < FORCE_COOLDOWN_MS;
    if ((fresh && !opts.force) || veryRecent) {
      return { forecast: cached, fetchedAt: latest.fetchedAt, fromCache: true, stale: false };
    }
  }

  try {
    const forecast = await fetchForecast(parcel.lat, parcel.lon, {
      fetchImpl: opts.fetchImpl,
      signal: opts.signal,
      now: () => now,
    });
    await prisma.weatherSnapshot.create({
      data: {
        parcelId,
        fetchedAt: now,
        source: "open-meteo",
        payload: forecast as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
      },
      select: { id: true },
    });
    // Historique borné : on garde 2 jours de snapshots par parcelle.
    await prisma.weatherSnapshot.deleteMany({
      where: { parcelId, fetchedAt: { lt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) } },
    });
    return { forecast, fetchedAt: now, fromCache: false, stale: false };
  } catch (err) {
    const reason = err instanceof WeatherUnavailableError ? err.reason : "unknown";
    console.warn("[monitoring] météo indisponible", { parcelId, reason, message: err instanceof Error ? err.message : String(err) });
    return {
      forecast: cached,
      fetchedAt: cached && latest ? latest.fetchedAt : null,
      fromCache: Boolean(cached),
      stale: Boolean(cached),
      error: reason,
    };
  }
}

/** Délai de traduction par défaut à l'ouverture d'une parcelle (page) : au-delà, repli fr puis rattrapage. */
export const PAGE_TRANSLATE_DEADLINE_MS = 12_000;

export interface AnalyzeResult {
  parcelId: string;
  weather: WeatherResult;
  /** Candidates produites par le moteur (avant filtrage). */
  candidates: number;
  /** Alertes nouvellement créées. */
  created: number;
  /** Candidates écartées : alerte équivalente déjà active ou même dedupKey. */
  skipped: number;
  /** Livraisons IN_APP nouvelles. */
  deliveries: number;
  alertIds: string[];
}

export interface AnalyzeOptions extends RefreshOptions {
  /** Résultat météo déjà obtenu (évite un second aller-retour). */
  weather?: WeatherResult;
  /** Échéance de la traduction groupée fon/yo (défaut 12 s). */
  translateDeadlineMs?: number;
}

/** Résultat de l'évaluation d'une parcelle, avant publication. */
interface ParcelPlan {
  parcel: { id: string; ownerId: string; communeId: string; lat: number; lon: number };
  weather: WeatherResult;
  candidates: number;
  /** Candidates qui ne recouvrent aucune alerte active. */
  fresh: CandidateAlert[];
  recipientIds: string[];
}

/** Météo + règles + filtrage des alertes déjà actives. Aucune écriture d'alerte. */
async function planParcel(parcelId: string, opts: AnalyzeOptions, now: Date): Promise<ParcelPlan> {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: {
      id: true,
      ownerId: true,
      communeId: true,
      lat: true,
      lon: true,
      owner: { select: { role: true, isActive: true } },
      plantings: {
        where: { status: { in: ["PLANNED", "GROWING"] } },
        select: {
          id: true,
          parcelId: true,
          cropId: true,
          status: true,
          sowingDate: true,
          expectedHarvestDate: true,
          crop: { select: { slug: true, nameFr: true, sowingMonths: true } },
        },
        take: 20,
      },
    },
  });
  if (!parcel) throw new ParcelNotFoundError(parcelId);

  const weather = opts.weather ?? (await refreshParcel(parcelId, { ...opts, now }));
  // Un compte désactivé ou non FARMER ne reçoit rien (l'alerte reste visible sur la parcelle).
  const recipientIds = parcel.owner.isActive && parcel.owner.role === "FARMER" ? [parcel.ownerId] : [];
  const base = { id: parcel.id, ownerId: parcel.ownerId, communeId: parcel.communeId, lat: parcel.lat, lon: parcel.lon };
  if (!weather.forecast) return { parcel: base, weather, candidates: 0, fresh: [], recipientIds };

  const cropIds = [...new Set(parcel.plantings.map((p) => p.cropId))];
  const pests =
    cropIds.length === 0
      ? []
      : await prisma.pest.findMany({
          where: { crops: { some: { id: { in: cropIds } } } },
          select: {
            id: true,
            slug: true,
            nameFr: true,
            kind: true,
            riskTempMin: true,
            riskTempMax: true,
            riskHumidityMin: true,
            preventionFr: true,
            crops: { select: { slug: true } },
          },
          take: 100,
        });

  const candidates = evaluate({
    forecast: weather.forecast,
    plantings: parcel.plantings.map(toPlantingInput),
    pests: pests.map(toPestInput),
    today: now,
    parcelIds: [parcel.id],
  });
  if (candidates.length === 0) return { parcel: base, weather, candidates: 0, fresh: [], recipientIds };

  const active = await prisma.alert.findMany({
    where: { parcelId: parcel.id, source: "AUTO_WEATHER", validUntil: { gte: now } },
    select: { type: true, parcelId: true, pestId: true, severity: true, validUntil: true },
    take: 200,
  });
  const fresh = filterAlreadyActive(candidates, active.map(toActiveRef), now);
  return { parcel: base, weather, candidates: candidates.length, fresh, recipientIds };
}

/** Traduit en un lot les textes des candidates dont la dedupKey n'existe pas encore. */
async function pretranslate(plans: ParcelPlan[], deadlineMs: number): Promise<TextTranslations> {
  const all = plans.flatMap((p) => p.fresh);
  if (all.length === 0) return new Map();
  const existing = await prisma.alert.findMany({
    where: { dedupKey: { in: all.map((c) => c.dedupKey) } },
    select: { dedupKey: true },
  });
  const known = new Set(existing.map((e) => e.dedupKey));
  const texts = all.filter((c) => !known.has(c.dedupKey)).flatMap((c) => [c.titleFr, c.messageFr, c.adviceFr]);
  return translateTexts(texts, deadlineMs);
}

async function publishPlan(plan: ParcelPlan, translations: TextTranslations): Promise<AnalyzeResult> {
  const result: AnalyzeResult = {
    parcelId: plan.parcel.id,
    weather: plan.weather,
    candidates: plan.candidates,
    created: 0,
    skipped: plan.candidates - plan.fresh.length,
    deliveries: 0,
    alertIds: [],
  };
  // Séquentiel par parcelle ; les traductions sont déjà en cache, aucune attente réseau ici.
  for (const c of plan.fresh) {
    const complete = fullyTranslated(translations, [c.titleFr, c.messageFr, c.adviceFr]);
    const published = await publishAlert({
      type: c.type,
      severity: c.severity,
      source: "AUTO_WEATHER",
      dedupKey: c.dedupKey,
      titleFr: c.titleFr,
      messageFr: c.messageFr,
      adviceFr: c.adviceFr,
      parcelId: c.parcelId,
      communeId: plan.parcel.communeId,
      lat: plan.parcel.lat,
      lon: plan.parcel.lon,
      pestId: c.pestId ?? null,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      recipientIds: plan.recipientIds,
      // Traductions complètes en cache : publishAlert les relit sans appel API.
      // Sinon pas d'appel unitaire (limite de débit) : repli fr, complété ci-dessous puis au passage suivant.
      translate: complete,
    });
    if (published.created) {
      if (!complete) {
        const row = await prisma.alert.findUnique({ where: { id: published.alertId }, select: ALERT_TEXT_ROW_SELECT });
        if (row) await applyTranslations([row], translations);
      }
      // Trace des chiffres déclencheurs (transparence : affichés au fermier et à l'agent).
      await audit(null, "monitoring.alert.create", "Alert", published.alertId, { dedupKey: c.dedupKey, evidence: c.evidence }, null);
      result.created++;
    } else {
      result.skipped++;
    }
    result.alertIds.push(published.alertId);
    result.deliveries += published.deliveries;
  }
  return result;
}

/**
 * Évalue les règles pour une parcelle et publie les alertes candidates au
 * propriétaire (IN_APP + SMS simulé), traduites fon/yo. Idempotent : relancer
 * ne crée ni alerte ni livraison en double.
 */
export async function analyzeParcel(parcelId: string, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const now = opts.now ?? new Date();
  const deadline = opts.translateDeadlineMs ?? PAGE_TRANSLATE_DEADLINE_MS;
  const plan = await planParcel(parcelId, opts, now);
  const translations = await pretranslate([plan], deadline);
  const result = await publishPlan(plan, translations);
  if (result.created === 0) {
    // Rattrapage des traductions restées en repli sur les alertes actives de ce champ.
    await fillMissingTranslations({ parcelId, deadlineMs: deadline, now, take: 20 }).catch((err: unknown) => {
      console.warn("[monitoring] rattrapage des traductions échoué", { parcelId, error: String(err) });
    });
  }
  return result;
}

export interface MonitoringReport {
  startedAt: string;
  durationMs: number;
  /** Parcelles éligibles (au moins une culture non récoltée). */
  parcels: number;
  analyzed: number;
  alertsCreated: number;
  /** Candidates écartées (doublons ou alerte équivalente déjà active). */
  duplicatesSkipped: number;
  deliveries: number;
  /** Alertes antérieures dont les traductions fon/yo ont été complétées. */
  translationsFilled: number;
  /** Parcelles analysées sur un snapshot expiré (Open-Meteo en panne). */
  staleWeather: number;
  /** Parcelles non analysées faute de toute donnée météo. */
  noWeather: number;
  /** Parcelles non traitées, budget de temps épuisé (reprises au passage suivant). */
  deferred: number;
  errors: Array<{ parcelId: string; reason: string }>;
}

export interface RunOptions {
  communeId?: string;
  limit?: number;
  /** Budget de temps : au-delà, les parcelles restantes ne sont pas commencées. */
  budgetMs?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
}

/** Échéance de traduction quand aucun budget n'est donné (script, agent). */
const DEFAULT_TRANSLATE_DEADLINE_MS = 90_000;

/**
 * Analyse toutes les parcelles ayant une culture non récoltée.
 * 1. météo + règles, concurrence 4 ; 2. une traduction groupée par langue ;
 * 3. publication ; 4. rattrapage des traductions manquantes.
 */
export async function runMonitoring(opts: RunOptions = {}): Promise<MonitoringReport> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? MONITORING_MAX_PARCELS)), MONITORING_MAX_PARCELS);
  const remaining = () =>
    opts.budgetMs === undefined ? DEFAULT_TRANSLATE_DEADLINE_MS : Math.max(0, opts.budgetMs - (Date.now() - started));

  const parcels = await prisma.parcel.findMany({
    where: {
      ...(opts.communeId ? { communeId: opts.communeId } : {}),
      plantings: { some: { status: { in: ["PLANNED", "GROWING"] } } },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const report: MonitoringReport = {
    startedAt: now.toISOString(),
    durationMs: 0,
    parcels: parcels.length,
    analyzed: 0,
    alertsCreated: 0,
    duplicatesSkipped: 0,
    deliveries: 0,
    translationsFilled: 0,
    staleWeather: 0,
    noWeather: 0,
    deferred: 0,
    errors: [],
  };

  // La moitié du budget au plus pour la météo et les règles ; le reste pour traduire et publier.
  const planBudget = opts.budgetMs === undefined ? undefined : opts.budgetMs / 2;
  const planned = await mapWithConcurrency(parcels, MONITORING_CONCURRENCY, async ({ id }) => {
    if (planBudget !== undefined && Date.now() - started > planBudget) return null;
    return planParcel(id, { fetchImpl: opts.fetchImpl }, now);
  });

  const plans: ParcelPlan[] = [];
  planned.forEach((r, i) => {
    const parcelId = parcels[i].id;
    if (!r.ok) {
      console.error("[monitoring] analyse échouée", { parcelId }, r.error);
      report.errors.push({ parcelId, reason: r.error instanceof Error ? r.error.name : "unknown" });
    } else if (r.value === null) {
      report.deferred++;
    } else if (!r.value.weather.forecast) {
      report.noWeather++;
      report.errors.push({ parcelId, reason: `weather:${r.value.weather.error ?? "unknown"}` });
    } else {
      report.analyzed++;
      if (r.value.weather.stale) report.staleWeather++;
      plans.push(r.value);
    }
  });

  let translations: TextTranslations = new Map();
  try {
    translations = await pretranslate(plans, remaining());
  } catch (err) {
    console.error("[monitoring] préparation des traductions échouée", err);
  }

  const published = await mapWithConcurrency(plans, MONITORING_CONCURRENCY, (plan) => publishPlan(plan, translations));
  published.forEach((r, i) => {
    if (!r.ok) {
      const parcelId = plans[i].parcel.id;
      console.error("[monitoring] publication échouée", { parcelId }, r.error);
      report.errors.push({ parcelId, reason: r.error instanceof Error ? r.error.name : "unknown" });
      return;
    }
    report.alertsCreated += r.value.created;
    report.duplicatesSkipped += r.value.skipped;
    report.deliveries += r.value.deliveries;
  });

  try {
    report.translationsFilled = await fillMissingTranslations({ deadlineMs: remaining(), now });
  } catch (err) {
    console.error("[monitoring] rattrapage des traductions échoué", err);
  }

  report.durationMs = Date.now() - started;
  return report;
}
