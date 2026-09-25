import type { Metadata } from "next";
import Link from "next/link";
import { IconSemis } from "@/components/icons";
import { Button, DataTable, EmptyState, PageHeader, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { listCropsAdmin } from "@/server/content/admin-cms";
import { getTranslator } from "@/server/content/ui/i18n";
import { monthLabels } from "../_ui/format";

export const metadata: Metadata = { title: "Cultures" };

type Row = Awaited<ReturnType<typeof listCropsAdmin>>[number];

export default async function AdminCropsPage() {
  await requireRole("ADMIN");
  const { locale } = await getTranslator();
  const rows = await listCropsAdmin();
  const months = monthLabels(locale);
  const fmtMonths = (m: number[]) => (m.length ? m.map((n) => months[n - 1]).join(", ") : "—");

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Nom",
      primary: true,
      cell: (r) => (
        <span className="flex flex-col">
          <Link href={`/admin/cultures/${r.id}`} className="font-semibold text-primary underline">
            {r.nameFr}
          </Link>
          <span className="text-sm text-ink-muted">Cycle de {r.cycleDays} jours</span>
        </span>
      ),
    },
    { key: "sow", header: "Semis", cell: (r) => fmtMonths(r.sowingMonths) },
    { key: "harvest", header: "Récolte", cell: (r) => fmtMonths(r.harvestMonths), hideOnMobile: true },
    { key: "temp", header: "Température optimale", cell: (r) => `${r.optimalTempMin} à ${r.optimalTempMax} °C`, hideOnMobile: true },
    { key: "rain", header: "Pluie minimale", cell: (r) => `${r.minRainMm} mm`, hideOnMobile: true },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <Button href={`/admin/cultures/${r.id}`} size="sm" variant="secondary">
          Modifier
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cultures" icon={<IconSemis size={32} />} subtitle={`${rows.length} culture(s)`} />
      {rows.length === 0 ? (
        <EmptyState icon={<IconSemis size={40} />} title="Aucune culture" message="Le catalogue est vide : lancez le jeu de données initial." />
      ) : (
        <DataTable caption="Cultures" columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
