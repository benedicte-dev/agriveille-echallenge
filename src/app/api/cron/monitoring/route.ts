import { purgeRateLimits } from "@/lib/security/rate-limit";
import { isAuthorizedBearer, runMonitoring } from "@/server/monitoring";

/**
 * Cron Vercel quotidien (vercel.json, 06:00 UTC = 07:00 au Bénin).
 * Vercel envoie `Authorization: Bearer $CRON_SECRET` ; tout autre appel reçoit 401.
 */
export const dynamic = "force-dynamic";
// Limite de l'offre Hobby sans Fluid compute : 60 s. Le budget laisse 15 s de marge.
export const maxDuration = 60;
const BUDGET_MS = 45_000;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!isAuthorizedBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    if (!process.env.CRON_SECRET) console.error("[cron] CRON_SECRET absent : route fermée");
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const report = await runMonitoring({ budgetMs: BUDGET_MS });
    let purged = 0;
    try {
      purged = await purgeRateLimits();
    } catch (err) {
      console.error("[cron] purge des compteurs échouée", err);
    }
    console.info("[cron] monitoring", { ...report, errors: report.errors.length, purgedRateLimits: purged });
    return Response.json({ ok: true, report, purgedRateLimits: purged }, { headers: NO_STORE });
  } catch (err) {
    console.error("[cron] monitoring échoué", err);
    return Response.json({ ok: false, error: "monitoring_failed" }, { status: 500, headers: NO_STORE });
  }
}
