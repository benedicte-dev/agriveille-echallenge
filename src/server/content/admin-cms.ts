import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { revokeAllSessions } from "@/lib/auth";
import {
  checkActiveChange,
  checkRoleChange,
  normalizeCropIcon,
  type CropInput,
  type LevyRateInput,
  type PestInput,
  type ReferencePriceInput,
  type RegulationInput,
  type RoleChangeCheck,
} from "./schemas";
import { resolveTranslations, type TranslatableField, type TranslationOutcome } from "./translate";

/**
 * Services du CMS (/admin). Le contrôle de rôle (ADMIN) est fait par la Server
 * Action appelante ; ces fonctions reçoivent des entrées déjà validées par zod.
 * Les champs fon / yo passent par resolveTranslations (traduction auto, saisie
 * manuelle conservée).
 */

export type SaveResult =
  | { ok: true; id: string; slug?: string; translated: number; failed: number }
  | { ok: false; fields?: Record<string, string>; reason: "not_found" | "conflict" };

type Row = Record<string, unknown> | null;

function field(prev: Row, input: Record<string, unknown>, key: string, markdown = false): TranslatableField {
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    key,
    prevFr: prev ? s(prev[`${key}Fr`]) : null,
    nextFr: String(input[`${key}Fr`] ?? ""),
    prev: { fon: prev ? s(prev[`${key}Fon`]) : null, yo: prev ? s(prev[`${key}Yo`]) : null },
    submitted: { fon: s(input[`${key}Fon`]), yo: s(input[`${key}Yo`]) },
    markdown,
  };
}

function lz(out: TranslationOutcome, key: string) {
  return out.values[key] ?? { fon: null, yo: null };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ── Tableau de bord ───────────────────────────────────────────────────────

export async function contentCounts() {
  const [users, activeUsers, regulations, published, pests, crops, prices, levies, activeLevies] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.regulation.count(),
    prisma.regulation.count({ where: { published: true } }),
    prisma.pest.count(),
    prisma.crop.count(),
    prisma.referencePrice.count(),
    prisma.levyRate.count(),
    prisma.levyRate.count({ where: { active: true } }),
  ]);
  return { users, activeUsers, regulations, published, pests, crops, prices, levies, activeLevies };
}

// ── Journal d'audit ───────────────────────────────────────────────────────

export const AUDIT_PAGE_SIZE = 25;

export async function listAudit(filter: { action?: string; actor?: string; page: number }, pageSize = AUDIT_PAGE_SIZE) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filter.action ? { action: { startsWith: filter.action } } : {}),
    ...(filter.actor ? { actorId: filter.actor } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        meta: true,
        ip: true,
        createdAt: true,
        actor: { select: { id: true, fullName: true, role: true } },
      },
    }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Valeurs proposées dans les filtres du journal (actions distinctes, acteurs présents). */
export async function auditFilterOptions() {
  const [actions, actors] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" }, take: 200 }),
    prisma.auditLog.groupBy({ by: ["actorId"], where: { actorId: { not: null } }, orderBy: { actorId: "asc" }, take: 200 }),
  ]);
  const ids = actors.map((a) => a.actorId).filter((v): v is string => v !== null);
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } })
    : [];
  return { actions: actions.map((a) => a.action), actors: users };
}

// ── Utilisateurs ──────────────────────────────────────────────────────────

export const USER_PAGE_SIZE = 20;

export async function listUsers(filter: { q?: string; role?: Role | ""; page: number }, pageSize = USER_PAGE_SIZE) {
  const q = filter.q?.trim();
  const digits = q?.replace(/\D/g, "") ?? "";
  const or: Prisma.UserWhereInput[] = [];
  if (q) or.push({ fullName: { contains: q, mode: "insensitive" } });
  if (digits.length >= 2) or.push({ phone: { contains: digits } });
  const where: Prisma.UserWhereInput = {
    ...(filter.role ? { role: filter.role } : {}),
    ...(q ? { OR: or } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ role: "desc" }, { fullName: "asc" }],
      skip: (filter.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        commune: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

type UserChange = RoleChangeCheck | { ok: false; reason: "not_found" };

function activeAdminCount() {
  return prisma.user.count({ where: { role: "ADMIN", isActive: true } });
}

export async function setUserRole(actorId: string, userId: string, role: Role): Promise<UserChange & { previous?: Role }> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, reason: "not_found" };
  const check = checkRoleChange({
    actorId,
    targetId: userId,
    currentRole: target.role,
    nextRole: role,
    activeAdminCount: await activeAdminCount(),
  });
  if (!check.ok) return check;
  await prisma.user.update({ where: { id: userId }, data: { role } });
  // Les droits changent : on ferme les sessions ouvertes de la personne.
  await revokeAllSessions(userId);
  return { ok: true, previous: target.role };
}

export async function setUserActive(actorId: string, userId: string, active: boolean): Promise<UserChange> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!target) return { ok: false, reason: "not_found" };
  const check = checkActiveChange({
    actorId,
    targetId: userId,
    targetRole: target.role,
    nextActive: active,
    activeAdminCount: await activeAdminCount(),
  });
  if (!check.ok) return check;
  await prisma.user.update({
    where: { id: userId },
    data: active ? { isActive: true, failedLogins: 0, lockedUntil: null } : { isActive: false },
  });
  if (!active) await revokeAllSessions(userId);
  return { ok: true };
}

// ── Fiches réglementaires ─────────────────────────────────────────────────

export async function saveRegulation(input: RegulationInput): Promise<SaveResult> {
  const prev = input.id ? await prisma.regulation.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !prev) return { ok: false, reason: "not_found" };
  const tr = await resolveTranslations(
    [field(prev, input, "title"), field(prev, input, "summary"), field(prev, input, "body", true)],
    input.autoTranslate,
  );
  const data = {
    slug: input.slug,
    category: input.category,
    titleFr: input.titleFr,
    titleFon: lz(tr, "title").fon,
    titleYo: lz(tr, "title").yo,
    summaryFr: input.summaryFr,
    summaryFon: lz(tr, "summary").fon,
    summaryYo: lz(tr, "summary").yo,
    bodyFr: input.bodyFr,
    bodyFon: lz(tr, "body").fon,
    bodyYo: lz(tr, "body").yo,
    sourceRef: input.sourceRef ?? null,
    published: input.published,
  };
  try {
    const row = input.id
      ? await prisma.regulation.update({ where: { id: input.id }, data })
      : await prisma.regulation.create({ data });
    return { ok: true, id: row.id, slug: row.slug, translated: tr.translated, failed: tr.failed };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "conflict", fields: { slug: "Cet identifiant d'URL est déjà utilisé." } };
    throw err;
  }
}

export async function setRegulationPublished(id: string, published: boolean) {
  const row = await prisma.regulation.findUnique({ where: { id }, select: { slug: true } });
  if (!row) return null;
  await prisma.regulation.update({ where: { id }, data: { published } });
  return row;
}

export async function deleteRegulation(id: string) {
  const row = await prisma.regulation.findUnique({ where: { id }, select: { slug: true, titleFr: true } });
  if (!row) return null;
  await prisma.regulation.delete({ where: { id } });
  return row;
}

// ── Ravageurs ─────────────────────────────────────────────────────────────

export async function savePest(input: PestInput): Promise<SaveResult> {
  const prev = input.id ? await prisma.pest.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !prev) return { ok: false, reason: "not_found" };
  const tr = await resolveTranslations(
    ["name", "symptoms", "prevention", "treatment"].map((k) => field(prev, input, k)),
    input.autoTranslate,
  );
  const crops = await prisma.crop.findMany({ where: { id: { in: input.cropIds } }, select: { id: true } });
  const data = {
    slug: input.slug,
    kind: input.kind,
    nameFr: input.nameFr,
    nameFon: lz(tr, "name").fon,
    nameYo: lz(tr, "name").yo,
    symptomsFr: input.symptomsFr,
    symptomsFon: lz(tr, "symptoms").fon,
    symptomsYo: lz(tr, "symptoms").yo,
    preventionFr: input.preventionFr,
    preventionFon: lz(tr, "prevention").fon,
    preventionYo: lz(tr, "prevention").yo,
    treatmentFr: input.treatmentFr,
    treatmentFon: lz(tr, "treatment").fon,
    treatmentYo: lz(tr, "treatment").yo,
    riskTempMin: input.riskTempMin,
    riskTempMax: input.riskTempMax,
    riskHumidityMin: input.riskHumidityMin,
  };
  try {
    const row = input.id
      ? await prisma.pest.update({ where: { id: input.id }, data: { ...data, crops: { set: crops } } })
      : await prisma.pest.create({ data: { ...data, crops: { connect: crops } } });
    return { ok: true, id: row.id, slug: row.slug, translated: tr.translated, failed: tr.failed };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "conflict", fields: { slug: "Cet identifiant d'URL est déjà utilisé." } };
    throw err;
  }
}

// ── Cultures ──────────────────────────────────────────────────────────────

export async function saveCrop(input: CropInput): Promise<SaveResult> {
  const prev = input.id ? await prisma.crop.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !prev) return { ok: false, reason: "not_found" };
  const tr = await resolveTranslations([field(prev, input, "name")], input.autoTranslate);
  const data = {
    slug: input.slug,
    nameFr: input.nameFr,
    nameFon: lz(tr, "name").fon,
    nameYo: lz(tr, "name").yo,
    icon: normalizeCropIcon(input.icon),
    cycleDays: input.cycleDays,
    sowingMonths: input.sowingMonths,
    harvestMonths: input.harvestMonths,
    minRainMm: input.minRainMm,
    optimalTempMin: input.optimalTempMin,
    optimalTempMax: input.optimalTempMax,
    notes: input.notes ?? null,
  };
  try {
    const row = input.id
      ? await prisma.crop.update({ where: { id: input.id }, data })
      : await prisma.crop.create({ data });
    return { ok: true, id: row.id, slug: row.slug, translated: tr.translated, failed: tr.failed };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "conflict", fields: { slug: "Cet identifiant d'URL est déjà utilisé." } };
    throw err;
  }
}

// ── Redevances ────────────────────────────────────────────────────────────

export async function saveLevyRate(input: LevyRateInput): Promise<SaveResult> {
  const prev = input.id ? await prisma.levyRate.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !prev) return { ok: false, reason: "not_found" };
  const tr = await resolveTranslations([field(prev, input, "label")], input.autoTranslate);
  const data = {
    code: input.code,
    labelFr: input.labelFr,
    labelFon: lz(tr, "label").fon,
    labelYo: lz(tr, "label").yo,
    basis: input.basis,
    rate: input.rate,
    active: input.active,
  };
  try {
    const row = input.id
      ? await prisma.levyRate.update({ where: { id: input.id }, data })
      : await prisma.levyRate.create({ data });
    return { ok: true, id: row.id, translated: tr.translated, failed: tr.failed };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "conflict", fields: { code: "Ce code est déjà utilisé." } };
    throw err;
  }
}

export async function setLevyActive(id: string, active: boolean) {
  const row = await prisma.levyRate.findUnique({ where: { id }, select: { code: true } });
  if (!row) return null;
  await prisma.levyRate.update({ where: { id }, data: { active } });
  return row;
}

// ── Prix de référence ─────────────────────────────────────────────────────

export async function addReferencePrice(input: ReferencePriceInput): Promise<SaveResult> {
  const [crop, commune] = await Promise.all([
    prisma.crop.findUnique({ where: { id: input.cropId }, select: { id: true } }),
    input.communeId ? prisma.commune.findUnique({ where: { id: input.communeId }, select: { id: true } }) : null,
  ]);
  if (!crop) return { ok: false, reason: "not_found", fields: { cropId: "Culture inconnue." } };
  if (input.communeId && !commune) return { ok: false, reason: "not_found", fields: { communeId: "Commune inconnue." } };
  const row = await prisma.referencePrice.create({
    data: {
      cropId: input.cropId,
      communeId: input.communeId ?? null,
      market: input.market,
      pricePerKgFcfa: input.pricePerKgFcfa,
      observedAt: new Date(`${input.observedAt}T12:00:00Z`),
    },
  });
  return { ok: true, id: row.id, translated: 0, failed: 0 };
}

export async function deleteReferencePrice(id: string) {
  const row = await prisma.referencePrice.findUnique({ where: { id }, select: { cropId: true, pricePerKgFcfa: true } });
  if (!row) return null;
  await prisma.referencePrice.delete({ where: { id } });
  return row;
}

// ── Lectures pour les écrans du CMS ───────────────────────────────────────

export function listRegulationsAdmin() {
  return prisma.regulation.findMany({
    orderBy: [{ published: "desc" }, { updatedAt: "desc" }],
    select: { id: true, slug: true, category: true, titleFr: true, titleFon: true, titleYo: true, published: true, updatedAt: true },
  });
}

export function getRegulationAdmin(id: string) {
  return prisma.regulation.findUnique({ where: { id } });
}

export function listPestsAdmin() {
  return prisma.pest.findMany({
    orderBy: { nameFr: "asc" },
    select: {
      id: true,
      slug: true,
      kind: true,
      nameFr: true,
      riskTempMin: true,
      riskTempMax: true,
      riskHumidityMin: true,
      crops: { select: { nameFr: true }, orderBy: { nameFr: "asc" } },
    },
  });
}

export function getPestAdmin(id: string) {
  return prisma.pest.findUnique({ where: { id }, include: { crops: { select: { id: true } } } });
}

export function listCropsAdmin() {
  return prisma.crop.findMany({
    orderBy: { nameFr: "asc" },
    select: {
      id: true,
      slug: true,
      nameFr: true,
      cycleDays: true,
      sowingMonths: true,
      harvestMonths: true,
      minRainMm: true,
      optimalTempMin: true,
      optimalTempMax: true,
    },
  });
}

export function getCropAdmin(id: string) {
  return prisma.crop.findUnique({ where: { id } });
}

export function cropOptions() {
  return prisma.crop.findMany({ orderBy: { nameFr: "asc" }, select: { id: true, nameFr: true } });
}

export function communeOptions() {
  return prisma.commune.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, department: true } });
}

export function listRecentPrices(take = 50) {
  return prisma.referencePrice.findMany({
    orderBy: [{ observedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      market: true,
      pricePerKgFcfa: true,
      observedAt: true,
      crop: { select: { nameFr: true } },
      commune: { select: { name: true } },
    },
  });
}

export function listLevyRatesAdmin() {
  return prisma.levyRate.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      labelFr: true,
      labelFon: true,
      labelYo: true,
      basis: true,
      rate: true,
      active: true,
      _count: { select: { declarations: true } },
    },
  });
}
