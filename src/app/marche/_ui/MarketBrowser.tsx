/**
 * Liste filtrable et paginée des annonces ouvertes (public /marche et acheteur /acheteur).
 * Filtres en GET (fonctionnent sans JavaScript, URL partageable). Server Component.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { IconChevron, IconRetour, IconVendre } from "@/components/icons";
import { Button, EmptyState, Field, Select } from "@/components/ui";
import type { ListingPage, PublicListing, CropRef } from "@/server/market/queries";
import { LISTING_SORTS, type ListListingsFilters } from "@/server/market/schemas";
import { cropName, type Loc, type Tr } from "./labels";
import { ListingCard } from "./ListingCard";

function hrefWith(basePath: string, filters: ListListingsFilters, patch: Partial<ListListingsFilters>): string {
  const merged = { ...filters, ...patch };
  const qs = new URLSearchParams();
  if (merged.crop) qs.set("crop", merged.crop);
  if (merged.market) qs.set("market", merged.market);
  if (merged.commune) qs.set("commune", merged.commune);
  if (merged.sort && merged.sort !== "recent") qs.set("sort", merged.sort);
  if (merged.page && merged.page > 1) qs.set("page", String(merged.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function MarketBrowser({
  page,
  crops,
  communes,
  basePath,
  locale,
  tr,
  action,
  emptyAction,
}: {
  page: ListingPage;
  crops: CropRef[];
  communes: { id: string; name: string }[];
  basePath: string;
  locale: Loc;
  tr: Tr;
  /** Action sous chaque annonce (ex. « Faire une offre »). */
  action?: (listing: PublicListing) => ReactNode;
  emptyAction?: ReactNode;
}) {
  const f = page.filters;
  const filtered = Boolean(f.crop || f.market || f.commune);

  return (
    <div className="flex flex-col gap-4">
      <form method="get" action={basePath} className="rounded-xl border border-line bg-surface p-4" aria-label={tr("mkt.filters")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="f-crop" label={tr("mkt.filter.crop")}>
            {(a) => (
              <Select {...a} name="crop" defaultValue={f.crop ?? ""}>
                <option value="">{tr("mkt.filter.all_crops")}</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {cropName(locale, c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="f-market" label={tr("mkt.filter.market")}>
            {(a) => (
              <Select {...a} name="market" defaultValue={f.market ?? ""}>
                <option value="">{tr("mkt.filter.all_markets")}</option>
                <option value="LOCAL">{tr("market.local")}</option>
                <option value="EXPORT">{tr("market.export")}</option>
              </Select>
            )}
          </Field>
          <Field id="f-commune" label={tr("mkt.filter.commune")}>
            {(a) => (
              <Select {...a} name="commune" defaultValue={f.commune ?? ""}>
                <option value="">{tr("mkt.filter.all_communes")}</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="f-sort" label={tr("mkt.filter.sort")}>
            {(a) => (
              <Select {...a} name="sort" defaultValue={f.sort}>
                {LISTING_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {tr(`mkt.sort.${s}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            {tr("mkt.filter.apply")}
          </Button>
          {filtered ? (
            <Button href={basePath} variant="ghost" size="sm">
              {tr("mkt.filter.clear")}
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-base font-semibold text-ink" role="status">
        {tr("mkt.results_count", { count: page.total })}
      </p>

      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState
            kind="no-results"
            icon={<IconVendre size={44} />}
            title={tr("mkt.no_results")}
            action={
              <Button href={basePath} variant="secondary" size="sm">
                {tr("mkt.filter.clear")}
              </Button>
            }
          />
        ) : (
          <EmptyState kind="first-use" icon={<IconVendre size={44} />} title={tr("market.no_listing")} action={emptyAction} />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((l) => (
            <li key={l.id} className="flex *:w-full">
              <ListingCard listing={l} locale={locale} tr={tr}>
                {action ? action(l) : null}
              </ListingCard>
            </li>
          ))}
        </ul>
      )}

      {page.pageCount > 1 ? (
        <nav aria-label={tr("mkt.pagination")} className="flex flex-wrap items-center justify-between gap-3">
          {page.page > 1 ? (
            <Link
              href={hrefWith(basePath, f, { page: page.page - 1 })}
              className="inline-flex min-h-touch items-center gap-2 rounded-lg px-3 font-semibold text-primary hover:bg-primary-soft"
            >
              <IconRetour size={22} />
              {tr("mkt.prev")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-base text-ink-muted">{tr("mkt.page_of", { page: page.page, pages: page.pageCount })}</span>
          {page.page < page.pageCount ? (
            <Link
              href={hrefWith(basePath, f, { page: page.page + 1 })}
              className="inline-flex min-h-touch items-center gap-2 rounded-lg px-3 font-semibold text-primary hover:bg-primary-soft"
            >
              {tr("mkt.next")}
              <IconChevron size={22} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
