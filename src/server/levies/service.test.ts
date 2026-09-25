import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contrôles d'accès des services (rôle, propriété, montant serveur) avec une base simulée.
 * L'intégration réelle (verrous, transactions) est vérifiée par le script contre la base de dev.
 */
const db = vi.hoisted(() => ({
  declaration: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  levyRate: { findFirst: vi.fn() },
  crop: { findUnique: vi.fn() },
  offer: { updateMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  listing: { update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/security/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true })),
  limitScope: vi.fn(async () => ({ allowed: true })),
}));

import { createDeclaration, payDemo, validateDeclaration, verifyReceipt, markPaidAtCounter } from "./service";
import { makeOffer, respondOffer, updateListingStatus, withdrawOffer } from "@/server/market/service";
import { rateLimit } from "@/lib/security/rate-limit";

const ID = "cabcdefghijklmnopqrstuvw";
const farmerA = { actor: { id: "cfarmeraaaaaaaaaaaaaaaaa", role: "FARMER" as const }, ip: "1.2.3.4" };
const buyer = { actor: { id: "cbuyerbbbbbbbbbbbbbbbbbb", role: "BUYER" as const }, ip: "1.2.3.4" };
const agent = { actor: { id: "cagentcccccccccccccccccc", role: "AGENT" as const }, ip: "1.2.3.4" };
const admin = { actor: { id: "cadmindddddddddddddddddd", role: "ADMIN" as const }, ip: "1.2.3.4" };

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

describe("payDemo : anti-IDOR", () => {
  it("la mise à jour est filtrée par farmerId = acteur", async () => {
    db.declaration.updateMany.mockResolvedValue({ count: 1 });
    const res = await payDemo(farmerA, { declarationId: ID });
    expect(res.ok).toBe(true);
    expect(db.declaration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID, farmerId: farmerA.actor.id, status: "SUBMITTED" } }),
    );
  });
  it("la déclaration d'un autre fermier → not_found (pas de fuite d'existence)", async () => {
    db.declaration.updateMany.mockResolvedValue({ count: 0 });
    db.declaration.findFirst.mockResolvedValue(null); // rien pour (id, farmerA)
    const res = await payDemo(farmerA, { declarationId: ID });
    expect(res).toEqual({ ok: false, code: "not_found" });
  });
  it("déjà payée → conflict", async () => {
    db.declaration.updateMany.mockResolvedValue({ count: 0 });
    db.declaration.findFirst.mockResolvedValue({ id: ID });
    const res = await payDemo(farmerA, { declarationId: ID });
    expect(res).toMatchObject({ ok: false, code: "conflict", reason: "lev.err.already_paid" });
  });
  it("un acheteur ou un agent ne peut pas « payer (démo) »", async () => {
    expect(await payDemo(buyer, { declarationId: ID })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await payDemo(agent, { declarationId: ID })).toMatchObject({ ok: false, code: "forbidden" });
    expect(db.declaration.updateMany).not.toHaveBeenCalled();
  });
  it("identifiant invalide → invalid", async () => {
    expect(await payDemo(farmerA, { declarationId: "../x" })).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("createDeclaration : montant toujours calculé serveur", () => {
  it("refuse un montant envoyé par le client", async () => {
    const res = await createDeclaration(farmerA, { levyRateId: ID, declaredValueFcfa: "150000", amountDueFcfa: "1" });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    expect(db.declaration.create).not.toHaveBeenCalled();
  });
  it("calcule 1 % de 150 000 = 1 500 et génère numéro + code", async () => {
    db.levyRate.findFirst.mockResolvedValue({ id: ID, basis: "PERCENT_VALUE", rate: 100 });
    db.declaration.findFirst
      .mockResolvedValueOnce(null) // pas de doublon récent
      .mockResolvedValueOnce({ receiptNumber: `AV-${new Date().getUTCFullYear()}-000041` });
    db.declaration.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: ID,
      receiptNumber: data.receiptNumber,
      amountDueFcfa: data.amountDueFcfa,
    }));
    const res = await createDeclaration(farmerA, { levyRateId: ID, declaredValueFcfa: "150000" });
    expect(res.ok).toBe(true);
    const data = db.declaration.create.mock.calls[0][0].data;
    expect(data.amountDueFcfa).toBe(1500);
    expect(data.farmerId).toBe(farmerA.actor.id);
    expect(data.receiptNumber).toMatch(/^AV-\d{4}-000042$/);
    expect(data.verificationCode).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    expect(db.$executeRaw).toHaveBeenCalled(); // verrou de séquence
  });
  it("double envoi : renvoie la déclaration identique récente", async () => {
    db.levyRate.findFirst.mockResolvedValue({ id: ID, basis: "FLAT", rate: 200 });
    db.declaration.findFirst.mockResolvedValueOnce({ id: ID, receiptNumber: "AV-2026-000007", amountDueFcfa: 200 });
    const res = await createDeclaration(farmerA, { levyRateId: ID });
    expect(res).toEqual({ ok: true, data: { id: ID, receiptNumber: "AV-2026-000007", amountDueFcfa: 200, duplicate: true } });
    expect(db.declaration.create).not.toHaveBeenCalled();
  });
  it("retente sur collision de contrainte unique", async () => {
    db.levyRate.findFirst.mockResolvedValue({ id: ID, basis: "FLAT", rate: 200 });
    db.declaration.findFirst.mockResolvedValue(null);
    db.declaration.create
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce({ id: ID, receiptNumber: "AV-2026-000001", amountDueFcfa: 200 });
    const res = await createDeclaration(farmerA, { levyRateId: ID });
    expect(res.ok).toBe(true);
    expect(db.declaration.create).toHaveBeenCalledTimes(2);
  });
  it("quantité manquante pour un barème au kg", async () => {
    db.levyRate.findFirst.mockResolvedValue({ id: ID, basis: "PER_KG", rate: 2 });
    const res = await createDeclaration(farmerA, { levyRateId: ID });
    expect(res).toMatchObject({ ok: false, code: "invalid", reason: "lev.err.quantity_required" });
  });
  it("barème inactif ou inconnu", async () => {
    db.levyRate.findFirst.mockResolvedValue(null);
    expect(await createDeclaration(farmerA, { levyRateId: ID })).toMatchObject({ ok: false, reason: "lev.err.rate_unknown" });
  });
  it("rôle FARMER exigé", async () => {
    expect(await createDeclaration(buyer, { levyRateId: ID })).toMatchObject({ ok: false, code: "forbidden" });
  });
  it("panne base → unavailable, sans détail", async () => {
    db.levyRate.findFirst.mockRejectedValue(new Error("connexion perdue"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await createDeclaration(farmerA, { levyRateId: ID })).toEqual({ ok: false, code: "unavailable" });
    spy.mockRestore();
  });
});

describe("validateDeclaration / markPaidAtCounter : AGENT ou ADMIN", () => {
  it("un fermier ne peut pas valider", async () => {
    expect(await validateDeclaration(farmerA, { declarationId: ID, decision: "VALIDATED" })).toMatchObject({ code: "forbidden" });
    expect(await markPaidAtCounter(farmerA, { declarationId: ID })).toMatchObject({ code: "forbidden" });
  });
  it("VALIDATED seulement depuis PAID", async () => {
    db.declaration.findUnique.mockResolvedValue({ status: "SUBMITTED", amountDueFcfa: 1, receiptNumber: "AV-2026-000001" });
    db.declaration.updateMany.mockResolvedValue({ count: 0 });
    const res = await validateDeclaration(agent, { declarationId: ID, decision: "VALIDATED" });
    expect(res).toMatchObject({ ok: false, reason: "lev.err.validate_needs_paid" });
    expect(db.declaration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID, status: { in: ["PAID"] } } }),
    );
  });
  it("ADMIN peut valider, validatedById = acteur", async () => {
    db.declaration.findUnique.mockResolvedValue({ status: "PAID", amountDueFcfa: 1, receiptNumber: "AV-2026-000001" });
    db.declaration.updateMany.mockResolvedValue({ count: 1 });
    const res = await validateDeclaration(admin, { declarationId: ID, decision: "VALIDATED" });
    expect(res.ok).toBe(true);
    expect(db.declaration.updateMany.mock.calls[0][0].data).toEqual({ status: "VALIDATED", validatedById: admin.actor.id });
  });
});

describe("verifyReceipt : minimum public", () => {
  it("code mal formé ou inconnu → même réponse null", async () => {
    expect(await verifyReceipt("<script>", { ip: "1.1.1.1" })).toEqual({ ok: true, data: null });
    db.declaration.findUnique.mockResolvedValue(null);
    expect(await verifyReceipt("ABCDEFGHJKMN", { ip: "1.1.1.1" })).toEqual({ ok: true, data: null });
  });
  it("ne renvoie que numéro, date, barème, montant, statut, nom masqué", async () => {
    db.declaration.findUnique.mockResolvedValue({
      receiptNumber: "AV-2026-000001",
      createdAt: new Date("2026-09-01"),
      paidAt: new Date("2026-09-02"),
      amountDueFcfa: 1500,
      status: "PAID",
      levyRate: { labelFr: "Valeur 1 %", labelFon: null, labelYo: null },
      farmer: { fullName: "Ablawa Hounkpè" },
    });
    const res = await verifyReceipt("demoav2026qr", { ip: "1.1.1.1" });
    expect(res.ok && res.data).toEqual({
      receiptNumber: "AV-2026-000001",
      date: new Date("2026-09-02"),
      levyLabel: "Valeur 1 %",
      amountDueFcfa: 1500,
      status: "PAID",
      holder: "Ab**** H.",
    });
    const select = db.declaration.findUnique.mock.calls[0][0].select;
    expect(select.farmer).toEqual({ select: { fullName: true } }); // ni téléphone, ni id
  });
  it("limité par IP", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false } as never);
    expect(await verifyReceipt("DEMOAV2026QR", { ip: "9.9.9.9" })).toEqual({ ok: false, code: "rate_limited" });
    expect(vi.mocked(rateLimit).mock.calls[0][0]).toBe("verifyIp:9.9.9.9");
  });
});

describe("marché : rôles et propriété", () => {
  it("makeOffer : BUYER seulement ; offre sur annonce non ouverte refusée", async () => {
    expect(await makeOffer(farmerA, { listingId: ID, quantityKg: 1, pricePerKgFcfa: 1 })).toMatchObject({ code: "forbidden" });
    db.$queryRaw.mockResolvedValue([{ id: ID, sellerId: farmerA.actor.id, status: "RESERVED", quantityKg: 100 }]);
    expect(await makeOffer(buyer, { listingId: ID, quantityKg: 1, pricePerKgFcfa: 1 })).toMatchObject({
      code: "conflict",
      reason: "mkt.err.listing_not_open",
    });
  });
  it("makeOffer : quantité > disponible refusée, doublon en attente refusé", async () => {
    db.$queryRaw.mockResolvedValue([{ id: ID, sellerId: farmerA.actor.id, status: "OPEN", quantityKg: 100 }]);
    expect(await makeOffer(buyer, { listingId: ID, quantityKg: 101, pricePerKgFcfa: 1 })).toMatchObject({
      reason: "mkt.err.quantity_exceeds",
    });
    db.offer.findFirst.mockResolvedValue({ id: "x" });
    expect(await makeOffer(buyer, { listingId: ID, quantityKg: 100, pricePerKgFcfa: 1 })).toMatchObject({
      reason: "mkt.err.offer_exists",
    });
    expect(db.offer.create).not.toHaveBeenCalled();
  });
  it("respondOffer : un autre fermier que le vendeur → not_found", async () => {
    db.offer.findUnique.mockResolvedValue({ listingId: ID });
    db.$queryRaw.mockResolvedValue([{ id: ID, sellerId: "cautrefermier0000000000", status: "OPEN", quantityKg: 100 }]);
    expect(await respondOffer(farmerA, { offerId: ID, decision: "ACCEPTED" })).toEqual({ ok: false, code: "not_found" });
    expect(db.offer.updateMany).not.toHaveBeenCalled();
  });
  it("respondOffer : acceptation → offre ACCEPTED, annonce RESERVED, autres offres refusées", async () => {
    db.offer.findUnique
      .mockResolvedValueOnce({ listingId: ID })
      .mockResolvedValueOnce({ status: "PENDING", quantityKg: 10, listingId: ID });
    db.$queryRaw.mockResolvedValue([{ id: ID, sellerId: farmerA.actor.id, status: "OPEN", quantityKg: 100 }]);
    db.offer.updateMany.mockResolvedValue({ count: 1 });
    db.listing.updateMany.mockResolvedValue({ count: 1 });
    const res = await respondOffer(farmerA, { offerId: ID, decision: "ACCEPTED" });
    expect(res).toEqual({ ok: true, data: { offerId: ID, status: "ACCEPTED" } });
    expect(db.listing.updateMany).toHaveBeenCalledWith({ where: { id: ID, status: "OPEN" }, data: { status: "RESERVED" } });
    expect(db.offer.updateMany).toHaveBeenLastCalledWith({
      where: { listingId: ID, status: "PENDING", id: { not: ID } },
      data: { status: "REJECTED" },
    });
  });
  it("withdrawOffer : filtré par buyerId", async () => {
    db.offer.updateMany.mockResolvedValue({ count: 0 });
    db.offer.findFirst.mockResolvedValue(null);
    expect(await withdrawOffer(buyer, { offerId: ID })).toEqual({ ok: false, code: "not_found" });
    expect(db.offer.updateMany.mock.calls[0][0].where).toEqual({ id: ID, buyerId: buyer.actor.id, status: "PENDING" });
  });
  it("updateListingStatus : propriétaire uniquement", async () => {
    db.$queryRaw.mockResolvedValue([{ id: ID, sellerId: "cautrefermier0000000000", status: "OPEN", quantityKg: 1 }]);
    expect(await updateListingStatus(farmerA, { listingId: ID, status: "CLOSED" })).toEqual({ ok: false, code: "not_found" });
    expect(db.listing.update).not.toHaveBeenCalled();
  });
});
