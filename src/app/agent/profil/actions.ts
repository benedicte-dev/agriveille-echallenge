"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setLocaleAction } from "@/lib/i18n/actions";
import { localeSchema } from "@/lib/validation";

export type StaffLocaleResult = { ok: true } | { ok: false; error: "invalid_locale" | "generic" };

/** Change la langue d'un agent ou d'un admin : User.locale (persisté) puis cookie. */
export async function updateStaffLocaleAction(locale: unknown): Promise<StaffLocaleResult> {
  const user = await requireRole("AGENT");
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { ok: false, error: "invalid_locale" };
  try {
    await prisma.user.update({ where: { id: user.id }, data: { locale: parsed.data }, select: { id: true } });
  } catch (err) {
    console.error("[profil agent] langue", { userId: user.id }, err);
    return { ok: false, error: "generic" };
  }
  const res = await setLocaleAction(parsed.data);
  return res.ok ? { ok: true } : { ok: false, error: "invalid_locale" };
}
