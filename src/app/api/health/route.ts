import { prisma } from "@/lib/db";

/** Sonde de disponibilité : base joignable en moins de 3 s. Aucune donnée exposée. */
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3_000;

export async function GET() {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
      }),
    ]);
    return Response.json(
      { status: "ok", db: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[health] base injoignable", err instanceof Error ? err.message : err);
    return Response.json(
      { status: "degraded", db: "down", time: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timer);
  }
}
