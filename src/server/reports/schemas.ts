/**
 * Schémas d'entrée du service de signalements (zod v4). Module pur : aucun
 * accès serveur, testé seul.
 */
import { z } from "zod";
import { idSchema, latSchema, lonSchema, optionalIdSchema, optionalText, radiusKmSchema } from "@/lib/validation";

/** Chaîne vide ou null → undefined (champs de formulaire facultatifs). */
const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const REPORT_TEXT_MAX = 1000;
export const REVIEW_NOTE_MAX = 500;
export const DEFAULT_OUTBREAK_RADIUS_KM = 15;

/** Identifiant d'envoi généré par le client (crypto.randomUUID) : idempotence de la file. */
export const clientIdSchema = z.uuid({ error: "Identifiant d'envoi invalide." });

export const voiceLangSchema = z.enum(["fr", "fon", "yo"]);

/**
 * Entrée de createReport (hors photo, contrôlée à part par signature magique).
 * Lieu : une parcelle de l'utilisatrice, des coordonnées GPS au Bénin, ou une
 * commune choisie dans la liste (E7 : géolocalisation refusée, sans parcelle).
 */
export const createReportSchema = z
  .object({
    clientId: z.preprocess(blankToUndefined, clientIdSchema.optional()),
    parcelId: optionalIdSchema,
    communeId: optionalIdSchema,
    lat: z.preprocess(blankToUndefined, latSchema.optional()),
    lon: z.preprocess(blankToUndefined, lonSchema.optional()),
    pestId: optionalIdSchema,
    description: optionalText(REPORT_TEXT_MAX),
    voiceTranscript: optionalText(REPORT_TEXT_MAX),
    voiceLang: z.preprocess(blankToUndefined, voiceLangSchema.optional()),
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lon === undefined)) {
      ctx.addIssue({ code: "custom", path: ["lat"], message: "Position incomplète." });
    }
    const hasPoint = v.lat !== undefined && v.lon !== undefined;
    if (!v.parcelId && !hasPoint && !v.communeId) {
      ctx.addIssue({ code: "custom", path: ["place"], message: "Choisissez un champ ou votre position." });
    }
  });

export type CreateReportInput = z.input<typeof createReportSchema> & {
  /** Photo brute (Blob/File) : taille et signature vérifiées par readImageFile. */
  photo?: Blob | null;
};
export type CreateReportData = z.output<typeof createReportSchema>;

/** Au moins une preuve : photo, dictée ou description (E12). */
export function hasEvidence(data: Pick<CreateReportData, "description" | "voiceTranscript">, hasPhoto: boolean): boolean {
  return hasPhoto || Boolean(data.description) || Boolean(data.voiceTranscript);
}

export const reviewDecisionSchema = z.enum(["CONFIRMED", "REJECTED"], { error: "Décision invalide." });

export const reviewReportSchema = z
  .object({
    decision: reviewDecisionSchema,
    pestId: optionalIdSchema,
    note: optionalText(REVIEW_NOTE_MAX),
    radiusKm: z.preprocess(blankToUndefined, radiusKmSchema.optional()),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "REJECTED" && !v.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Expliquez en quelques mots pourquoi le signalement est rejeté." });
    }
  });

export type ReviewReportInput = z.input<typeof reviewReportSchema>;
export type ReviewReportData = z.output<typeof reviewReportSchema>;

export const reportStatusSchema = z.enum(["PENDING", "CONFIRMED", "REJECTED"]);

export const listReportsSchema = z.object({
  status: z.preprocess(blankToUndefined, reportStatusSchema.optional()).catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});
export type ListReportsInput = { status?: string | null; page?: number | string | null; pageSize?: number | string | null };

export const reportIdSchema = idSchema;
