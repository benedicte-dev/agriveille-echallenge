import "server-only";
/**
 * Lectures du marché. Colonnes explicites, listes bornées, jamais le téléphone d'une partie
 * avant acceptation de l'offre (voir `revealContact`).
 */
import type { Market, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "./result";
import { publicName } from "./format";
import { latestReferencePrices, revealContact, type CropReference } from "./rules";
import { listListingsSchema, type ListListingsFilters } from "./schemas";

const CROP_SELECT = { id: true, slug: true, icon: true, nameFr: true, nameFon: true, nameYo: true } as const;

export type CropRef = Prisma.CropGetPayload<{ select: typeof CROP_SELECT }>;

const LISTING_PUBLIC_SELECT = {
  id: true,
  title: true,
  quantityKg: true,
  pricePerKgFcfa: true,
  market: true,
  availableFrom: true,
  qualityNote: true,
  certification: true,
  status: true,
  createdAt: true,
  crop: { select: CROP_SELECT },
  commune: { select: { id: true, name: true } },
  seller: { select: { id: true, fullName: true } },
} as const;

type ListingRow = Prisma.ListingGetPayload<{ select: typeof LISTING_PUBLIC_SELECT }>;

export type PublicListing = Omit<ListingRow, "seller"> & { sellerId: string; sellerName: string };

function toPublic(row: ListingRow): PublicListing {
  const { seller, ...rest } = row;
  return { ...rest, sellerId: seller.id, sellerName: publicName(seller.fullName) };
}

const ORDER: Record<ListListingsFilters["sort"], Prisma.ListingOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }, { id: "asc" }],
  price_asc: [{ pricePerKgFcfa: "asc" }, { id: "asc" }],
  price_desc: [{ pricePerKgFcfa: "desc" }, { id: "asc" }],
  quantity_desc: [{ quantityKg: "desc" }, { id: "asc" }],
};

export interface ListingPage {
  items: PublicListing[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: ListListingsFilters;
}

/** Annonces OUVERTES, filtrées et paginées (public et acheteur). `raw` = searchParams bruts. */
export async function listListings(raw: Record<string, unknown>): Promise<ListingPage> {
  const filters = listListingsSchema.parse(raw);
  const where: Prisma.ListingWhereInput = {
    status: "OPEN",
    ...(filters.crop ? { crop: { slug: filters.crop } } : {}),
    ...(filters.market ? { market: filters.market } : {}),
    ...(filters.commune ? { communeId: filters.commune } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: ORDER[filters.sort],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: LISTING_PUBLIC_SELECT,
    }),
  ]);
  return {
    items: rows.map(toPublic),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters,
  };
}

/** Une annonce ouverte (page « faire une offre »). */
export async function getOpenListing(listingId: string): Promise<PublicListing | null> {
  const row = await prisma.listing.findFirst({ where: { id: listingId, status: "OPEN" }, select: LISTING_PUBLIC_SELECT });
  return row ? toPublic(row) : null;
}

/** Référentiels pour les filtres et formulaires. */
export async function marketReferenceData() {
  const [crops, communes] = await Promise.all([
    prisma.crop.findMany({ select: CROP_SELECT, orderBy: { nameFr: "asc" }, take: 100 }),
    prisma.commune.findMany({ select: { id: true, name: true, department: true }, orderBy: { name: "asc" }, take: 200 }),
  ]);
  return { crops, communes };
}

/** Derniers prix de référence connus, par culture × marché, national et par commune. */
export async function referencePrices(opts: { cropId?: string; market?: Market } = {}): Promise<CropReference[]> {
  const rows = await prisma.referencePrice.findMany({
    where: { ...(opts.cropId ? { cropId: opts.cropId } : {}), ...(opts.market ? { market: opts.market } : {}) },
    orderBy: { observedAt: "desc" },
    take: 2000,
    select: {
      cropId: true,
      communeId: true,
      market: true,
      pricePerKgFcfa: true,
      observedAt: true,
      commune: { select: { name: true } },
    },
  });
  return latestReferencePrices(rows.map((r) => ({ ...r, communeName: r.commune?.name ?? null })));
}

// ── Espace vendeur (FARMER) ───────────────────────────────────────────────

/** Annonces du vendeur et offres reçues. Le téléphone de l'acheteur n'apparaît qu'après acceptation. */
export async function sellerDashboard(actor: Actor) {
  if (actor.role !== "FARMER") return { listings: [] };
  const rows = await prisma.listing.findMany({
    where: { sellerId: actor.id },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      ...LISTING_PUBLIC_SELECT,
      offers: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          quantityKg: true,
          pricePerKgFcfa: true,
          message: true,
          status: true,
          createdAt: true,
          buyer: { select: { fullName: true, organization: true, phone: true } },
        },
      },
    },
  });
  return {
    listings: rows.map(({ offers, ...l }) => ({
      ...toPublic(l),
      offers: offers.map(({ buyer, ...o }) => ({
        ...o,
        buyerName: publicName(buyer.fullName),
        buyerOrganization: buyer.organization,
        buyerPhone: revealContact(o.status, buyer),
      })),
    })),
  };
}

export type SellerListing = Awaited<ReturnType<typeof sellerDashboard>>["listings"][number];

/** Nombre d'offres en attente reçues (tuile « Vendre »). */
export async function pendingOffersCount(actor: Actor): Promise<number> {
  if (actor.role !== "FARMER") return 0;
  return prisma.offer.count({ where: { status: "PENDING", listing: { sellerId: actor.id } } });
}

// ── Espace acheteur (BUYER) ───────────────────────────────────────────────

/** Offres de l'acheteur. Nom complet et téléphone du vendeur seulement si l'offre est acceptée. */
export async function buyerOffers(actor: Actor) {
  if (actor.role !== "BUYER") return [];
  const rows = await prisma.offer.findMany({
    where: { buyerId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      quantityKg: true,
      pricePerKgFcfa: true,
      message: true,
      status: true,
      createdAt: true,
      listing: {
        select: {
          id: true,
          title: true,
          status: true,
          market: true,
          crop: { select: CROP_SELECT },
          commune: { select: { name: true } },
          seller: { select: { fullName: true, phone: true } },
        },
      },
    },
  });
  return rows.map(({ listing: { seller, ...listing }, ...o }) => {
    const phone = revealContact(o.status, seller);
    return {
      ...o,
      listing,
      sellerName: phone ? seller.fullName : publicName(seller.fullName),
      sellerPhone: phone,
    };
  });
}

export type BuyerOffer = Awaited<ReturnType<typeof buyerOffers>>[number];
