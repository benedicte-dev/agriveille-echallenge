import "server-only";

import { prisma } from "@/lib/db";

export interface SmsOutboxRow {
  id: string;
  toPhone: string;
  body: string;
  lang: string;
  createdAt: Date;
  alertTitle: string | null;
}

/**
 * Derniers messages du simulateur SMS (DÉMO — SPEC : aucun SMS n'est réellement envoyé).
 * Filtrable par numéro (recherche par fin de numéro acceptée pour rester pratique en démo).
 */
export async function listSmsOutbox(opts: { phone?: string; take?: number } = {}): Promise<SmsOutboxRow[]> {
  const phone = opts.phone?.trim();
  const rows = await prisma.smsOutbox.findMany({
    where: phone ? { toPhone: { contains: phone } } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 50, 200),
    select: { id: true, toPhone: true, body: true, lang: true, createdAt: true, alert: { select: { titleFr: true } } },
  });
  return rows.map((r) => ({ id: r.id, toPhone: r.toPhone, body: r.body, lang: r.lang, createdAt: r.createdAt, alertTitle: r.alert?.titleFr ?? null }));
}
