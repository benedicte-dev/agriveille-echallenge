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
  error?: "invalid" | "not_found";
}

/**
 * Rejoue le chemin USSD pour le fermier de démonstration choisi. Réservé
 * AGENT/ADMIN : la simulation lit de vraies données (alertes, météo, prix)
 * mais n'envoie jamais de SMS réel (DÉMO). Les écritures éventuelles
 * (accusé, signalement) sont journalisées au nom de l'agent.
 */
export async function ussdStepAction(input: unknown): Promise<UssdStepResult> {
  const agent = await requireRole("AGENT");
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, text: "", end: true, path: [], error: "invalid" };

  const farmer = await prisma.user.findFirst({
    where: { id: parsed.data.farmerId, role: "FARMER", isActive: true },
    select: { id: true },
  });
  if (!farmer) return { ok: false, text: "", end: true, path: [], error: "not_found" };

  const result = await ussdRespond(parsed.data.path, ussdProviderFor(farmer.id, agent.id));
  return { ok: true, text: result.text, end: result.end, path: result.path };
}
