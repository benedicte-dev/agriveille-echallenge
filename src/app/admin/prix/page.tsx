import type { Metadata } from "next";
import { IconGraphique } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { communeOptions, cropOptions, listRecentPrices } from "@/server/content/admin-cms";
import { getTranslator } from "@/server/content/ui/i18n";
import { addPriceAction, deletePriceAction } from "../actions";
import { AdminForm, SelectField, Submit, TextField } from "../_ui/AdminForm";
import { ConfirmSubmit } from "../_ui/ConfirmSubmit";
import { fmtDate, fmtInt, todayIso } from "../_ui/format";

export const metadata: Metadata = { title: "Prix de référence" };

type Row = Awaited<ReturnType<typeof listRecentPrices>>[number];

export default async function AdminPricesPage() {
  await requireRole("ADMIN");
  const { locale } = await getTranslator();
  const [rows, crops, communes] = await Promise.all([listRecentPrices(50), cropOptions(), communeOptions()]);

  const columns: Column<Row>[] = [
    {
      key: "crop",
      header: "Culture",
      primary: true,
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold">{r.crop.nameFr}</span>
          <span className="text-sm text-ink-muted">{r.commune?.name ?? "Prix national"}</span>
        </span>
      ),
    },
    { key: "price", header: "Prix (FCFA/kg)", cell: (r) => fmtInt(r.pricePerKgFcfa, locale) },
    {
      key: "market",
      header: "Marché",
      cell: (r) => <Badge tone={r.market === "EXPORT" ? "info" : "neutral"}>{r.market === "EXPORT" ? "Export" : "Local"}</Badge>,
      hideOnMobile: true,
    },
    { key: "date", header: "Observé le", cell: (r) => fmtDate(r.observedAt, locale), hideOnMobile: true },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <AdminForm action={deletePriceAction} inline>
          <input type="hidden" name="id" value={r.id} />
          <div>
            <ConfirmSubmit confirm={`Supprimer le prix de ${r.crop.nameFr} (${fmtInt(r.pricePerKgFcfa, locale)} FCFA/kg) ?`}>Supprimer</ConfirmSubmit>
          </div>
        </AdminForm>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Prix de référence" icon={<IconGraphique size={32} />} subtitle={`${rows.length} relevé(s) récent(s)`} />
      <section aria-labelledby="add-price" className="flex flex-col gap-3">
        <h2 id="add-price" className="text-xl font-bold">
          Ajouter un relevé de prix
        </h2>
        {crops.length === 0 ? (
          <EmptyState icon={<IconGraphique size={40} />} title="Aucune culture" message="Créez d'abord des cultures pour pouvoir saisir des prix." />
        ) : (
          <AdminForm action={addPriceAction} className="rounded-2xl border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                name="cropId"
                label="Culture"
                required
                options={[{ value: "", label: "Choisir une culture" }, ...crops.map((c) => ({ value: c.id, label: c.nameFr }))]}
              />
              <SelectField
                name="communeId"
                label="Commune"
                hint="Laissez « Prix national » si le relevé ne concerne pas une commune précise."
                options={[{ value: "", label: "Prix national" }, ...communes.map((c) => ({ value: c.id, label: `${c.name} (${c.department})` }))]}
              />
              <SelectField
                name="market"
                label="Marché"
                required
                defaultValue="LOCAL"
                options={[
                  { value: "LOCAL", label: "Local" },
                  { value: "EXPORT", label: "Export" },
                ]}
              />
              <TextField name="pricePerKgFcfa" label="Prix (FCFA/kg)" type="number" step="1" min={1} inputMode="numeric" required />
              <TextField name="observedAt" label="Date d'observation" type="date" required defaultValue={todayIso()} />
            </div>
            <div>
              <Submit>Ajouter le prix</Submit>
            </div>
          </AdminForm>
        )}
      </section>
      <section aria-labelledby="recent-prices" className="flex flex-col gap-3">
        <h2 id="recent-prices" className="text-xl font-bold">
          Derniers relevés
        </h2>
        {rows.length === 0 ? (
          <EmptyState icon={<IconGraphique size={40} />} title="Aucun prix enregistré" message="Ajoutez un premier relevé avec le formulaire ci-dessus." />
        ) : (
          <DataTable caption="50 derniers prix de référence" columns={columns} rows={rows} rowKey={(r) => r.id} />
        )}
      </section>
    </div>
  );
}
