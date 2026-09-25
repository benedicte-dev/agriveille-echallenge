/**
 * Schémas zod réutilisables (zod v4). Modules purs : aucun accès serveur.
 * Toute entrée (Server Action, route handler, searchParams) passe par un schéma.
 */
import { z } from "zod";
import { normalizeBeninPhone } from "@/lib/auth/phone";

// ── Référentiels ──────────────────────────────────────────────────────────

export const BENIN_DEPARTMENTS = [
  "Alibori",
  "Atacora",
  "Atlantique",
  "Borgou",
  "Collines",
  "Couffo",
  "Donga",
  "Littoral",
  "Mono",
  "Ouémé",
  "Plateau",
  "Zou",
] as const;
export type BeninDepartment = (typeof BENIN_DEPARTMENTS)[number];
export const departmentSchema = z.enum(BENIN_DEPARTMENTS);

/** Emprise approximative du territoire béninois (avec marge). */
export const BENIN_BOUNDS = { latMin: 6.0, latMax: 12.5, lonMin: 0.7, lonMax: 3.9 } as const;

export const LOCALES = ["fr", "fon", "yo"] as const;
export const localeSchema = z.enum(LOCALES);

export const ROLES = ["FARMER", "BUYER", "AGENT", "ADMIN"] as const;
export const roleSchema = z.enum(ROLES);
/** Rôles autorisés à l'inscription publique. */
export const selfRegisterRoleSchema = z.enum(["FARMER", "BUYER"], {
  error: "Choisissez « Producteur » ou « Acheteur ».",
});

// ── Identité ──────────────────────────────────────────────────────────────

export const phoneSchema = z
  .string({ error: "Numéro de téléphone requis." })
  .trim()
  .max(32, { error: "Numéro de téléphone invalide." })
  .transform((value, ctx) => {
    const normalized = normalizeBeninPhone(value);
    if (!normalized) {
      ctx.issues.push({
        code: "custom",
        message: "Numéro invalide : 10 chiffres commençant par 01 (ex. 01 97 00 00 01).",
        input: value,
      });
      return z.NEVER;
    }
    return normalized;
  });

export const pinSchema = z
  .string({ error: "Code PIN requis." })
  .regex(/^\d{4}$/, { error: "Le code PIN comporte 4 chiffres." });

const TRIVIAL_PINS = new Set(["0123", "1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654", "6543", "5432", "4321", "3210"]);

/** PIN choisi à l'inscription : refuse les suites et les chiffres répétés. */
export const newPinSchema = pinSchema.refine((pin) => !/^(\d)\1{3}$/.test(pin) && !TRIVIAL_PINS.has(pin), {
  error: "Code trop simple : évitez 1234, 0000 et les suites.",
});

export const fullNameSchema = z
  .string({ error: "Nom requis." })
  .trim()
  .min(2, { error: "Nom trop court." })
  .max(80, { error: "Nom trop long (80 caractères max.)." })
  .regex(/^[\p{L}\p{M}' .\-]+$/u, { error: "Le nom ne doit contenir que des lettres." });

// ── Identifiants, pagination ──────────────────────────────────────────────

export const idSchema = z.cuid({ error: "Identifiant invalide." });
export const optionalIdSchema = z.preprocess((v) => (v === "" || v === null ? undefined : v), idSchema.optional());

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "Identifiant d'URL invalide (minuscules, chiffres, tirets)." });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});
export type Pagination = z.infer<typeof paginationSchema>;
export function toSkipTake({ page, pageSize }: Pagination): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// ── Géographie ────────────────────────────────────────────────────────────

export const latSchema = z.coerce
  .number({ error: "Latitude invalide." })
  .min(BENIN_BOUNDS.latMin, { error: "Position hors du Bénin." })
  .max(BENIN_BOUNDS.latMax, { error: "Position hors du Bénin." });

export const lonSchema = z.coerce
  .number({ error: "Longitude invalide." })
  .min(BENIN_BOUNDS.lonMin, { error: "Position hors du Bénin." })
  .max(BENIN_BOUNDS.lonMax, { error: "Position hors du Bénin." });

export const coordinatesSchema = z.object({ lat: latSchema, lon: lonSchema });
export type Coordinates = z.infer<typeof coordinatesSchema>;

export const radiusKmSchema = z.coerce.number().min(1).max(100);
export const areaHaSchema = z.coerce
  .number({ error: "Surface invalide." })
  .positive({ error: "La surface doit être positive." })
  .max(1000, { error: "Surface trop grande (1000 ha max.)." });

// ── Montants et quantités (entiers) ───────────────────────────────────────

/** Montant en FCFA, entier, 0 à 10 milliards. */
export const amountFcfaSchema = z.coerce
  .number({ error: "Montant invalide." })
  .int({ error: "Le montant doit être un nombre entier de FCFA." })
  .min(0, { error: "Le montant ne peut pas être négatif." })
  .max(10_000_000_000, { error: "Montant trop élevé." });

/** Prix unitaire en FCFA/kg (1 à 1 000 000). */
export const pricePerKgFcfaSchema = z.coerce
  .number({ error: "Prix invalide." })
  .int({ error: "Le prix doit être un nombre entier de FCFA." })
  .min(1, { error: "Le prix doit être positif." })
  .max(1_000_000, { error: "Prix trop élevé." });

/** Quantité en kg, entier, 1 kg à 10 000 t. */
export const quantityKgSchema = z.coerce
  .number({ error: "Quantité invalide." })
  .int({ error: "La quantité doit être un nombre entier de kg." })
  .min(1, { error: "La quantité doit être d'au moins 1 kg." })
  .max(10_000_000, { error: "Quantité trop élevée." });

export const monthSchema = z.coerce.number().int().min(1).max(12);
export const monthsSchema = z.array(monthSchema).max(12).transform((m) => [...new Set(m)].sort((a, b) => a - b));

// ── Texte libre ───────────────────────────────────────────────────────────

/** Texte court optionnel : chaîne vide → undefined. */
export function optionalText(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, { error: `Texte trop long (${max} caractères max.).` }).optional(),
  );
}

export function requiredText(min: number, max: number) {
  return z
    .string({ error: "Champ requis." })
    .trim()
    .min(min, { error: `Au moins ${min} caractères.` })
    .max(max, { error: `Texte trop long (${max} caractères max.).` });
}

// ── Utilitaires ───────────────────────────────────────────────────────────

/** Transforme les erreurs zod en { champ: premier message }. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Récupère les champs texte d'un FormData (les fichiers sont ignorés). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !(key in out)) out[key] = value;
  }
  return out;
}
