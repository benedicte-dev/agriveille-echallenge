"use server";
/**
 * Server Actions des redevances. Le montant n'est jamais lu depuis le formulaire.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRequestIp } from "@/lib/security/ip";
import { t } from "@/lib/i18n";
import { pickFields, type ActionState } from "@/server/market/action-state";
import { errorState, notSignedIn, serverMessages } from "@/server/market/i18n";
import { createDeclaration, markPaidAtCounter, payDemo, validateDeclaration } from "./service";

async function context() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { actor: { id: user.id, role: user.role }, ip: await getRequestIp() };
}

function revalidateLevies(declarationId?: string) {
  revalidatePath("/app/redevances");
  if (declarationId) revalidatePath(`/app/quittance/${declarationId}`);
  revalidatePath("/agent/recettes");
  revalidatePath("/agent");
}

export async function createDeclarationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  // Liste blanche : un éventuel champ « amountDueFcfa » envoyé par le client n'est même pas lu.
  const res = await createDeclaration(ctx, pickFields(formData, ["levyRateId", "cropId", "quantityKg", "declaredValueFcfa"]));
  if (!res.ok) return errorState(m, res);
  revalidateLevies(res.data.id);
  redirect(`/app/quittance/${res.data.id}?nouvelle=1`);
}

export async function payDemoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const input = pickFields(formData, ["declarationId"]);
  const res = await payDemo(ctx, input);
  if (!res.ok) return errorState(m, res);
  revalidateLevies(res.data.id);
  return { status: "success", message: t(m, "lev.paid_demo_done") };
}

export async function markPaidAtCounterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const res = await markPaidAtCounter(ctx, pickFields(formData, ["declarationId"]));
  if (!res.ok) return errorState(m, res);
  revalidateLevies(res.data.id);
  return { status: "success", message: t(m, "lev.counter_paid_done") };
}

export async function validateDeclarationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const res = await validateDeclaration(ctx, pickFields(formData, ["declarationId", "decision"]));
  if (!res.ok) return errorState(m, res);
  revalidateLevies(res.data.id);
  return {
    status: "success",
    message: t(m, res.data.status === "VALIDATED" ? "lev.validated_done" : "lev.rejected_done"),
  };
}
