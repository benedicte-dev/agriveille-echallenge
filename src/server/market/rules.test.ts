import { describe, expect, it } from "vitest";
import {
  canTransitionListing,
  checkOfferAllowed,
  checkRespondAllowed,
  defaultListingTitle,
  latestReferencePrices,
  referenceFor,
  revealContact,
} from "./rules";
import { createListingSchema, listListingsSchema, makeOfferSchema, respondOfferSchema } from "./schemas";

const listing = { sellerId: "seller", status: "OPEN" as const, quantityKg: 1000 };

describe("checkOfferAllowed", () => {
  it("accepte une offre valide, quantité égale au disponible incluse", () => {
    expect(checkOfferAllowed(listing, "buyer", 1000)).toBeNull();
    expect(checkOfferAllowed(listing, "buyer", 1)).toBeNull();
  });
  it("interdit une offre sur sa propre annonce", () => {
    expect(checkOfferAllowed(listing, "seller", 10)).toBe("mkt.err.own_listing");
  });
  it("interdit si l'annonce n'est pas OPEN", () => {
    for (const status of ["RESERVED", "SOLD", "CLOSED"] as const) {
      expect(checkOfferAllowed({ ...listing, status }, "buyer", 10)).toBe("mkt.err.listing_not_open");
    }
  });
  it("interdit une quantité supérieure au disponible", () => {
    expect(checkOfferAllowed(listing, "buyer", 1001)).toBe("mkt.err.quantity_exceeds");
  });
});

describe("checkRespondAllowed", () => {
  const offer = { status: "PENDING" as const, quantityKg: 500 };
  it("accepter une offre en attente sur une annonce ouverte", () => {
    expect(checkRespondAllowed(offer, listing, "ACCEPTED")).toBeNull();
    expect(checkRespondAllowed(offer, listing, "REJECTED")).toBeNull();
  });
  it("pas de double acceptation : annonce déjà réservée", () => {
    expect(checkRespondAllowed(offer, { ...listing, status: "RESERVED" }, "ACCEPTED")).toBe("mkt.err.listing_not_open");
    // Refuser reste possible même si l'annonce est réservée.
    expect(checkRespondAllowed(offer, { ...listing, status: "RESERVED" }, "REJECTED")).toBeNull();
  });
  it("une offre déjà traitée ne peut pas l'être à nouveau", () => {
    for (const status of ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const) {
      expect(checkRespondAllowed({ ...offer, status }, listing, "ACCEPTED")).toBe("mkt.err.offer_not_pending");
    }
  });
});

describe("transitions d'annonce", () => {
  it("table des transitions", () => {
    expect(canTransitionListing("OPEN", "CLOSED")).toBe(true);
    expect(canTransitionListing("CLOSED", "OPEN")).toBe(true);
    expect(canTransitionListing("RESERVED", "SOLD")).toBe(true);
    expect(canTransitionListing("OPEN", "RESERVED")).toBe(false); // seulement via acceptation
    expect(canTransitionListing("OPEN", "SOLD")).toBe(false);
    expect(canTransitionListing("SOLD", "OPEN")).toBe(false);
    expect(canTransitionListing("RESERVED", "OPEN")).toBe(false);
  });
});

describe("vie privée", () => {
  const party = { phone: "+2290197000001" };
  it("téléphone révélé seulement après acceptation", () => {
    expect(revealContact("ACCEPTED", party)).toBe("+2290197000001");
    for (const s of ["PENDING", "REJECTED", "WITHDRAWN"] as const) expect(revealContact(s, party)).toBeNull();
  });
});

describe("prix de référence", () => {
  const d = (s: string) => new Date(s);
  const rows = [
    { cropId: "mais", communeId: null, market: "LOCAL" as const, pricePerKgFcfa: 240, observedAt: d("2026-08-01") },
    { cropId: "mais", communeId: null, market: "LOCAL" as const, pricePerKgFcfa: 250, observedAt: d("2026-09-01") },
    { cropId: "mais", communeId: "boh", communeName: "Bohicon", market: "LOCAL" as const, pricePerKgFcfa: 260, observedAt: d("2026-07-01") },
    { cropId: "mais", communeId: "boh", communeName: "Bohicon", market: "LOCAL" as const, pricePerKgFcfa: 265, observedAt: d("2026-09-02") },
    { cropId: "mais", communeId: "par", communeName: "Parakou", market: "LOCAL" as const, pricePerKgFcfa: 230, observedAt: d("2026-09-02") },
    { cropId: "piment", communeId: null, market: "EXPORT" as const, pricePerKgFcfa: 1900, observedAt: d("2026-09-02") },
  ];
  const refs = latestReferencePrices(rows);

  it("garde le dernier prix national et le dernier par commune", () => {
    const mais = refs.find((r) => r.cropId === "mais" && r.market === "LOCAL")!;
    expect(mais.national?.pricePerKgFcfa).toBe(250);
    expect(mais.locals.map((l) => [l.communeName, l.pricePerKgFcfa])).toEqual([
      ["Bohicon", 265],
      ["Parakou", 230],
    ]);
  });
  it("referenceFor : local d'abord, sinon national, sinon null", () => {
    expect(referenceFor(refs, "mais", "LOCAL", "boh")).toMatchObject({ pricePerKgFcfa: 265, scope: "local" });
    expect(referenceFor(refs, "mais", "LOCAL", "autre")).toMatchObject({ pricePerKgFcfa: 250, scope: "national" });
    expect(referenceFor(refs, "mais", "EXPORT")).toBeNull();
    expect(referenceFor(refs, "piment", "EXPORT")).toMatchObject({ pricePerKgFcfa: 1900 });
  });
  it("titre généré", () => {
    expect(defaultListingTitle("Maïs", 1500)).toBe("Maïs · 1 500 kg");
  });
});

describe("schémas zod", () => {
  const cuid = "cseedlisting001abcdefghi";
  it("createListing : entiers, bornes, marché, certification en liste fermée", () => {
    const ok = createListingSchema.safeParse({ cropId: "ckcrop0000000000000000000", quantityKg: "1500", pricePerKgFcfa: "260", market: "LOCAL" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.availableFrom).toBeInstanceOf(Date);
    const bad = (patch: Record<string, unknown>) =>
      createListingSchema.safeParse({ cropId: "ckcrop0000000000000000000", quantityKg: 10, pricePerKgFcfa: 10, market: "LOCAL", ...patch }).success;
    expect(bad({ quantityKg: 0 })).toBe(false);
    expect(bad({ quantityKg: 1.5 })).toBe(false);
    expect(bad({ pricePerKgFcfa: -1 })).toBe(false);
    expect(bad({ pricePerKgFcfa: 1_000_001 })).toBe(false);
    expect(bad({ market: "MARS" })).toBe(false);
    expect(bad({ certification: "<script>" })).toBe(false);
    expect(bad({ certification: "BIO" })).toBe(true);
    expect(bad({ certification: "NONE" })).toBe(true);
    expect(bad({ availableFrom: "2020-01-01" })).toBe(false);
    expect(bad({ availableFrom: "2026-02-31" })).toBe(false);
    expect(bad({ cropId: "x' OR 1=1" })).toBe(false);
  });
  it("makeOffer / respondOffer", () => {
    expect(makeOfferSchema.safeParse({ listingId: cuid, quantityKg: "10", pricePerKgFcfa: "250" }).success).toBe(true);
    expect(makeOfferSchema.safeParse({ listingId: cuid, quantityKg: "-3", pricePerKgFcfa: "250" }).success).toBe(false);
    expect(respondOfferSchema.safeParse({ offerId: cuid, decision: "ACCEPTED" }).success).toBe(true);
    expect(respondOfferSchema.safeParse({ offerId: cuid, decision: "WITHDRAWN" }).success).toBe(false);
  });
  it("filtres : valeurs invalides → défauts, page bornée", () => {
    const f = listListingsSchema.parse({ crop: "../etc", market: "X", sort: "drop", page: "-4", pageSize: "5000" });
    expect(f).toEqual({ crop: undefined, market: undefined, commune: undefined, sort: "recent", page: 1, pageSize: 12 });
    expect(listListingsSchema.parse({ crop: "mais", market: "EXPORT", page: "2" })).toMatchObject({ crop: "mais", market: "EXPORT", page: 2 });
  });
});
