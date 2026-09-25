import type { Metadata } from "next";
import { IconCheck, IconCroix, IconPlus, IconTelephone, IconVendre } from "@/components/icons";
import { Badge, Button, Callout, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatBeninPhone } from "@/lib/auth/phone";
import { respondOfferAction, updateListingStatusAction } from "@/server/market/actions";
import { formatDate, formatFcfa, formatInt, formatKg } from "@/server/market/format";
import { sellerDashboard, type SellerListing } from "@/server/market/queries";
import { ActionButton } from "@/app/marche/_ui/ActionButton";
import { ListingCard } from "@/app/marche/_ui/ListingCard";
import { dateLocale, pageI18n, type Loc, type Tr } from "@/app/marche/_ui/labels";

export const metadata: Metadata = { title: "Vendre" };

const OFFER_TONE = { PENDING: "warning", ACCEPTED: "success", REJECTED: "neutral", WITHDRAWN: "neutral" } as const;

function ListingActions({ listing, tr }: { listing: SellerListing; tr: Tr }) {
  const btn = (status: string, label: string, variant: "secondary" | "ghost" | "primary") => (
    <ActionButton action={updateListingStatusAction} fields={{ listingId: listing.id, status }} label={label} variant={variant} />
  );
  switch (listing.status) {
    case "OPEN":
      return btn("CLOSED", tr("mkt.close_listing"), "secondary");
    case "RESERVED":
      return (
        <div className="flex flex-wrap gap-2">
          {btn("SOLD", tr("mkt.mark_sold"), "primary")}
          {btn("CLOSED", tr("mkt.close_listing"), "secondary")}
        </div>
      );
    case "CLOSED":
      return btn("OPEN", tr("mkt.reopen_listing"), "secondary");
    case "SOLD":
      return null;
  }
}

function Offers({ listing, locale, tr }: { listing: SellerListing; locale: Loc; tr: Tr }) {
  if (listing.offers.length === 0) return <p className="text-base text-ink-muted">{tr("mkt.offers_none")}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {listing.offers.map((o) => (
        <li key={o.id} className="rounded-xl border border-line-strong bg-canvas p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">
              {tr("mkt.offer_from", { name: o.buyerName })}
              {o.buyerOrganization ? <span className="font-normal text-ink-muted"> · {o.buyerOrganization}</span> : null}
            </p>
            <Badge tone={OFFER_TONE[o.status]}>{tr(`market.offer.${o.status}`)}</Badge>
          </div>
          <p className="mt-1 text-base tabular-nums">
            {formatKg(o.quantityKg)} × {tr("mkt.per_kg", { amount: formatInt(o.pricePerKgFcfa) })} ·{" "}
            <span className="font-bold">{tr("mkt.offer_total", { amount: formatFcfa(o.quantityKg * o.pricePerKgFcfa) })}</span>
          </p>
          <p className="text-sm text-ink-muted">{formatDate(o.createdAt, dateLocale(locale))}</p>
          {o.message ? <p className="mt-1 text-base">« {o.message} »</p> : null}
          {o.buyerPhone ? (
            <p className="mt-2">
              <a href={`tel:${o.buyerPhone}`} className="inline-flex min-h-touch items-center gap-2 font-bold text-primary">
                <IconTelephone size={22} />
                {tr("mkt.buyer_phone", { phone: formatBeninPhone(o.buyerPhone) })}
              </a>
            </p>
          ) : null}
          {o.status === "PENDING" && listing.status === "OPEN" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ActionButton
                action={respondOfferAction}
                fields={{ offerId: o.id, decision: "ACCEPTED" }}
                label={tr("market.accept")}
                icon={<IconCheck size={22} />}
                size="md"
                block
                hideOnSuccess
              />
              <ActionButton
                action={respondOfferAction}
                fields={{ offerId: o.id, decision: "REJECTED" }}
                label={tr("market.reject")}
                icon={<IconCroix size={22} />}
                variant="secondary"
                size="md"
                block
                hideOnSuccess
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Espace vendeur : mes annonces et les offres reçues (accepter / refuser). */
export default async function MesAnnoncesPage({ searchParams }: { searchParams: Promise<{ publiee?: string }> }) {
  const user = await requireRole("FARMER");
  const [{ locale, tr, listenLabels }, sp, { listings }] = await Promise.all([
    pageI18n(),
    searchParams,
    sellerDashboard({ id: user.id, role: user.role }),
  ]);
  const pending = listings.reduce((n, l) => n + l.offers.filter((o) => o.status === "PENDING").length, 0);

  return (
    <>
      <PageHeader
        title={tr("mkt.my_title")}
        subtitle={pending > 0 ? tr("mkt.pending_offers", { count: pending }) : undefined}
        icon={<IconVendre size={36} />}
        backHref="/app"
        backLabel={tr("common.back")}
        listen={{ text: `${tr("mkt.my_title")}. ${tr("mkt.listen_my")}`, lang: locale, labels: listenLabels }}
      />
      {sp.publiee === "1" ? (
        <Callout tone="success" role="status" title={tr("market.published")} className="mb-4">
          {tr("mkt.published_next")}
        </Callout>
      ) : null}

      {listings.length === 0 ? (
        <EmptyState
          kind="first-use"
          icon={<IconVendre size={44} />}
          title={tr("mkt.my_empty_title")}
          message={tr("mkt.my_empty_msg")}
          action={
            <Button href="/app/marche/nouvelle" size="lg" icon={<IconPlus size={24} />}>
              {tr("market.new_listing")}
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {listings.map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} locale={locale} tr={tr} showSeller={false} showStatus headingLevel="h2">
                  <div className="flex flex-col gap-4">
                    <ListingActions listing={l} tr={tr} />
                    <Card as="section" padding="sm" title={tr("market.offers_received")} titleAs="h3" className="shadow-none">
                      <Offers listing={l} locale={locale} tr={tr} />
                    </Card>
                  </div>
                </ListingCard>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button href="/app/marche/nouvelle" size="lg" block icon={<IconPlus size={24} />}>
              {tr("market.new_listing")}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
