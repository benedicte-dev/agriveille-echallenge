import type { Metadata } from "next";
import Link from "next/link";
import { IconInsecte } from "@/components/icons";
import { Badge, Button, DataTable, EmptyState, PageHeader, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { listPestsAdmin } from "@/server/content/admin-cms";

export const metadata: Metadata = { title: "Ravageurs et maladies" };

type Row = Awaited<ReturnType<typeof listPestsAdmin>>[number];

function range(min: number | null, max: number | null, unit: string): string {
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${min} à ${max} ${unit}`;
  return min !== null ? `≥ ${min} ${unit}` : `≤ ${max} ${unit}`;
}

export default async function AdminPestsPage() {
  await requireRole("ADMIN");
  const rows = await listPestsAdmin();

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Nom",
      primary: true,
      cell: (r) => (
        <span className="flex flex-col">
          <Link href={`/admin/ravageurs/${r.id}`} className="font-semibold text-primary underline">
            {r.nameFr}
          </Link>
          <span className="text-sm text-ink-muted">{r.crops.length ? r.crops.map((c) => c.nameFr).join(", ") : "Aucune culture associée"}</span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Type",
      cell: (r) => <Badge tone={r.kind === "PEST" ? "warning" : "neutral"}>{r.kind === "PEST" ? "Ravageur" : "Maladie"}</Badge>,
    },
    { key: "temp", header: "Température à risque", cell: (r) => range(r.riskTempMin, r.riskTempMax, "°C"), hideOnMobile: true },
    { key: "hum", header: "Humidité à risque", cell: (r) => (r.riskHumidityMin === null ? "—" : `≥ ${r.riskHumidityMin} %`), hideOnMobile: true },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <Button href={`/admin/ravageurs/${r.id}`} size="sm" variant="secondary">
          Modifier
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ravageurs et maladies" icon={<IconInsecte size={32} />} subtitle={`${rows.length} fiche(s)`} />
      {rows.length === 0 ? (
        <EmptyState icon={<IconInsecte size={40} />} title="Aucun ravageur ni maladie" message="Le catalogue est vide : lancez le jeu de données initial." />
      ) : (
        <DataTable caption="Ravageurs et maladies" columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
