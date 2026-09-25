import type { Metadata } from "next";
import { IconVendre } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createListingAction } from "@/server/market/actions";
import { marketReferenceData, referencePrices } from "@/server/market/queries";
import { cropName, pageI18n } from "@/app/marche/_ui/labels";
import { NewListingForm, type RefOption } from "./NewListingForm";

export const metadata: Metadata = { title: "Nouvelle annonce" };

export default async function NouvelleAnnoncePage() {
  const user = await requireRole("FARMER");
  const [{ locale, tr, listenLabels }, { crops, communes }, refs] = await Promise.all([
    pageI18n(),
    marketReferenceData(),
    referencePrices(),
  ]);
  const refOptions: RefOption[] = refs.map((r) => ({
    cropId: r.cropId,
    market: r.market,
    national: r.national?.pricePerKgFcfa ?? null,
    locals: Object.fromEntries(r.locals.map((l) => [l.communeId, l.pricePerKgFcfa])),
  }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title={tr("market.new_listing")}
        icon={<IconVendre size={36} />}
        backHref="/app/marche"
        backLabel={tr("common.back")}
        listen={{ text: `${tr("market.new_listing")}. ${tr("mkt.listen_new")}`, lang: locale, labels: listenLabels }}
      />
      <NewListingForm
        action={createListingAction}
        crops={crops.map((c) => ({ id: c.id, slug: c.slug, icon: c.icon, name: cropName(locale, c) }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name }))}
        refs={refOptions}
        defaultCommuneId={user.communeId}
        today={today}
      />
    </>
  );
}
