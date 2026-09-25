"use server";
/**
 * Server Actions du marché. Ordre : authentifier → lire les champs en liste blanche → service
 * (validation zod, rôle, propriété) → traduire le résultat → revalider les pages.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRequestIp } from "@/lib/security/ip";
import { t } from "@/lib/i18n";
import { pickFields, type ActionState } from "./action-state";
import { errorState, notSignedIn, serverMessages } from "./i18n";
import { createListing, makeOffer, respondOffer, updateListingStatus, withdrawOffer } from "./service";

function revalidateMarket() {
  revalidatePath("/marche");
  revalidatePath("/app/marche");
  revalidatePath("/app");
  revalidatePath("/acheteur", "layout");
}

async function context() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { actor: { id: user.id, role: user.role }, ip: await getRequestIp() };
}

export async function createListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const input = pickFields(formData, [
    "cropId",
    "quantityKg",
    "pricePerKgFcfa",
    "market",
    "communeId",
    "availableFrom",
    "qualityNote",
    "certification",
  ]);
  const res = await createListing(ctx, input);
  if (!res.ok) return errorState(m, res);
  revalidateMarket();
  redirect("/app/marche?publiee=1");
}

export async function updateListingStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const res = await updateListingStatus(ctx, pickFields(formData, ["listingId", "status"]));
  if (!res.ok) return errorState(m, res);
  revalidateMarket();
  return { status: "success", message: t(m, `mkt.status_changed.${res.data.status}`) };
}

export async function makeOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const res = await makeOffer(ctx, pickFields(formData, ["listingId", "quantityKg", "pricePerKgFcfa", "message"]));
  if (!res.ok) return errorState(m, res);
  revalidateMarket();
  redirect("/acheteur/offres?envoyee=1");
}

export async function respondOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const res = await respondOffer(ctx, pickFields(formData, ["offerId", "decision"]));
  if (!res.ok) return errorState(m, res);
  revalidateMarket();
  return {
    status: "success",
    message: t(m, res.data.status === "ACCEPTED" ? "mkt.offer_accepted" : "mkt.offer_rejected"),
  };
}

export async function withdrawOfferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await serverMessages();
  const ctx = await context();
  if (!ctx) return notSignedIn(m);
  const res = await withdrawOffer(ctx, pickFields(formData, ["offerId"]));
  if (!res.ok) return errorState(m, res);
  revalidateMarket();
  return { status: "success", message: t(m, "mkt.offer_withdrawn") };
}
