"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { formDataToObject } from "@/lib/validation";
import { isReportError, reviewReport, type ReportErrorCode } from "@/server/reports";

export type ReviewActionState =
  | { status: "idle" }
  | {
      status: "ok";
      decision: "CONFIRMED" | "REJECTED";
      recipients?: number;
      severity?: "INFO" | "WARNING" | "CRITICAL";
      confirmedNearby?: number;
      radiusKm?: number;
    }
  | { status: "error"; code: ReportErrorCode | "INTERNAL"; message: string; fields?: Record<string, string> };

/**
 * Décision d'un agent sur un signalement (confirmer → alerte de zone, ou
 * rejeter avec une note). Rôle revérifié ici, puis par le service.
 */
export async function reviewReportAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const agent = await requireRole("AGENT");
  const raw = formDataToObject(formData);
  const id = raw.reportId ?? "";
  const decision = raw.decision;
  if (decision !== "CONFIRMED" && decision !== "REJECTED") {
    return { status: "error", code: "INVALID", message: "Décision invalide." };
  }
  try {
    const result = await reviewReport(agent, id, {
      decision,
      pestId: raw.pestId,
      note: raw.note,
      radiusKm: raw.radiusKm,
    });
    revalidatePath(`/agent/signalements/${id}`);
    revalidatePath("/agent/signalements");
    if (result.decision === "REJECTED") return { status: "ok", decision: "REJECTED" };
    return {
      status: "ok",
      decision: "CONFIRMED",
      recipients: result.recipients,
      severity: result.severity,
      confirmedNearby: result.confirmedNearby,
      radiusKm: result.radiusKm,
    };
  } catch (err) {
    if (isReportError(err)) {
      if (err.code === "ALREADY_REVIEWED") revalidatePath(`/agent/signalements/${id}`);
      return { status: "error", code: err.code, message: err.message, fields: err.fields };
    }
    console.error("[agent/signalements] décision impossible", { id }, err);
    return { status: "error", code: "INTERNAL", message: "Un problème est arrivé. Réessayez." };
  }
}
