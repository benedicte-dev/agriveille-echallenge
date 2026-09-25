"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { t, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { isIsoDate } from "@/lib/monitoring/dates";
import { todayInBenin } from "@/lib/monitoring";
import {
  areaHaSchema,
  fieldErrorsOf,
  formDataToObject,
  idSchema,
  latSchema,
  lonSchema,
  optionalText,
} from "@/lib/validation";
import { analyzeParcel, refreshParcel } from "@/server/monitoring";

export interface ParcelFormState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Nombre maximal de champs par exploitant (liste bornée). */
const MAX_PARCELS_PER_FARMER = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

const createSchema = z
  .object({
    cropId: idSchema,
    communeId: idSchema,
    lat: z.preprocess(emptyToUndef, latSchema.optional()),
    lon: z.preprocess(emptyToUndef, lonSchema.optional()),
    areaHa: areaHaSchema,
    sowingDate: z.string().refine(isIsoDate, { error: "Date invalide." }),
    name: optionalText(60),
  })
  .refine((d) => (d.lat === undefined) === (d.lon === undefined), { path: ["lat"], error: "Position incomplète." });

/**
 * Crée un champ et sa culture. La récolte prévue est calculée côté serveur
 * (semis + cycleDays de la culture) ; le statut découle de la date de semis.
 */
export async function createParcelAction(_prev: ParcelFormState | undefined, formData: FormData): Promise<ParcelFormState> {
  const user = await requireRole("FARMER");
  const messages = getMessages(await getLocale());
  const parsed = createSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: t(messages, "error.invalid"), fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const d = parsed.data;

  const today = todayInBenin();
  const sowing = new Date(`${d.sowingDate}T12:00:00Z`);
  const offsetDays = Math.round((sowing.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / DAY_MS);
  if (offsetDays < -400 || offsetDays > 365) {
    return { ok: false, error: t(messages, "error.invalid"), fieldErrors: { sowingDate: t(messages, "mon.new.date_range") } };
  }

  let parcelId: string;
  try {
    const [crop, commune, count] = await Promise.all([
      prisma.crop.findUnique({ where: { id: d.cropId }, select: { id: true, nameFr: true, cycleDays: true } }),
      prisma.commune.findUnique({ where: { id: d.communeId }, select: { id: true, lat: true, lon: true } }),
      prisma.parcel.count({ where: { ownerId: user.id } }),
    ]);
    if (!crop) return { ok: false, error: t(messages, "error.invalid"), fieldErrors: { cropId: t(messages, "parcel.choose_crop") } };
    if (!commune) return { ok: false, error: t(messages, "error.invalid"), fieldErrors: { communeId: t(messages, "parcel.commune") } };
    if (count >= MAX_PARCELS_PER_FARMER) return { ok: false, error: t(messages, "mon.new.too_many") };

    const harvest = new Date(sowing.getTime() + crop.cycleDays * DAY_MS);
    const created = await prisma.parcel.create({
      data: {
        ownerId: user.id,
        name: d.name ?? t(messages, "mon.new.default_name", { crop: crop.nameFr }),
        communeId: commune.id,
        lat: d.lat ?? commune.lat,
        lon: d.lon ?? commune.lon,
        areaHa: Math.round(d.areaHa * 100) / 100,
        plantings: {
          create: {
            cropId: crop.id,
            sowingDate: sowing,
            expectedHarvestDate: harvest,
            status: offsetDays > 0 ? "PLANNED" : "GROWING",
          },
        },
      },
      select: { id: true },
    });
    parcelId = created.id;
  } catch (err) {
    console.error("[parcelles] création", err);
    return { ok: false, error: t(messages, "error.generic") };
  }
  revalidatePath("/app", "layout");
  redirect(`/app/parcelles/${parcelId}`);
}

export type RefreshState =
  | { ok: true; stale: boolean; created: number; at: string }
  | { ok: false; error: "invalid" | "not_found" | "unavailable" | "generic" };

/** Bouton « Actualiser » : météo forcée (hors cache 3 h, anti-rafale 5 min) puis analyse. */
export async function refreshParcelAction(parcelId: unknown): Promise<RefreshState> {
  const user = await requireRole("FARMER");
  const id = idSchema.safeParse(parcelId);
  if (!id.success) return { ok: false, error: "invalid" };
  const parcel = await prisma.parcel.findUnique({ where: { id: id.data }, select: { ownerId: true } });
  if (!parcel || parcel.ownerId !== user.id) return { ok: false, error: "not_found" };
  try {
    const weather = await refreshParcel(id.data, { force: true });
    if (!weather.forecast) return { ok: false, error: "unavailable" };
    const analysis = await analyzeParcel(id.data, { weather });
    revalidatePath(`/app/parcelles/${id.data}`);
    revalidatePath("/app", "layout");
    return { ok: true, stale: weather.stale, created: analysis.created, at: (weather.fetchedAt ?? new Date()).toISOString() };
  } catch (err) {
    console.error("[parcelles] actualisation", { parcelId: id.data }, err);
    return { ok: false, error: "generic" };
  }
}
