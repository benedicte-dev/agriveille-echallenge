import type { Metadata } from "next";
import { IconTelephone, IconVendre } from "@/components/icons";
import { Badge, Callout, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatBeninPhone } from "@/lib/auth/phone";
import { withdrawOfferAction } from "@/server/market/actions";
import { buyerOffers, listListings, marketReferenceData, type BuyerOffer } from "@/server/market/queries";
import { formatDate, formatFcfa, formatInt, formatKg } from "@/server/market/format";
import { ActionButton } from "@/app/marche/_ui/ActionButton";
import { MarketBrowser } from "@/app/marche/_ui/MarketBrowser";
import { dateLocale, pageI18n, type Tr } from "@/app/marche/_ui/labels";
import { OfferForm } from "./OfferForm";

export const metadata: Metadata = { title: "Marché" };

const OFFER_TONE = { PENDING: "warning", ACCEPTED: "success", REJECTED: "neutral", WITHDRAWN: "neutral" } as const;

function flat(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

function OfferRow({ offer, tr, dl }: { offer: BuyerOffer; tr: Tr; dl: string }) {
  const l = offer.listing;
  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{l.title}</p>
        <Badge tone={OFFER_TONE[offer.status]}>{tr(`market.offer.${offer.status}`)}</Badge>
      </div>
      <p className="mt-1 text-base tabular-nums">
        {formatKg(offer.quantityKg)} × {tr("mkt.per_kg", { amount: formatInt(offer.pricePerKgFcfa) })} ·{" "}
        <span className="font-bold">{tr("mkt.offer_total", { amount: formatFcfa(offer.quantityKg * offer.pricePerKgFcfa) })}</span>
      </p>
      <p className="text-sm text-ink-muted">
        {l.commune.name} · {formatDate(offer.createdAt)}
      </p>
      {offer.message ? <p className="mt-1 text-base">« {offer.message} »</p> : null}
      {offer.status === "ACCEPTED" ? (
        <div className="mt-3 rounded-lg border border-success bg-success-soft p-3">
          <p className="font-bold text-ink">{tr("mkt.seller_contact")}</p>
          <p className="text-base text-ink">{offer.sellerName}</p>
          {offer.sellerPhone ? (
            <a href={`tel:${offer.sellerPhone}`} className="mt-1 inline-flex min-h-touch items-center gap-2 font-bold text-primary">
              <IconTelephone size={22} />
              {tr("mkt.seller_phone", { phone: formatBeninPhone(offer.sellerPhone) })}
            </a>
          ) : null}
        </div>
      ) : null}
      {offer.status === "PENDING" ? (
        <div className="mt-3">
          <ActionButton
            action={withdrawOfferAction}
            fields={{ offerId: offer.id }}
            label={tr("market.withdraw")}
            variant="secondary"
            size="sm"
            hideOnSuccess
          />
        </div>
      ) : null}
    </li>
  );
}

/** Espace acheteur : marché ouvert (filtres, faire une offre) et mes offres (une seule page). */
export default async function AcheteurPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole("BUYER");
  const [{ locale, tr, listenLabels }, sp] = await Promise.all([pageI18n(), searchParams]);
  const [page, { crops, communes }, offers] = await Promise.all([
    listListings(flat(sp)),
    marketReferenceData(),
    buyerOffers({ id: user.id, role: user.role }),
  ]);

  return (
    <>
      <PageHeader
        title={tr("buyer.title")}
        icon={<IconVendre size={36} />}
        listen={{ text: `${tr("buyer.title")}. ${tr("mkt.public_intro")}`, lang: locale, labels: listenLabels }}
      />
      {sp.envoyee === "1" ? (
        <Callout tone="success" role="status" title={tr("mkt.offer_sent")} className="mb-4" />
      ) : null}

      <section aria-labelledby="annonces" className="mb-10">
        <h2 id="annonces" className="mb-3 text-xl">
          {tr("market.title")}
        </h2>
        <MarketBrowser
          page={page}
          crops={crops}
          communes={communes}
          basePath="/acheteur"
          locale={locale}
          tr={tr}
          action={(listing) => <OfferForm listingId={listing.id} maxQuantityKg={listing.quantityKg} askedPrice={listing.pricePerKgFcfa} />}
        />
      </section>

      <section id="mes-offres" aria-labelledby="mes-offres-titre">
        <h2 id="mes-offres-titre" className="mb-3 text-xl">
          {tr("buyer.my_offers")}
        </h2>
        {offers.length === 0 ? (
          <EmptyState kind="first-use" icon={<IconVendre size={44} />} title={tr("mkt.buyer_offers_empty")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((o) => (
              <OfferRow key={o.id} offer={o} tr={tr} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
