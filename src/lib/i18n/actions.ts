"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./config";

const localeSchema = z.enum(LOCALES);

/**
 * Pose le cookie de langue (1 an, SameSite=Lax) et rafraîchit l'arbre.
 * Le cookie n'est pas httpOnly : il ne porte aucun secret et le service
 * worker / le client peuvent le lire pour choisir l'audio hors ligne.
 * La persistance dans User.locale (si connecté) relève de l'orchestrateur.
 */
export async function setLocaleAction(
  locale: Locale,
): Promise<{ ok: true; locale: Locale } | { ok: false; error: "invalid_locale" }> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { ok: false, error: "invalid_locale" };
  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
  return { ok: true, locale: parsed.data };
}
