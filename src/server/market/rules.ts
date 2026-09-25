/**
 * Règles métier pures du marché (testées sans base).
 */
import type { ListingStatus, Market, OfferStatus } from "@prisma/client";

/** Transitions d'annonce autorisées au vendeur. RESERVED n'est atteint que par l'acceptation d'une offre. */
export const LISTING_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  OPEN: ["CLOSED"],
  RESERVED: ["SOLD", "CLOSED"],
  SOLD: [],
  CLOSED: ["OPEN"],
};

export function canTransitionListing(from: ListingStatus, to: ListingStatus): boolean {
  return LISTING_TRANSITIONS[from].includes(to);
}

export type OfferRefusal =
  | "mkt.err.own_listing"
  | "mkt.err.listing_not_open"
  | "mkt.err.quantity_exceeds";

/** Une offre est-elle recevable sur cette annonce ? (null = oui) */
export function checkOfferAllowed(
  listing: { sellerId: string; status: ListingStatus; quantityKg: number },
  buyerId: string,
  quantityKg: number,
): OfferRefusal | null {
  if (listing.sellerId === buyerId) return "mkt.err.own_listing";
  if (listing.status !== "OPEN") return "mkt.err.listing_not_open";
  if (quantityKg > listing.quantityKg) return "mkt.err.quantity_exceeds";
  return null;
}

export type RespondRefusal = "mkt.err.offer_not_pending" | "mkt.err.listing_not_open" | "mkt.err.quantity_exceeds";

/** Le vendeur peut-il appliquer cette décision ? (null = oui) */
export function checkRespondAllowed(
  offer: { status: OfferStatus; quantityKg: number },
  listing: { status: ListingStatus; quantityKg: number },
  decision: "ACCEPTED" | "REJECTED",
): RespondRefusal | null {
  if (offer.status !== "PENDING") return "mkt.err.offer_not_pending";
  if (decision === "ACCEPTED") {
    if (listing.status !== "OPEN") return "mkt.err.listing_not_open";
    if (offer.quantityKg > listing.quantityKg) return "mkt.err.quantity_exceeds";
  }
  return null;
}

/**
 * Vie privée : le téléphone de l'autre partie n'est révélé qu'une fois l'offre ACCEPTÉE.
 * Avant, seul un nom public (prénom + initiale) est visible.
 */
export function revealContact<T extends { phone: string }>(status: OfferStatus, party: T): string | null {
  return status === "ACCEPTED" ? party.phone : null;
}

// ── Prix de référence ─────────────────────────────────────────────────────

export interface ReferencePriceRow {
  cropId: string;
  communeId: string | null;
  communeName?: string | null;
  market: Market;
  pricePerKgFcfa: number;
  observedAt: Date;
}

export interface PricePoint {
  pricePerKgFcfa: number;
  observedAt: Date;
}

export interface CropReference {
  cropId: string;
  market: Market;
  /** Dernier prix national connu (communeId null). */
  national: PricePoint | null;
  /** Dernier prix connu par commune. */
  locals: (PricePoint & { communeId: string; communeName: string | null })[];
}

/** Réduit des relevés en « dernier prix connu » par culture × marché, national et par commune. */
export function latestReferencePrices(rows: readonly ReferencePriceRow[]): CropReference[] {
  const byKey = new Map<string, CropReference>();
  for (const r of rows) {
    const key = `${r.cropId}:${r.market}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { cropId: r.cropId, market: r.market, national: null, locals: [] };
      byKey.set(key, entry);
    }
    const point = { pricePerKgFcfa: r.pricePerKgFcfa, observedAt: r.observedAt };
    if (r.communeId === null) {
      if (!entry.national || entry.national.observedAt < r.observedAt) entry.national = point;
    } else {
      const idx = entry.locals.findIndex((l) => l.communeId === r.communeId);
      const local = { ...point, communeId: r.communeId, communeName: r.communeName ?? null };
      if (idx === -1) entry.locals.push(local);
      else if (entry.locals[idx].observedAt < r.observedAt) entry.locals[idx] = local;
    }
  }
  for (const e of byKey.values()) e.locals.sort((a, b) => (a.communeName ?? "").localeCompare(b.communeName ?? "", "fr"));
  return [...byKey.values()];
}

/** Prix d'aide pour une culture : local (commune) s'il existe, sinon national. */
export function referenceFor(
  refs: readonly CropReference[],
  cropId: string,
  market: Market,
  communeId?: string | null,
): (PricePoint & { scope: "local" | "national" }) | null {
  const e = refs.find((r) => r.cropId === cropId && r.market === market);
  if (!e) return null;
  const local = communeId ? e.locals.find((l) => l.communeId === communeId) : undefined;
  if (local) return { pricePerKgFcfa: local.pricePerKgFcfa, observedAt: local.observedAt, scope: "local" };
  if (e.national) return { ...e.national, scope: "national" };
  return null;
}

/** Titre d'annonce généré (le fermier n'a rien à taper) : « Maïs · 1 500 kg ». */
export function defaultListingTitle(cropName: string, quantityKg: number): string {
  return `${cropName} · ${new Intl.NumberFormat("fr-FR").format(quantityKg).replace(/[  ]/g, " ")} kg`;
}
