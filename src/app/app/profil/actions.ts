"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setLocaleAction } from "@/lib/i18n/actions";
import { localeSchema } from "@/lib/validation";

export type ProfileLocaleResult = { ok: true } | { ok: false; error: "invalid_locale" | "generic" };

/** Change la langue du fermier : User.locale (persisté) puis cookie de langue. */
export async function updateLocaleAction(locale: unknown): Promise<ProfileLocaleResult> {
  const user = await requireRole("FARMER");
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { ok: false, error: "invalid_locale" };
  try {
    await prisma.user.update({ where: { id: user.id }, data: { locale: parsed.data }, select: { id: true } });
  } catch (err) {
    console.error("[profil] langue", { userId: user.id }, err);
    return { ok: false, error: "generic" };
  }
  const res = await setLocaleAction(parsed.data);
  return res.ok ? { ok: true } : { ok: false, error: "invalid_locale" };
}
