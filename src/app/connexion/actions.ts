"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { GENERIC_LOGIN_ERROR, homePathForRole, login } from "@/lib/auth";
import { formDataToObject, phoneSchema, pinSchema } from "@/lib/validation";
import { nextAllowedForRole, safeNextPath } from "@/server/content/safe-next";

export type LoginErrorCode = "fields" | "phone" | "invalid" | "rate" | "generic";
export interface LoginState {
  error?: LoginErrorCode;
  /** Incrémenté à chaque échec : la page remonte le pavé PIN (vide, focus). */
  attempt: number;
}

const schema = z.object({ phone: phoneSchema, pin: pinSchema, next: z.string().max(600).optional() });

/**
 * Connexion téléphone + PIN avec retour vers ?next= (chemin interne validé).
 * Enveloppe `login()` de @/lib/auth (limitation par IP, verrouillage 15 min,
 * erreur générique) : loginAction ne gère pas `next`, on ne le modifie pas.
 */
export async function loginWithNextAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const attempt = (prev?.attempt ?? 0) + 1;
  const parsed = schema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const phoneBad = parsed.error.issues.some((i) => i.path[0] === "phone");
    return { error: phoneBad ? "phone" : "fields", attempt };
  }

  let target: string;
  try {
    const result = await login(parsed.data.phone, parsed.data.pin);
    if (!result.ok) return { error: result.error === GENERIC_LOGIN_ERROR ? "invalid" : "rate", attempt };
    const next = safeNextPath(parsed.data.next);
    target = next && nextAllowedForRole(next, result.user.role) ? next : homePathForRole(result.user.role);
  } catch (err) {
    console.error("[connexion] échec inattendu", err);
    return { error: "generic", attempt };
  }
  redirect(target);
}
