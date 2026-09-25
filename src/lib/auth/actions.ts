"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getRequestIp } from "@/lib/security/ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { RATE_LIMITS } from "@/lib/security/rate-limit-core";
import {
  fieldErrorsOf,
  formDataToObject,
  fullNameSchema,
  localeSchema,
  newPinSchema,
  optionalIdSchema,
  optionalText,
  phoneSchema,
  pinSchema,
  selfRegisterRoleSchema,
} from "@/lib/validation";
import { homePathForRole } from "./constants";
import { hashPin } from "./pin";
import { createSession, login, logout } from "./session";

/** État renvoyé aux formulaires (useActionState). */
export interface AuthActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const GENERIC_ERROR = "Une erreur est survenue. Réessayez dans un instant.";

const loginSchema = z.object({ phone: phoneSchema, pin: pinSchema });

/** Connexion téléphone + PIN. Champs : phone, pin. Redirige vers l'espace du rôle. */
export async function loginAction(_prev: AuthActionState | undefined, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: "Vérifiez les champs.", fieldErrors: fieldErrorsOf(parsed.error) };

  let target: string;
  try {
    const result = await login(parsed.data.phone, parsed.data.pin);
    if (!result.ok) return { ok: false, error: result.error };
    target = homePathForRole(result.user.role);
  } catch (err) {
    console.error("[auth] loginAction", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  redirect(target);
}

const registerSchema = z
  .object({
    fullName: fullNameSchema,
    phone: phoneSchema,
    pin: newPinSchema,
    pinConfirm: z.string().optional(),
    role: selfRegisterRoleSchema,
    communeId: optionalIdSchema,
    organization: optionalText(120),
    locale: z.preprocess((v) => (v === "" ? undefined : v), localeSchema.optional()),
  })
  .refine((d) => d.pinConfirm === undefined || d.pinConfirm === d.pin, {
    path: ["pinConfirm"],
    error: "Les deux codes PIN ne correspondent pas.",
  });

/**
 * Inscription publique : seulement FARMER ou BUYER (AGENT/ADMIN sont créés par un ADMIN).
 * Champs : fullName, phone, pin, pinConfirm?, role, communeId?, organization?, locale?.
 */
export async function registerAction(_prev: AuthActionState | undefined, formData: FormData): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, error: "Vérifiez les champs.", fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;

  let target: string;
  try {
    const ip = await getRequestIp();
    const limit = await rateLimit(`registerIp:${ip}`, RATE_LIMITS.registerIp);
    if (!limit.allowed) return { ok: false, error: "Trop d'inscriptions depuis cet appareil. Réessayez plus tard." };

    if (data.communeId) {
      const commune = await prisma.commune.findUnique({ where: { id: data.communeId }, select: { id: true } });
      if (!commune) return { ok: false, fieldErrors: { communeId: "Commune inconnue." }, error: "Vérifiez les champs." };
    }

    const existing = await prisma.user.findUnique({ where: { phone: data.phone }, select: { id: true } });
    if (existing) {
      return {
        ok: false,
        error: "Ce numéro ne peut pas être utilisé. Si vous avez déjà un compte, connectez-vous.",
        fieldErrors: { phone: "Numéro déjà utilisé." },
      };
    }

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        pinHash: await hashPin(data.pin),
        role: data.role,
        communeId: data.communeId ?? null,
        organization: data.role === "BUYER" ? (data.organization ?? null) : null,
        locale: data.locale ?? "fr",
        lastLoginAt: new Date(),
      },
      select: { id: true, role: true },
    });
    await createSession(user.id);
    target = homePathForRole(user.role);
  } catch (err) {
    // Course possible sur l'unicité du téléphone (P2002) : même message générique.
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ce numéro ne peut pas être utilisé. Si vous avez déjà un compte, connectez-vous." };
    }
    console.error("[auth] registerAction", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  redirect(target);
}

/** Déconnexion puis retour à l'accueil. */
export async function logoutAction(): Promise<void> {
  try {
    await logout();
  } catch (err) {
    console.error("[auth] logoutAction", err);
  }
  redirect("/");
}
