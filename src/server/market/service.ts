import "server-only";
/**
 * Mutations du marché. Chaque fonction reçoit l'acteur authentifié (jamais un id venu du client),
 * valide l'entrée avec zod, vérifie rôle et propriété, puis agit. Aucun appel réseau en transaction.
 *
 * Concurrence : les opérations qui dépendent de l'état d'une annonce (faire une offre, accepter)
 * verrouillent la ligne `Listing` (SELECT … FOR UPDATE) dans la transaction. Deux acceptations
 * simultanées sur la même annonce sont donc sérialisées : la seconde voit RESERVED et échoue.
 */
import type { ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fieldErrorsOf } from "@/lib/validation";
import { limitScope } from "@/lib/security/rate-limit";
import { err, ok, type Result, type ServiceContext } from "./result";
import {
  createListingSchema,
  makeOfferSchema,
  offerIdSchema,
  respondOfferSchema,
  updateListingStatusSchema,
} from "./schemas";
import { canTransitionListing, checkOfferAllowed, checkRespondAllowed, defaultListingTitle } from "./rules";

const CERT_LABELS: Record<string, string> = {
  BIO: "Agriculture biologique",
  GLOBALGAP: "GlobalG.A.P.",
  FAIRTRADE: "Commerce équitable",
};

type Tx = Prisma.TransactionClient;

interface LockedListing {
  id: string;
  sellerId: string;
  status: ListingStatus;
  quantityKg: number;
}

async function lockListing(tx: Tx, listingId: string): Promise<LockedListing | null> {
  const rows = await tx.$queryRaw<LockedListing[]>`
    SELECT "id", "sellerId", "status"::text AS "status", "quantityKg"
    FROM "Listing" WHERE "id" = ${listingId} FOR UPDATE`;
  return rows[0] ?? null;
}

/** Erreur métier levée dans une transaction pour l'annuler proprement. */
class Abort extends Error {
  constructor(readonly result: ReturnType<typeof err>) {
    super(result.code);
  }
}

async function run<T>(label: string, fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Abort) return e.result;
    console.error(`[market] ${label}`, e);
    return err("unavailable");
  }
}

// ── Annonces ──────────────────────────────────────────────────────────────

export async function createListing(ctx: ServiceContext, input: unknown): Promise<Result<{ id: string }>> {
  if (ctx.actor.role !== "FARMER") return err("forbidden");
  const parsed = createListingSchema.safeParse(input);
  if (!parsed.success) return err("invalid", undefined, fieldErrorsOf(parsed.error));
  const d = parsed.data;

  return run("createListing", async () => {
    const [crop, user] = await Promise.all([
      prisma.crop.findUnique({ where: { id: d.cropId }, select: { id: true, nameFr: true } }),
      prisma.user.findUnique({ where: { id: ctx.actor.id }, select: { communeId: true } }),
    ]);
    if (!crop) return err("invalid", undefined, { cropId: "Culture inconnue." });
    const communeId = d.communeId ?? user?.communeId ?? null;
    if (!communeId) return err("invalid", "mkt.err.commune_required", { communeId: "Choisissez la commune." });
    const commune = await prisma.commune.findUnique({ where: { id: communeId }, select: { id: true } });
    if (!commune) return err("invalid", undefined, { communeId: "Commune inconnue." });

    const listing = await prisma.listing.create({
      data: {
        sellerId: ctx.actor.id,
        cropId: crop.id,
        title: d.title ?? defaultListingTitle(crop.nameFr, d.quantityKg),
        quantityKg: d.quantityKg,
        pricePerKgFcfa: d.pricePerKgFcfa,
        market: d.market,
        communeId,
        availableFrom: d.availableFrom,
        qualityNote: d.qualityNote ?? null,
        certification: d.certification ? CERT_LABELS[d.certification] : null,
        status: "OPEN",
      },
      select: { id: true },
    });
    return ok(listing);
  });
}

/** Le vendeur change le statut de son annonce (fermer, rouvrir, marquer vendue). */
export async function updateListingStatus(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ id: string; status: ListingStatus }>> {
  if (ctx.actor.role !== "FARMER") return err("forbidden");
  const parsed = updateListingStatusSchema.safeParse(input);
  if (!parsed.success) return err("invalid", undefined, fieldErrorsOf(parsed.error));
  const { listingId, status } = parsed.data;

  return run("updateListingStatus", () =>
    prisma.$transaction(async (tx) => {
      const listing = await lockListing(tx, listingId);
      // Absente ou appartenant à un autre : même réponse (anti-IDOR).
      if (!listing || listing.sellerId !== ctx.actor.id) return err("not_found");
      if (!canTransitionListing(listing.status, status)) return err("conflict", "mkt.err.bad_transition");
      await tx.listing.update({ where: { id: listingId }, data: { status }, select: { id: true } });
      if (status === "CLOSED") {
        // Les offres encore en attente n'ont plus d'objet.
        await tx.offer.updateMany({ where: { listingId, status: "PENDING" }, data: { status: "REJECTED" } });
      }
      return ok({ id: listingId, status });
    }),
  );
}

// ── Offres ────────────────────────────────────────────────────────────────

export async function makeOffer(ctx: ServiceContext, input: unknown): Promise<Result<{ id: string }>> {
  if (ctx.actor.role !== "BUYER") return err("forbidden");
  const parsed = makeOfferSchema.safeParse(input);
  if (!parsed.success) return err("invalid", undefined, fieldErrorsOf(parsed.error));
  const d = parsed.data;

  return run("makeOffer", async () => {
    const limit = await limitScope("offer", ctx.actor.id);
    if (!limit.allowed) return err("rate_limited");

    return prisma.$transaction(async (tx) => {
      const listing = await lockListing(tx, d.listingId);
      if (!listing) return err("not_found");
      const refusal = checkOfferAllowed(listing, ctx.actor.id, d.quantityKg);
      if (refusal) return err(refusal === "mkt.err.quantity_exceeds" ? "invalid" : "conflict", refusal);

      // Double soumission (double clic, rejeu réseau) : une seule offre en attente par acheteur et annonce.
      // Le verrou de l'annonce rend ce contrôle sûr face aux requêtes simultanées.
      const existing = await tx.offer.findFirst({
        where: { listingId: d.listingId, buyerId: ctx.actor.id, status: "PENDING" },
        select: { id: true },
      });
      if (existing) return err("conflict", "mkt.err.offer_exists");

      const offer = await tx.offer.create({
        data: {
          listingId: d.listingId,
          buyerId: ctx.actor.id,
          quantityKg: d.quantityKg,
          pricePerKgFcfa: d.pricePerKgFcfa,
          message: d.message ?? null,
          status: "PENDING",
        },
        select: { id: true },
      });
      return ok(offer);
    });
  });
}

/**
 * Le vendeur accepte ou refuse une offre. Accepter : l'offre passe ACCEPTED, l'annonce RESERVED,
 * les autres offres en attente sont refusées, le tout dans une transaction qui verrouille l'annonce.
 */
export async function respondOffer(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ offerId: string; status: "ACCEPTED" | "REJECTED" }>> {
  if (ctx.actor.role !== "FARMER") return err("forbidden");
  const parsed = respondOfferSchema.safeParse(input);
  if (!parsed.success) return err("invalid", undefined, fieldErrorsOf(parsed.error));
  const { offerId, decision } = parsed.data;

  return run("respondOffer", async () => {
    const ref = await prisma.offer.findUnique({ where: { id: offerId }, select: { listingId: true } });
    if (!ref) return err("not_found");

    return prisma.$transaction(async (tx) => {
      const listing = await lockListing(tx, ref.listingId);
      if (!listing || listing.sellerId !== ctx.actor.id) return err("not_found");
      // Relue sous verrou : l'état ne peut plus changer jusqu'à la fin de la transaction.
      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        select: { status: true, quantityKg: true, listingId: true },
      });
      if (!offer || offer.listingId !== listing.id) return err("not_found");
      const refusal = checkRespondAllowed(offer, listing, decision);
      if (refusal) return err("conflict", refusal);

      const changed = await tx.offer.updateMany({
        where: { id: offerId, status: "PENDING" },
        data: { status: decision },
      });
      if (changed.count !== 1) throw new Abort(err("conflict", "mkt.err.offer_not_pending"));

      if (decision === "ACCEPTED") {
        const reserved = await tx.listing.updateMany({
          where: { id: listing.id, status: "OPEN" },
          data: { status: "RESERVED" },
        });
        if (reserved.count !== 1) throw new Abort(err("conflict", "mkt.err.listing_not_open"));
        await tx.offer.updateMany({
          where: { listingId: listing.id, status: "PENDING", id: { not: offerId } },
          data: { status: "REJECTED" },
        });
      }
      return ok({ offerId, status: decision });
    });
  });
}

/** L'acheteur retire son offre (seulement tant qu'elle est en attente). */
export async function withdrawOffer(ctx: ServiceContext, input: unknown): Promise<Result<{ offerId: string }>> {
  if (ctx.actor.role !== "BUYER") return err("forbidden");
  const parsed = offerIdSchema.safeParse(input);
  if (!parsed.success) return err("invalid", undefined, fieldErrorsOf(parsed.error));
  const { offerId } = parsed.data;

  return run("withdrawOffer", async () => {
    const changed = await prisma.offer.updateMany({
      where: { id: offerId, buyerId: ctx.actor.id, status: "PENDING" },
      data: { status: "WITHDRAWN" },
    });
    if (changed.count === 1) return ok({ offerId });
    const mine = await prisma.offer.findFirst({ where: { id: offerId, buyerId: ctx.actor.id }, select: { id: true } });
    return mine ? err("conflict", "mkt.err.offer_not_pending") : err("not_found");
  });
}
