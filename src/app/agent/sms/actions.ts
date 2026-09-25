"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { ussdRespond } from "@/server/content/ussd";
import { ussdProviderFor } from "@/server/content/ussd-provider";

const stepSchema = z.object({
  farmerId: idSchema,
  path: z.array(z.string().trim().regex(/^[0-9]{1,2}$/)).max(20),
});

export interface UssdStepResult {
  ok: boolean;
  text: string;
  end: boolean;
  path: string[];
  error?: string;
}

/**
 * Rejoue le chemin USSD pour le fermier de démonstration choisi. Réservé
 * AGENT/ADMIN : la simulation lit de vraies données (alertes, météo, prix)
 * mais n'envoie jamais de SMS réel (DÉMO).
 */
export async function ussdStepAction(input: unknown): Promise<UssdStepResult> {
  await requireRole("AGENT");
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, text: "Requête invalide.", end: true, path: [] };

  const farmer = await prisma.user.findFirst({
    where: { id: parsed.data.farmerId, role: "FARMER" },
    select: { id: true },
  });
  if (!farmer) return { ok: false, text: "Numéro de démonstration introuvable.", end: true, path: [], error: "not_found" };

  const result = await ussdRespond(parsed.data.path, ussdProviderFor(farmer.id));
  return { ok: true, text: result.text, end: result.end, path: result.path };
}
