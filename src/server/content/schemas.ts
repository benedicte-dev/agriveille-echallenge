/**
 * Schémas zod des formulaires du CMS (/admin). Module pur : aucune I/O.
 * Toute Server Action du CMS parse son FormData avec l'un de ces schémas.
 */
import { z } from "zod";
import {
  idSchema,
  monthsSchema,
  optionalIdSchema,
  optionalText,
  pricePerKgFcfaSchema,
  requiredText,
  roleSchema,
  slugSchema,
} from "@/lib/validation";

/** FormData → objet : texte seul, sauf les clés `multi` (tableaux, ex. cases à cocher). */
export function formToObject(fd: FormData, multi: readonly string[] = []): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue;
    if (multi.includes(key)) {
      const arr = (out[key] as string[] | undefined) ?? [];
      arr.push(value);
      out[key] = arr;
    } else if (!(key in out)) {
      out[key] = value;
    }
  }
  for (const key of multi) out[key] ??= [];
  return out;
}

/** Case à cocher HTML : présente (« on ») = vrai, absente = faux. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === "1", z.boolean());

const optionalLocalized = (max: number) => optionalText(max);

/** Nombre décimal facultatif (champ vide → null). */
function optionalNumber(min: number, max: number) {
  return z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z
      .number({ error: "Nombre invalide." })
      .min(min, { error: `Minimum ${min}.` })
      .max(max, { error: `Maximum ${max}.` })
      .nullable(),
  );
}

function requiredNumber(min: number, max: number, int = false) {
  const base = z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z.number({ error: "Nombre requis." }).min(min, { error: `Minimum ${min}.` }).max(max, { error: `Maximum ${max}.` }),
  );
  return int ? base.refine((n) => Number.isInteger(n), { error: "Nombre entier attendu." }) : base;
}

const months = z.preprocess(
  (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]),
  monthsSchema,
);

/**
 * Clés de pictogrammes de culture (= clés de `cropIcons`, src/components/icons/crops.tsx).
 * Le seed stocke des clés anglaises (« maize ») que getCropIcon ne résout pas :
 * elles sont acceptées et converties à l'enregistrement.
 */
export const CROP_ICON_KEYS = [
  "mais",
  "manioc",
  "igname",
  "coton",
  "soja",
  "riz",
  "anacarde",
  "ananas",
  "niebe",
  "tomate",
  "piment",
  "arachide",
  "generique",
] as const;
export type CropIconKey = (typeof CROP_ICON_KEYS)[number];

const ICON_ALIASES: Record<string, CropIconKey> = {
  maize: "mais",
  cassava: "manioc",
  yam: "igname",
  cotton: "coton",
  soybean: "soja",
  rice: "riz",
  cashew: "anacarde",
  pineapple: "ananas",
  cowpea: "niebe",
  tomato: "tomate",
  chili: "piment",
  peanut: "arachide",
  generic: "generique",
};

/** Clé stockée (éventuellement héritée) → clé de pictogramme connue. */
export function normalizeCropIcon(value: string | null | undefined): CropIconKey {
  const v = (value ?? "").trim().toLowerCase();
  if ((CROP_ICON_KEYS as readonly string[]).includes(v)) return v as CropIconKey;
  return ICON_ALIASES[v] ?? "generique";
}

// ── Cultures ──────────────────────────────────────────────────────────────

export const cropSchema = z
  .object({
    id: optionalIdSchema,
    slug: slugSchema,
    nameFr: requiredText(2, 80),
    nameFon: optionalLocalized(120),
    nameYo: optionalLocalized(120),
    icon: z.preprocess(
      (v) => (typeof v === "string" && v in ICON_ALIASES ? ICON_ALIASES[v] : v),
      z.enum(CROP_ICON_KEYS, { error: "Pictogramme inconnu." }),
    ),
    cycleDays: requiredNumber(20, 1000, true),
    sowingMonths: months,
    harvestMonths: months,
    minRainMm: requiredNumber(0, 5000, true),
    optimalTempMin: requiredNumber(-5, 50),
    optimalTempMax: requiredNumber(-5, 50),
    notes: optionalText(2000),
    autoTranslate: checkbox,
  })
  .refine((d) => d.optimalTempMin <= d.optimalTempMax, {
    path: ["optimalTempMax"],
    error: "La température maximale doit être supérieure ou égale à la minimale.",
  })
  .refine((d) => d.sowingMonths.length > 0, { path: ["sowingMonths"], error: "Cochez au moins un mois de semis." })
  .refine((d) => d.harvestMonths.length > 0, { path: ["harvestMonths"], error: "Cochez au moins un mois de récolte." });
export type CropInput = z.infer<typeof cropSchema>;

// ── Ravageurs et maladies ─────────────────────────────────────────────────

export const pestSchema = z
  .object({
    id: optionalIdSchema,
    slug: slugSchema,
    kind: z.enum(["PEST", "DISEASE"], { error: "Choisissez ravageur ou maladie." }),
    nameFr: requiredText(2, 120),
    nameFon: optionalLocalized(200),
    nameYo: optionalLocalized(200),
    cropIds: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(idSchema).max(50)),
    symptomsFr: requiredText(10, 3000),
    symptomsFon: optionalLocalized(5000),
    symptomsYo: optionalLocalized(5000),
    preventionFr: requiredText(10, 3000),
    preventionFon: optionalLocalized(5000),
    preventionYo: optionalLocalized(5000),
    treatmentFr: requiredText(10, 3000),
    treatmentFon: optionalLocalized(5000),
    treatmentYo: optionalLocalized(5000),
    riskTempMin: optionalNumber(-5, 50),
    riskTempMax: optionalNumber(-5, 50),
    riskHumidityMin: optionalNumber(0, 100),
    autoTranslate: checkbox,
  })
  .refine((d) => d.riskTempMin === null || d.riskTempMax === null || d.riskTempMin <= d.riskTempMax, {
    path: ["riskTempMax"],
    error: "La borne haute doit être supérieure ou égale à la borne basse.",
  });
export type PestInput = z.infer<typeof pestSchema>;

// ── Fiches réglementaires ─────────────────────────────────────────────────

export const REGULATION_CATEGORIES = ["PHYTO", "SEEDS", "EXPORT", "TAX", "LAND", "ORGANIC"] as const;

export const regulationSchema = z.object({
  id: optionalIdSchema,
  slug: slugSchema,
  category: z.enum(REGULATION_CATEGORIES, { error: "Catégorie inconnue." }),
  titleFr: requiredText(5, 160),
  titleFon: optionalLocalized(300),
  titleYo: optionalLocalized(300),
  summaryFr: requiredText(10, 400),
  summaryFon: optionalLocalized(800),
  summaryYo: optionalLocalized(800),
  bodyFr: requiredText(20, 20_000),
  bodyFon: optionalLocalized(40_000),
  bodyYo: optionalLocalized(40_000),
  sourceRef: optionalText(300),
  published: checkbox,
  autoTranslate: checkbox,
});
export type RegulationInput = z.infer<typeof regulationSchema>;

export const publishSchema = z.object({ id: idSchema, published: checkbox });

// ── Prix de référence ─────────────────────────────────────────────────────

export const referencePriceSchema = z.object({
  id: optionalIdSchema,
  cropId: idSchema,
  communeId: optionalIdSchema,
  market: z.enum(["LOCAL", "EXPORT"], { error: "Marché inconnu." }),
  pricePerKgFcfa: pricePerKgFcfaSchema,
  observedAt: z.iso.date({ error: "Date invalide (AAAA-MM-JJ)." }).refine(
    (d) => {
      const t = Date.parse(`${d}T12:00:00Z`);
      return t <= Date.now() + 86_400_000 && t >= Date.parse("2000-01-01");
    },
    { error: "La date d'observation ne peut pas être dans le futur." },
  ),
});
export type ReferencePriceInput = z.infer<typeof referencePriceSchema>;

// ── Barème des redevances ─────────────────────────────────────────────────

export const levyRateSchema = z
  .object({
    id: optionalIdSchema,
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, { error: "Code : majuscules, chiffres et tirets (ex. MARCHE-KG)." })
      .min(2)
      .max(40),
    labelFr: requiredText(4, 160),
    labelFon: optionalLocalized(300),
    labelYo: optionalLocalized(300),
    basis: z.enum(["PER_KG", "PERCENT_VALUE", "FLAT"], { error: "Base de calcul inconnue." }),
    rate: requiredNumber(0, 10_000_000, true),
    active: checkbox,
    autoTranslate: checkbox,
  })
  .refine((d) => d.basis !== "PERCENT_VALUE" || d.rate <= 10_000, {
    path: ["rate"],
    error: "Un pourcentage s'exprime en points de base : 10 000 au maximum (= 100 %).",
  });
export type LevyRateInput = z.infer<typeof levyRateSchema>;

export const levyToggleSchema = z.object({ id: idSchema, active: checkbox });

// ── Utilisateurs ──────────────────────────────────────────────────────────

export const userActiveSchema = z.object({ userId: idSchema, active: checkbox });
export const userRoleSchema = z.object({ userId: idSchema, role: roleSchema });

export const deleteSchema = z.object({ id: idSchema });

// ── Filtres (searchParams) ────────────────────────────────────────────────

export const auditFilterSchema = z.object({
  entity: z.string().trim().max(60).regex(/^[A-Za-z]*$/).optional().catch(undefined),
  action: z.string().trim().max(100).regex(/^[a-z0-9._-]*$/i).optional().catch(undefined),
  actor: z.union([idSchema, z.literal("")]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const userFilterSchema = z.object({
  role: z.union([roleSchema, z.literal("")]).optional().catch(undefined),
  q: z.string().trim().max(60).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

// ── Règles métier pures ───────────────────────────────────────────────────

export type RoleChangeCheck = { ok: true } | { ok: false; reason: "self_demote" | "self_deactivate" | "same_role" | "last_admin" };

/**
 * Garde-fous du changement de rôle : un ADMIN ne peut pas se rétrograder
 * lui-même, et on ne retire jamais le dernier ADMIN actif.
 */
export function checkRoleChange(input: {
  actorId: string;
  targetId: string;
  currentRole: z.infer<typeof roleSchema>;
  nextRole: z.infer<typeof roleSchema>;
  activeAdminCount: number;
}): RoleChangeCheck {
  if (input.currentRole === input.nextRole) return { ok: false, reason: "same_role" };
  if (input.actorId === input.targetId && input.nextRole !== "ADMIN") return { ok: false, reason: "self_demote" };
  if (input.currentRole === "ADMIN" && input.nextRole !== "ADMIN" && input.activeAdminCount <= 1) {
    return { ok: false, reason: "last_admin" };
  }
  return { ok: true };
}

export function checkActiveChange(input: {
  actorId: string;
  targetId: string;
  targetRole: z.infer<typeof roleSchema>;
  nextActive: boolean;
  activeAdminCount: number;
}): RoleChangeCheck {
  if (input.nextActive) return { ok: true };
  if (input.actorId === input.targetId) return { ok: false, reason: "self_deactivate" };
  if (input.targetRole === "ADMIN" && input.activeAdminCount <= 1) return { ok: false, reason: "last_admin" };
  return { ok: true };
}
