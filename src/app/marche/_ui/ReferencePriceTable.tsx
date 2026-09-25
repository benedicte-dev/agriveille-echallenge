/**
 * Tableau accessible des prix de référence (dernier relevé connu). Server Component.
 * Vrai <table> à toutes les largeurs (défilement horizontal interne si besoin) : c'est une grille
 * de comparaison, la lire en cartes ferait perdre la correspondance des colonnes.
 */
import { getCropIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { IconGraphique } from "@/components/icons";
import { formatDate, formatInt } from "@/server/market/format";
import type { CropReference } from "@/server/market/rules";
import type { CropRef } from "@/server/market/queries";
import { cropName, dateLocale, type Loc, type Tr } from "./labels";

export function ReferencePriceTable({
  refs,
  crops,
  locale,
  tr,
}: {
  refs: CropReference[];
  crops: CropRef[];
  locale: Loc;
  tr: Tr;
}) {
  if (refs.length === 0) {
    return <EmptyState kind="no-results" icon={<IconGraphique size={44} />} title={tr("mkt.ref_none")} />;
  }
  const cropById = new Map(crops.map((c) => [c.id, c]));
  const rows = refs
    .map((r) => ({ ...r, crop: cropById.get(r.cropId) }))
    .filter((r): r is typeof r & { crop: CropRef } => Boolean(r.crop))
    .sort((a, b) => cropName(locale, a.crop).localeCompare(cropName(locale, b.crop), "fr") || a.market.localeCompare(b.market));
  const dl = dateLocale(locale);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface" tabIndex={0} role="region" aria-label={tr("mkt.ref_table_caption")}>
      <table className="w-full min-w-xl border-collapse text-left text-base">
        <caption className="px-4 py-3 text-left text-sm text-ink-muted">{tr("mkt.ref_table_caption")}</caption>
        <thead className="bg-sunken">
          <tr>
            <th scope="col" className="border-b border-line-strong px-4 py-3 font-semibold">
              {tr("mkt.filter.crop")}
            </th>
            <th scope="col" className="border-b border-line-strong px-4 py-3 font-semibold">
              {tr("mkt.filter.market")}
            </th>
            <th scope="col" className="border-b border-line-strong px-4 py-3 text-right font-semibold">
              {tr("mkt.ref_national")}
            </th>
            <th scope="col" className="border-b border-line-strong px-4 py-3 font-semibold">
              {tr("mkt.ref_local")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const Icon = getCropIcon(r.crop.icon || r.crop.slug);
            return (
              <tr key={`${r.cropId}:${r.market}`} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  <span className="flex items-center gap-2">
                    <Icon size={24} className="shrink-0 text-earth" />
                    {cropName(locale, r.crop)}
                  </span>
                </th>
                <td className="px-4 py-3">{tr(r.market === "EXPORT" ? "market.export" : "market.local")}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.national ? (
                    <>
                      <span className="font-bold">{formatInt(r.national.pricePerKgFcfa)}</span>
                      <span className="block text-sm text-ink-muted">
                        {tr("mkt.ref_observed", { date: formatDate(r.national.observedAt, dl) })}
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.locals.length === 0 ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {r.locals.map((l) => (
                        <li key={l.communeId} className="tabular-nums">
                          {l.communeName} : <span className="font-bold">{formatInt(l.pricePerKgFcfa)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
