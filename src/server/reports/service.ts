import "server-only";

import { Prisma, type AlertSeverity, type PestKind, type ReportStatus, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/security/audit";
import { limitScope } from "@/lib/security/rate-limit";
import { detectImageMime, MAX_STORED_PHOTO_BYTES, MAX_UPLOAD_BYTES, readImageFile } from "@/lib/security/image";
import { fieldErrorsOf } from "@/lib/validation";
import { haversineKm, parcelsWithinRadius } from "@/lib/monitoring";
import { publishAlert } from "@/server/alerts/deliver";
import { ReportError } from "./errors";
import {
  DEFAULT_OUTBREAK_RADIUS_KM,
  createReportSchema,
  hasEvidence,
  listReportsSchema,
  reportIdSchema,
  reviewReportSchema,
  type CreateReportInput,
  type ListReportsInput,
  type ReviewReportInput,
} from "./schemas";
import {
  OUTBREAK_CLUSTER_RADIUS_KM,
  boundingBox,
  buildOutbreakTexts,
  nearestCommune,
  outbreakDedupKey,
  outbreakSeverity,
  outbreakValidUntil,
  outbreakWindowStart,
} from "./outbreak";

/**
 * Service de signalements phytosanitaires (séquence docs/uml/04).
 * Chaque fonction reçoit l'acteur déjà authentifié par l'appelant et refait
 * elle-même le contrôle de rôle et de propriété : aucun appelant n'est cru
 * sur parole.
 */
export interface ReportActor {
  id: string;
  role: Role;
}

export interface ServiceOptions {
  /** IP pour l'audit ; `undefined` = lue depuis la requête courante. */
  ip?: string | null;
  now?: Date;
}

const isStaff = (role: Role) => role === "AGENT" || role === "ADMIN";

/** Garde-fous de volumétrie des requêtes de sélection spatiale. */
const MAX_COMMUNES = 1000;
const MAX_CLUSTER_ROWS = 2000;
const MAX_PARCEL_ROWS = 50_000;

// ── Création ──────────────────────────────────────────────────────────────

export interface CreateReportResult {
  id: string;
  status: ReportStatus;
  /** false : rejeu d'un envoi déjà reçu (même clientId), aucun doublon créé. */
  created: boolean;
}

export async function createReport(
  user: ReportActor,
  input: CreateReportInput,
  opts: ServiceOptions = {},
): Promise<CreateReportResult> {
  if (user.role !== "FARMER") throw new ReportError("FORBIDDEN");

  const { photo, ...fields } = input;
  const parsed = createReportSchema.safeParse(fields);
  if (!parsed.success) throw new ReportError("INVALID", { fields: fieldErrorsOf(parsed.error) });
  const data = parsed.data;

  // Idempotence d'abord : un rejeu de la file hors ligne ne consomme pas de quota.
  if (data.clientId) {
    const existing = await findByClientId(data.clientId);
    if (existing) return replayResult(existing, user);
  }

  const limit = await limitScope("report", user.id);
  if (!limit.allowed) throw new ReportError("RATE_LIMITED", { retryAfterMs: limit.retryAfterMs });

  let photoBytes: Uint8Array<ArrayBuffer> | null = null;
  let photoMime: string | null = null;
  if (photo !== undefined && photo !== null) {
    const img = await readImageFile(photo, { maxUploadBytes: MAX_UPLOAD_BYTES, maxBytes: MAX_STORED_PHOTO_BYTES });
    if (img.ok) {
      photoBytes = img.bytes;
      photoMime = img.mime;
    } else if (img.error === "TOO_LARGE") {
      throw new ReportError("PHOTO_TOO_LARGE");
    } else if (img.error === "BAD_TYPE") {
      // E2 : tentative journalisée (type réel inconnu, extension ignorée).
      await audit(user.id, "report.photo_rejected", "PestReport", null, { size: photo instanceof Blob ? photo.size : null }, opts.ip);
      throw new ReportError("PHOTO_BAD_TYPE");
    } else if (img.error === "MISSING") {
      throw new ReportError("INVALID", { fields: { photo: "Photo illisible." } });
    }
    // EMPTY : champ photo vide = pas de photo.
  }

  if (!hasEvidence(data, photoBytes !== null)) {
    throw new ReportError("INVALID", {
      fields: { evidence: "Ajoutez une photo, ou dites ou écrivez ce que vous voyez." },
    });
  }

  const place = await resolvePlace(user, data);

  if (data.pestId) {
    const pest = await prisma.pest.findUnique({ where: { id: data.pestId }, select: { id: true } });
    if (!pest) throw new ReportError("INVALID", { fields: { pestId: "Ravageur inconnu." } });
  }

  let created: { id: string; status: ReportStatus };
  try {
    created = await prisma.pestReport.create({
      data: {
        reporterId: user.id,
        parcelId: place.parcelId,
        communeId: place.communeId,
        lat: place.lat,
        lon: place.lon,
        pestId: data.pestId ?? null,
        description: data.description ?? null,
        voiceTranscript: data.voiceTranscript ?? null,
        voiceLang: data.voiceTranscript ? (data.voiceLang ?? null) : null,
        photo: photoBytes,
        photoMime,
        status: "PENDING",
        clientId: data.clientId ?? null,
      },
      select: { id: true, status: true },
    });
  } catch (err) {
    // Deux rejeux simultanés du même clientId : le second lit le premier.
    if (data.clientId && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await findByClientId(data.clientId);
      if (existing) return replayResult(existing, user);
    }
    throw err;
  }

  await audit(
    user.id,
    "report.create",
    "PestReport",
    created.id,
    {
      communeId: place.communeId,
      parcelId: place.parcelId,
      pestId: data.pestId ?? null,
      withImage: photoBytes !== null,
      withVoice: Boolean(data.voiceTranscript),
      withText: Boolean(data.description),
      viaQueue: Boolean(data.clientId),
    },
    opts.ip,
  );

  return { id: created.id, status: created.status, created: true };
}

function findByClientId(clientId: string) {
  return prisma.pestReport.findUnique({
    where: { clientId },
    select: { id: true, status: true, reporterId: true },
  });
}

function replayResult(
  existing: { id: string; status: ReportStatus; reporterId: string },
  user: ReportActor,
): CreateReportResult {
  // Un clientId appartenant à quelqu'un d'autre : on ne révèle rien du signalement.
  if (existing.reporterId !== user.id) throw new ReportError("CONFLICT");
  return { id: existing.id, status: existing.status, created: false };
}

async function resolvePlace(
  user: ReportActor,
  data: { parcelId?: string; communeId?: string; lat?: number; lon?: number },
): Promise<{ parcelId: string | null; communeId: string; lat: number; lon: number }> {
  if (data.parcelId) {
    const parcel = await prisma.parcel.findUnique({
      where: { id: data.parcelId },
      select: { ownerId: true, communeId: true, lat: true, lon: true },
    });
    // E6 : parcelle d'une autre personne = même réponse qu'une parcelle inexistante.
    if (!parcel || parcel.ownerId !== user.id) {
      throw new ReportError("INVALID", { fields: { parcelId: "Champ introuvable." } });
    }
    return {
      parcelId: data.parcelId,
      communeId: parcel.communeId,
      lat: data.lat ?? parcel.lat,
      lon: data.lon ?? parcel.lon,
    };
  }

  if (data.lat !== undefined && data.lon !== undefined) {
    const communes = await prisma.commune.findMany({
      select: { id: true, lat: true, lon: true },
      take: MAX_COMMUNES,
    });
    const nearest = nearestCommune({ lat: data.lat, lon: data.lon }, communes);
    if (!nearest) throw new ReportError("UNAVAILABLE");
    return { parcelId: null, communeId: nearest.id, lat: data.lat, lon: data.lon };
  }

  const commune = data.communeId
    ? await prisma.commune.findUnique({ where: { id: data.communeId }, select: { id: true, lat: true, lon: true } })
    : null;
  if (!commune) throw new ReportError("INVALID", { fields: { communeId: "Commune inconnue." } });
  return { parcelId: null, communeId: commune.id, lat: commune.lat, lon: commune.lon };
}

// ── Validation par un agent ───────────────────────────────────────────────

export type ReviewResult =
  | { decision: "REJECTED"; reportId: string }
  | {
      decision: "CONFIRMED";
      reportId: string;
      alertId: string;
      severity: AlertSeverity;
      radiusKm: number;
      /** Exploitant·es (FARMER) propriétaires d'au moins une parcelle dans le rayon. */
      recipients: number;
      /** Livraisons IN_APP nouvellement créées. */
      deliveries: number;
      confirmedNearby: number;
    };

export async function reviewReport(
  agent: ReportActor,
  id: string,
  input: ReviewReportInput,
  opts: ServiceOptions = {},
): Promise<ReviewResult> {
  if (!isStaff(agent.role)) throw new ReportError("FORBIDDEN");
  if (!reportIdSchema.safeParse(id).success) throw new ReportError("NOT_FOUND");
  const parsed = reviewReportSchema.safeParse(input);
  if (!parsed.success) throw new ReportError("INVALID", { fields: fieldErrorsOf(parsed.error) });
  const data = parsed.data;
  const now = opts.now ?? new Date();

  const report = await prisma.pestReport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      lat: true,
      lon: true,
      pestId: true,
      communeId: true,
      commune: { select: { name: true } },
    },
  });
  if (!report) throw new ReportError("NOT_FOUND");
  if (report.status !== "PENDING") throw new ReportError("ALREADY_REVIEWED");

  if (data.decision === "REJECTED") {
    // Mise à jour conditionnelle (E9) : seul le premier agent passe.
    await prisma.$transaction(async (tx) => {
      const res = await tx.pestReport.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "REJECTED",
          reviewedById: agent.id,
          reviewedAt: now,
          reviewNote: data.note ?? null,
          ...(data.pestId ? { pestId: data.pestId } : {}),
        },
      });
      if (res.count === 0) throw new ReportError("ALREADY_REVIEWED");
    });
    await audit(agent.id, "report.reject", "PestReport", id, { note: data.note ?? null }, opts.ip);
    return { decision: "REJECTED", reportId: id };
  }

  const pestId = data.pestId ?? report.pestId;
  if (!pestId) throw new ReportError("INVALID", { fields: { pestId: "Identifiez le ravageur avant de confirmer." } });
  const pest = await prisma.pest.findUnique({
    where: { id: pestId },
    select: { id: true, nameFr: true, kind: true, symptomsFr: true, preventionFr: true, treatmentFr: true },
  });
  if (!pest) throw new ReportError("INVALID", { fields: { pestId: "Ravageur inconnu." } });
  const radiusKm = data.radiusKm ?? DEFAULT_OUTBREAK_RADIUS_KM;
  const center = { lat: report.lat, lon: report.lon };

  // Transaction courte, sans appel réseau : verrou PENDING → CONFIRMED, puis
  // lecture cohérente du voisinage (foyers proches, destinataires).
  const { confirmedNearby, recipientIds } = await prisma.$transaction(async (tx) => {
    const res = await tx.pestReport.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "CONFIRMED", pestId, reviewedById: agent.id, reviewedAt: now, reviewNote: data.note ?? null },
    });
    if (res.count === 0) throw new ReportError("ALREADY_REVIEWED");

    const clusterBox = boundingBox(center, OUTBREAK_CLUSTER_RADIUS_KM);
    const others = await tx.pestReport.findMany({
      where: {
        id: { not: id },
        pestId,
        status: "CONFIRMED",
        createdAt: { gte: outbreakWindowStart(now) },
        lat: { gte: clusterBox.latMin, lte: clusterBox.latMax },
        lon: { gte: clusterBox.lonMin, lte: clusterBox.lonMax },
      },
      select: { lat: true, lon: true },
      take: MAX_CLUSTER_ROWS,
    });
    const nearby = others.filter((r) => haversineKm(center, r) <= OUTBREAK_CLUSTER_RADIUS_KM).length + 1;

    const box = boundingBox(center, radiusKm);
    const parcels = await tx.parcel.findMany({
      where: {
        lat: { gte: box.latMin, lte: box.latMax },
        lon: { gte: box.lonMin, lte: box.lonMax },
        owner: { role: "FARMER", isActive: true },
      },
      select: { lat: true, lon: true, ownerId: true },
      take: MAX_PARCEL_ROWS,
    });
    const owners = [...new Set(parcelsWithinRadius(center, radiusKm, parcels).map((p) => p.ownerId))];
    return { confirmedNearby: nearby, recipientIds: owners };
  });

  const severity = outbreakSeverity(confirmedNearby);
  const texts = buildOutbreakTexts(pest, {
    communeName: report.commune.name,
    radiusKm,
    severity,
    confirmedNearby,
  });

  let published: Awaited<ReturnType<typeof publishAlert>>;
  try {
    // Hors transaction : la traduction (229langues) est un appel réseau.
    published = await publishAlert({
      type: "PEST_OUTBREAK",
      severity,
      source: "PEST_REPORT",
      dedupKey: outbreakDedupKey(id),
      ...texts,
      communeId: report.communeId,
      lat: report.lat,
      lon: report.lon,
      radiusKm,
      pestId,
      reportId: id,
      validFrom: now,
      validUntil: outbreakValidUntil(now),
      createdById: agent.id,
      recipientIds,
    });
  } catch (err) {
    // Compensation : le signalement redevient PENDING pour être revalidé ;
    // publishAlert étant idempotent (dedupKey), la nouvelle tentative complète la livraison.
    console.error("[reports] publication de l'alerte impossible", { reportId: id }, err);
    await prisma.pestReport.updateMany({
      where: { id, status: "CONFIRMED", reviewedById: agent.id, reviewedAt: now },
      data: { status: "PENDING", reviewedById: null, reviewedAt: null, reviewNote: null, pestId: report.pestId },
    });
    throw new ReportError("UNAVAILABLE");
  }

  await audit(
    agent.id,
    "report.confirm",
    "PestReport",
    id,
    {
      pestId,
      radiusKm,
      severity,
      confirmedNearby,
      recipients: recipientIds.length,
      deliveries: published.deliveries,
      alertId: published.alertId,
      note: data.note ?? null,
    },
    opts.ip,
  );

  return {
    decision: "CONFIRMED",
    reportId: id,
    alertId: published.alertId,
    severity,
    radiusKm,
    recipients: recipientIds.length,
    deliveries: published.deliveries,
    confirmedNearby,
  };
}

// ── Lecture ───────────────────────────────────────────────────────────────

export interface PestLabel {
  id: string;
  slug: string;
  nameFr: string;
  nameFon: string | null;
  nameYo: string | null;
  kind: PestKind;
}

export interface ReportListItem {
  id: string;
  status: ReportStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  lat: number;
  lon: number;
  communeName: string;
  department: string;
  parcel: { id: string; name: string } | null;
  pest: PestLabel | null;
  hasPhoto: boolean;
  hasVoice: boolean;
  hasDescription: boolean;
  /** Début de la transcription ou de la description (≤ 140 caractères). */
  excerpt: string | null;
  reviewNote: string | null;
  /** Nom du déclarant : seulement pour AGENT/ADMIN. */
  reporterName: string | null;
}

const PEST_LABEL_SELECT = { id: true, slug: true, nameFr: true, nameFon: true, nameYo: true, kind: true } as const;

const LIST_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
  lat: true,
  lon: true,
  description: true,
  voiceTranscript: true,
  photoMime: true,
  reviewNote: true,
  commune: { select: { name: true, department: true } },
  parcel: { select: { id: true, name: true } },
  pest: { select: PEST_LABEL_SELECT },
  reporter: { select: { fullName: true } },
} satisfies Prisma.PestReportSelect;

type ListRow = Prisma.PestReportGetPayload<{ select: typeof LIST_SELECT }>;

function toListItem(row: ListRow, staff: boolean): ReportListItem {
  const text = row.voiceTranscript ?? row.description;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    lat: row.lat,
    lon: row.lon,
    communeName: row.commune.name,
    department: row.commune.department,
    parcel: row.parcel,
    pest: row.pest,
    hasPhoto: row.photoMime !== null,
    hasVoice: row.voiceTranscript !== null,
    hasDescription: row.description !== null,
    excerpt: text ? (text.length > 140 ? `${text.slice(0, 137)}…` : text) : null,
    reviewNote: row.reviewNote,
    reporterName: staff ? row.reporter.fullName : null,
  };
}

export interface ReportPage {
  items: ReportListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Le déclarant voit les siens ; AGENT/ADMIN voient tout ; BUYER : refus. */
export async function listReports(user: ReportActor, input: ListReportsInput = {}): Promise<ReportPage> {
  if (user.role === "BUYER") throw new ReportError("FORBIDDEN");
  const staff = isStaff(user.role);
  const q = listReportsSchema.parse(input);
  const where: Prisma.PestReportWhereInput = {
    ...(staff ? {} : { reporterId: user.id }),
    ...(q.status ? { status: q.status } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.pestReport.count({ where }),
    prisma.pestReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: LIST_SELECT,
    }),
  ]);
  return { items: rows.map((r) => toListItem(r, staff)), total, page: q.page, pageSize: q.pageSize };
}

export interface ReportDetail extends ReportListItem {
  description: string | null;
  voiceTranscript: string | null;
  voiceLang: string | null;
  parcelDistanceKm: number | null;
  reporter: { fullName: string; phone: string | null };
  reviewedBy: { fullName: string } | null;
  alerts: Array<{
    id: string;
    severity: AlertSeverity;
    radiusKm: number | null;
    createdAt: Date;
    validUntil: Date;
    /** Exploitant·es alerté·es (livraisons IN_APP). */
    recipients: number;
    acknowledged: number;
  }>;
  history: Array<{ id: string; action: string; actorName: string | null; createdAt: Date }>;
}

export async function getReport(user: ReportActor, id: string): Promise<ReportDetail> {
  if (!reportIdSchema.safeParse(id).success) throw new ReportError("NOT_FOUND");
  const row = await prisma.pestReport.findUnique({
    where: { id },
    select: {
      ...LIST_SELECT,
      reporterId: true,
      voiceLang: true,
      parcel: { select: { id: true, name: true, lat: true, lon: true } },
      reporter: { select: { fullName: true, phone: true } },
      reviewedBy: { select: { fullName: true } },
      alerts: {
        select: {
          id: true,
          severity: true,
          radiusKm: true,
          createdAt: true,
          validUntil: true,
          _count: { select: { deliveries: { where: { channel: "IN_APP" } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  const staff = isStaff(user.role);
  // Anti-IDOR : même réponse pour « absent » et « pas à vous ».
  if (!row || (!staff && row.reporterId !== user.id)) throw new ReportError("NOT_FOUND");

  const alertIds = row.alerts.map((a) => a.id);
  const [acks, history] = await Promise.all([
    alertIds.length && staff
      ? prisma.alertDelivery.groupBy({
          by: ["alertId"],
          where: { alertId: { in: alertIds }, channel: "IN_APP", status: "ACKNOWLEDGED" },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ alertId: string; _count: { _all: number } }>),
    staff
      ? prisma.auditLog.findMany({
          where: { entity: "PestReport", entityId: id },
          orderBy: { createdAt: "asc" },
          take: 50,
          select: { id: true, action: true, createdAt: true, actor: { select: { fullName: true } } },
        })
      : Promise.resolve([]),
  ]);
  const ackBy = new Map(acks.map((a) => [a.alertId, a._count._all]));

  const { parcel, reporter, reviewedBy, alerts, reporterId: _r, voiceLang, ...base } = row;
  void _r;
  const item = toListItem({ ...base, parcel: parcel ? { id: parcel.id, name: parcel.name } : null, reporter }, staff);
  return {
    ...item,
    description: row.description,
    voiceTranscript: row.voiceTranscript,
    voiceLang,
    parcelDistanceKm: parcel ? haversineKm({ lat: row.lat, lon: row.lon }, parcel) : null,
    reporter: { fullName: reporter.fullName, phone: staff ? reporter.phone : null },
    reviewedBy,
    alerts: alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      radiusKm: a.radiusKm,
      createdAt: a.createdAt,
      validUntil: a.validUntil,
      recipients: a._count.deliveries,
      acknowledged: ackBy.get(a.id) ?? 0,
    })),
    history: history.map((h) => ({ id: h.id, action: h.action, actorName: h.actor?.fullName ?? null, createdAt: h.createdAt })),
  };
}

/** Photo d'un signalement : déclarant ou AGENT/ADMIN. Type recalculé depuis les octets. */
export async function getReportPhoto(
  user: ReportActor,
  id: string,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: "image/jpeg" | "image/png" | "image/webp" }> {
  if (!reportIdSchema.safeParse(id).success) throw new ReportError("NOT_FOUND");
  const row = await prisma.pestReport.findUnique({
    where: { id },
    select: { reporterId: true, photo: true },
  });
  if (!row || (!isStaff(user.role) && row.reporterId !== user.id) || !row.photo) {
    throw new ReportError("NOT_FOUND");
  }
  const bytes = new Uint8Array(row.photo);
  const mime = detectImageMime(bytes);
  if (!mime) throw new ReportError("NOT_FOUND");
  return { bytes, mime };
}

export async function countPendingReports(user: ReportActor): Promise<number> {
  if (!isStaff(user.role)) throw new ReportError("FORBIDDEN");
  return prisma.pestReport.count({ where: { status: "PENDING" } });
}

// ── Données de formulaire ─────────────────────────────────────────────────

export interface PestOption extends PestLabel {
  imageKey: string | null;
  cropSlugs: string[];
}

export async function listPestOptions(): Promise<PestOption[]> {
  const pests = await prisma.pest.findMany({
    select: { ...PEST_LABEL_SELECT, imageKey: true, crops: { select: { slug: true } } },
    orderBy: { nameFr: "asc" },
    take: 200,
  });
  return pests.map(({ crops, ...p }) => ({ ...p, cropSlugs: crops.map((c) => c.slug) }));
}

export interface ReportFormContext {
  parcels: Array<{ id: string; name: string; lat: number; lon: number; communeName: string; cropSlugs: string[] }>;
  pests: PestOption[];
  communes: Array<{ id: string; name: string; department: string }>;
}

/** Parcelles de l'exploitante (avec cultures en cours), ravageurs, communes. */
export async function getReportFormContext(user: ReportActor): Promise<ReportFormContext> {
  if (user.role !== "FARMER") throw new ReportError("FORBIDDEN");
  const [parcels, pests, communes] = await Promise.all([
    prisma.parcel.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        lat: true,
        lon: true,
        commune: { select: { name: true } },
        plantings: {
          where: { status: { in: ["GROWING", "PLANNED"] } },
          select: { crop: { select: { slug: true } } },
          take: 10,
        },
      },
    }),
    listPestOptions(),
    prisma.commune.findMany({
      select: { id: true, name: true, department: true },
      orderBy: { name: "asc" },
      take: MAX_COMMUNES,
    }),
  ]);
  return {
    parcels: parcels.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      communeName: p.commune.name,
      cropSlugs: [...new Set(p.plantings.map((pl) => pl.crop.slug))],
    })),
    pests,
    communes,
  };
}
