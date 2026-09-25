/**
 * Schémas zod des redevances (module pur). Aucun montant n'est accepté du client.
 */
import { z } from "zod";
import { idSchema, optionalIdSchema } from "@/lib/validation";
import { MAX_DECLARED_VALUE_FCFA, MAX_QUANTITY_KG } from "./compute";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const createDeclarationSchema = z
  .object({
    levyRateId: idSchema,
    cropId: optionalIdSchema,
    quantityKg: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "Quantité invalide." })
        .int({ error: "La quantité doit être un nombre entier de kg." })
        .min(1, { error: "La quantité doit être d'au moins 1 kg." })
        .max(MAX_QUANTITY_KG, { error: "Quantité trop élevée." })
        .optional(),
    ),
    declaredValueFcfa: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "Valeur invalide." })
        .int({ error: "La valeur doit être un nombre entier de FCFA." })
        .min(1, { error: "La valeur doit être positive." })
        .max(MAX_DECLARED_VALUE_FCFA, { error: "Valeur trop élevée." })
        .optional(),
    ),
  })
  // Défense en profondeur : un champ « montant » envoyé par le client est rejeté, pas ignoré en silence.
  .strict();

export const declarationIdSchema = z.object({ declarationId: idSchema });

export const validateDeclarationSchema = z.object({
  declarationId: idSchema,
  decision: z.enum(["VALIDATED", "REJECTED"], { error: "Décision invalide." }),
});

export const revenueFiltersSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).catch(12),
});
