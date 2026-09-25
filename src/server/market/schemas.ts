/**
 * Schémas zod du marché (module pur). Toute entrée client passe par ici.
 */
import { z } from "zod";
import {
  idSchema,
  optionalIdSchema,
  optionalText,
  pricePerKgFcfaSchema,
  quantityKgSchema,
} from "@/lib/validation";
import { CERTIFICATIONS } from "./constants";

export { CERTIFICATIONS };

export const marketSchema = z.enum(["LOCAL", "EXPORT"], { error: "Choisissez marché local ou export." });
export const listingStatusSchema = z.enum(["OPEN", "RESERVED", "SOLD", "CLOSED"]);

/** Certifications proposées en liste fermée (pas de saisie libre). */
export const certificationSchema = z.preprocess(
  (v) => (v === "" || v === "NONE" || v === null ? undefined : v),
  z.enum(CERTIFICATIONS, { error: "Certification inconnue." }).optional(),
);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date « AAAA-MM-JJ » ; vide → aujourd'hui. Bornée : de la veille à +365 jours. */
export const availableFromSchema = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide." })
    .optional()
    .transform((v, ctx) => {
      const now = new Date();
      if (!v) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const d = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
        ctx.issues.push({ code: "custom", message: "Date invalide.", input: v });
        return z.NEVER;
      }
      if (d.getTime() < now.getTime() - 2 * DAY_MS) {
        ctx.issues.push({ code: "custom", message: "La date ne peut pas être passée.", input: v });
        return z.NEVER;
      }
      if (d.getTime() > now.getTime() + 365 * DAY_MS) {
        ctx.issues.push({ code: "custom", message: "Date trop lointaine (un an au plus).", input: v });
        return z.NEVER;
      }
      return d;
    }),
);

export const createListingSchema = z.object({
  cropId: idSchema,
  quantityKg: quantityKgSchema,
  pricePerKgFcfa: pricePerKgFcfaSchema,
  market: marketSchema,
  /** Absent → commune du profil (résolue côté serveur). */
  communeId: optionalIdSchema,
  availableFrom: availableFromSchema,
  title: optionalText(120),
  qualityNote: optionalText(300),
  certification: certificationSchema,
});
export type CreateListingInput = z.input<typeof createListingSchema>;

export const updateListingStatusSchema = z.object({
  listingId: idSchema,
  status: listingStatusSchema,
});

export const makeOfferSchema = z.object({
  listingId: idSchema,
  quantityKg: quantityKgSchema,
  pricePerKgFcfa: pricePerKgFcfaSchema,
  message: optionalText(300),
});

export const respondOfferSchema = z.object({
  offerId: idSchema,
  decision: z.enum(["ACCEPTED", "REJECTED"], { error: "Décision invalide." }),
});

export const offerIdSchema = z.object({ offerId: idSchema });

export const LISTING_SORTS = ["recent", "price_asc", "price_desc", "quantity_desc"] as const;

/** Filtres de /marche (searchParams) : toute valeur invalide retombe sur le défaut. */
export const listListingsSchema = z.object({
  crop: z.string().trim().regex(/^[a-z0-9-]{2,40}$/).optional().catch(undefined),
  market: marketSchema.optional().catch(undefined),
  commune: idSchema.optional().catch(undefined),
  sort: z.enum(LISTING_SORTS).catch("recent"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(12),
});
export type ListListingsFilters = z.infer<typeof listListingsSchema>;

/** Prend la première valeur d'un searchParams Next (string | string[] | undefined). */
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
