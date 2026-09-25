"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { requireRole, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/security";
import { fieldErrorsOf } from "@/lib/validation";
import { getTranslator } from "@/server/content/ui/i18n";
import {
  cropSchema,
  deleteSchema,
  formToObject,
  levyRateSchema,
  levyToggleSchema,
  pestSchema,
  publishSchema,
  referencePriceSchema,
  regulationSchema,
  userActiveSchema,
  userRoleSchema,
} from "@/server/content/schemas";
import {
  addReferencePrice,
  deleteReferencePrice,
  deleteRegulation,
  saveCrop,
  saveLevyRate,
  savePest,
  saveRegulation,
  setLevyActive,
  setRegulationPublished,
  setUserActive,
  setUserRole,
  type SaveResult,
} from "@/server/content/admin-cms";

/** État renvoyé par toutes les actions du CMS (affiché par AdminForm). */
export type AdminActionState =
  | { status: "idle" }
  | { status: "ok"; message: string; warning?: string }
  | { status: "error"; message: string; fields?: Record<string, string> };

type Tr = Awaited<ReturnType<typeof getTranslator>>["tr"];

/** Rôle ADMIN revérifié, FormData validé par zod, erreurs génériques côté client. */
async function guarded<S extends z.ZodType>(
  schema: S,
  fd: FormData,
  multi: readonly string[],
  run: (data: z.infer<S>, admin: CurrentUser, tr: Tr) => Promise<AdminActionState>,
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");
  const { tr } = await getTranslator();
  const parsed = schema.safeParse(formToObject(fd, multi));
  if (!parsed.success) {
    return { status: "error", message: tr("adm.err.invalid"), fields: fieldErrorsOf(parsed.error) };
  }
  try {
    return await run(parsed.data, admin, tr);
  } catch (err) {
    unstable_rethrow(err); // redirect() lève une erreur de contrôle : on la laisse passer.
    console.error("[admin] action en échec", err);
    return { status: "error", message: tr("adm.err.generic") };
  }
}

function saved(tr: Tr, r: Extract<SaveResult, { ok: true }>): AdminActionState {
  return {
    status: "ok",
    message: r.translated > 0 ? tr("adm.saved_translated", { count: r.translated }) : tr("adm.saved"),
    warning: r.failed > 0 ? tr("adm.translate_failed", { count: r.failed }) : undefined,
  };
}

function refused(tr: Tr, r: Extract<SaveResult, { ok: false }>): AdminActionState {
  return {
    status: "error",
    message: r.reason === "conflict" ? tr("adm.err.conflict") : tr("adm.err.not_found"),
    fields: r.fields,
  };
}

// ── Utilisateurs ──────────────────────────────────────────────────────────

const USER_REASONS = ["self_demote", "self_deactivate", "same_role", "last_admin", "not_found"] as const;

export async function setUserRoleAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(userRoleSchema, fd, [], async ({ userId, role }, admin, tr) => {
    const r = await setUserRole(admin.id, userId, role);
    if (!r.ok) return { status: "error", message: tr(`adm.users.refuse.${USER_REASONS.includes(r.reason) ? r.reason : "not_found"}`) };
    await audit(admin.id, "user.role.change", "User", userId, { from: r.previous, to: role });
    revalidatePath("/admin/utilisateurs");
    return { status: "ok", message: tr("adm.users.role_changed", { role: tr(`role.${role}`) }) };
  });
}

export async function setUserActiveAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(userActiveSchema, fd, [], async ({ userId, active }, admin, tr) => {
    const r = await setUserActive(admin.id, userId, active);
    if (!r.ok) return { status: "error", message: tr(`adm.users.refuse.${r.reason}`) };
    await audit(admin.id, active ? "user.activate" : "user.deactivate", "User", userId);
    revalidatePath("/admin/utilisateurs");
    revalidatePath("/admin");
    return { status: "ok", message: tr(active ? "adm.users.activated" : "adm.users.deactivated") };
  });
}

// ── Fiches réglementaires ─────────────────────────────────────────────────

export async function saveRegulationAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(regulationSchema, fd, [], async (data, admin, tr) => {
    const r = await saveRegulation(data);
    if (!r.ok) return refused(tr, r);
    await audit(admin.id, data.id ? "regulation.update" : "regulation.create", "Regulation", r.id, {
      slug: r.slug,
      published: data.published,
      translated: r.translated,
      translationFailed: r.failed,
    });
    revalidatePath("/admin/reglementation");
    revalidatePath("/reglementation", "layout");
    if (!data.id) redirect(`/admin/reglementation/${r.id}?cree=1`);
    return saved(tr, r);
  });
}

export async function publishRegulationAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(publishSchema, fd, [], async ({ id, published }, admin, tr) => {
    const row = await setRegulationPublished(id, published);
    if (!row) return { status: "error", message: tr("adm.err.not_found") };
    await audit(admin.id, published ? "regulation.publish" : "regulation.unpublish", "Regulation", id, { slug: row.slug });
    revalidatePath("/admin/reglementation");
    revalidatePath("/reglementation", "layout");
    return { status: "ok", message: tr(published ? "adm.reg.published_ok" : "adm.reg.unpublished_ok") };
  });
}

export async function deleteRegulationAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(deleteSchema, fd, [], async ({ id }, admin, tr) => {
    const row = await deleteRegulation(id);
    if (!row) return { status: "error", message: tr("adm.err.not_found") };
    await audit(admin.id, "regulation.delete", "Regulation", id, { slug: row.slug, title: row.titleFr });
    revalidatePath("/admin/reglementation");
    revalidatePath("/reglementation", "layout");
    redirect("/admin/reglementation?supprime=1");
  });
}

// ── Ravageurs ─────────────────────────────────────────────────────────────

export async function savePestAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(pestSchema, fd, ["cropIds"], async (data, admin, tr) => {
    const r = await savePest(data);
    if (!r.ok) return refused(tr, r);
    await audit(admin.id, data.id ? "pest.update" : "pest.create", "Pest", r.id, {
      slug: r.slug,
      riskTempMin: data.riskTempMin,
      riskTempMax: data.riskTempMax,
      riskHumidityMin: data.riskHumidityMin,
      translated: r.translated,
    });
    revalidatePath("/admin/ravageurs");
    revalidatePath(`/admin/ravageurs/${r.id}`);
    if (!data.id) redirect(`/admin/ravageurs/${r.id}?cree=1`);
    return saved(tr, r);
  });
}

// ── Cultures ──────────────────────────────────────────────────────────────

export async function saveCropAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(cropSchema, fd, ["sowingMonths", "harvestMonths"], async (data, admin, tr) => {
    const r = await saveCrop(data);
    if (!r.ok) return refused(tr, r);
    await audit(admin.id, data.id ? "crop.update" : "crop.create", "Crop", r.id, {
      slug: r.slug,
      cycleDays: data.cycleDays,
      sowingMonths: data.sowingMonths,
      harvestMonths: data.harvestMonths,
      translated: r.translated,
    });
    revalidatePath("/admin/cultures");
    revalidatePath(`/admin/cultures/${r.id}`);
    revalidatePath("/marche");
    if (!data.id) redirect(`/admin/cultures/${r.id}?cree=1`);
    return saved(tr, r);
  });
}

// ── Redevances ────────────────────────────────────────────────────────────

export async function saveLevyRateAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(levyRateSchema, fd, [], async (data, admin, tr) => {
    const r = await saveLevyRate(data);
    if (!r.ok) return refused(tr, r);
    await audit(admin.id, data.id ? "levy.update" : "levy.create", "LevyRate", r.id, {
      code: data.code,
      basis: data.basis,
      rate: data.rate,
      active: data.active,
    });
    revalidatePath("/admin/redevances");
    revalidatePath("/app/redevances");
    return saved(tr, r);
  });
}

export async function toggleLevyAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(levyToggleSchema, fd, [], async ({ id, active }, admin, tr) => {
    const row = await setLevyActive(id, active);
    if (!row) return { status: "error", message: tr("adm.err.not_found") };
    await audit(admin.id, active ? "levy.activate" : "levy.deactivate", "LevyRate", id, { code: row.code });
    revalidatePath("/admin/redevances");
    revalidatePath("/app/redevances");
    return { status: "ok", message: tr(active ? "adm.levy.activated" : "adm.levy.deactivated") };
  });
}

// ── Prix de référence ─────────────────────────────────────────────────────

export async function addPriceAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(referencePriceSchema, fd, [], async (data, admin, tr) => {
    const r = await addReferencePrice(data);
    if (!r.ok) return refused(tr, r);
    await audit(admin.id, "price.create", "ReferencePrice", r.id, {
      cropId: data.cropId,
      communeId: data.communeId ?? null,
      market: data.market,
      pricePerKgFcfa: data.pricePerKgFcfa,
      observedAt: data.observedAt,
    });
    revalidatePath("/admin/prix");
    revalidatePath("/marche");
    return { status: "ok", message: tr("adm.price.added") };
  });
}

export async function deletePriceAction(_p: AdminActionState, fd: FormData): Promise<AdminActionState> {
  return guarded(deleteSchema, fd, [], async ({ id }, admin, tr) => {
    const row = await deleteReferencePrice(id);
    if (!row) return { status: "error", message: tr("adm.err.not_found") };
    await audit(admin.id, "price.delete", "ReferencePrice", id, { cropId: row.cropId, pricePerKgFcfa: row.pricePerKgFcfa });
    revalidatePath("/admin/prix");
    revalidatePath("/marche");
    return { status: "ok", message: tr("adm.price.deleted") };
  });
}
