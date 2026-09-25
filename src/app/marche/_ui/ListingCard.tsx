/**
 * Carte d'annonce (marché public, espace acheteur, espace vendeur). Server Component.
 */
import type { ReactNode } from "react";
import { getCropIcon, IconCalendrier, IconCarte, IconCheck, IconUtilisateur } from "@/components/icons";
import { Badge, Card } from "@/components/ui";
import { formatDate, formatFcfa, formatKg } from "@/server/market/format";
import type { PublicListing } from "@/server/market/queries";
import { cropName, dateLocale, type Loc, type Tr } from "./labels";

const STATUS_TONE = { OPEN: "success", RESERVED: "warning", SOLD: "neutral", CLOSED: "neutral" } as const;

export function ListingCard({
  listing,
  locale,
  tr,
  showSeller = true,
  showStatus = false,
  headingLevel = "h2",
  children,
}: {
  listing: PublicListing;
  locale: Loc;
  tr: Tr;
  showSeller?: boolean;
  showStatus?: boolean;
  headingLevel?: "h2" | "h3";
  children?: ReactNode;
}) {
  const CropIcon = getCropIcon(listing.crop.icon || listing.crop.slug);
  const H = headingLevel;
  const name = cropName(locale, listing.crop);
  return (
    <Card as="article" accent="earth" className="flex h-full flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-earth-soft text-earth">
          <CropIcon size={36} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-earth">{name}</p>
          <H className="text-lg leading-snug">{listing.title}</H>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={listing.market === "EXPORT" ? "info" : "earth"}>
          {tr(listing.market === "EXPORT" ? "market.export" : "market.local")}
        </Badge>
        {showStatus ? <Badge tone={STATUS_TONE[listing.status]}>{tr(`market.listing.${listing.status}`)}</Badge> : null}
        {listing.certification ? (
          <Badge tone="primary" icon={<IconCheck size={16} />}>
            {listing.certification}
          </Badge>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div>
          <dt className="text-sm text-ink-muted">{tr("market.quantity")}</dt>
          <dd className="text-lg font-bold tabular-nums">{formatKg(listing.quantityKg)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{tr("market.price_per_kg")}</dt>
          <dd className="text-lg font-bold tabular-nums">{formatFcfa(listing.pricePerKgFcfa)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-sm text-ink-muted">{tr("mkt.total_value")}</dt>
          <dd className="font-semibold tabular-nums">{formatFcfa(listing.quantityKg * listing.pricePerKgFcfa)}</dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-1 text-base text-ink-muted">
        <li className="flex items-center gap-2">
          <IconCarte size={20} />
          <span>{listing.commune.name}</span>
        </li>
        <li className="flex items-center gap-2">
          <IconCalendrier size={20} />
          <span>{tr("market.available_from", { date: formatDate(listing.availableFrom, dateLocale(locale)) })}</span>
        </li>
        {showSeller ? (
          <li className="flex items-center gap-2">
            <IconUtilisateur size={20} />
            <span>
              {tr("mkt.seller")} : {listing.sellerName}
            </span>
          </li>
        ) : null}
      </ul>
      {listing.qualityNote ? (
        <p className="text-base">
          <span className="font-semibold">{tr("market.quality")} : </span>
          {listing.qualityNote}
        </p>
      ) : null}
      {children ? <div className="mt-auto pt-1">{children}</div> : null}
    </Card>
  );
}
