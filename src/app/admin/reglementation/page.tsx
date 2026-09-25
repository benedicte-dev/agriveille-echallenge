import type { Metadata } from "next";
import Link from "next/link";
import { IconPlus, IconRegle } from "@/components/icons";
import { Badge, Button, Callout, DataTable, EmptyState, PageHeader, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { listRegulationsAdmin } from "@/server/content/admin-cms";
import { getTranslator } from "@/server/content/ui/i18n";
import { publishRegulationAction } from "../actions";
import { AdminForm, Submit } from "../_ui/AdminForm";
import { fmtDate, one, type SearchParams } from "../_ui/format";
import { CATEGORY_LABELS } from "./_RegulationForm";

export const metadata: Metadata = { title: "Réglementation" };

type Row = Awaited<ReturnType<typeof listRegulationsAdmin>>[number];

export default async function AdminRegulationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("ADMIN");
  const { locale } = await getTranslator();
  const sp = await searchParams;
  const rows = await listRegulationsAdmin();

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Titre",
      primary: true,
      cell: (r) => (
        <span className="flex flex-col">
          <Link href={`/admin/reglementation/${r.id}`} className="font-semibold text-primary underline">
            {r.titleFr}
          </Link>
          <span className="text-sm text-ink-muted">
            {r.titleFon && r.titleYo ? "Traduite en fon et yoruba" : "Traduction incomplète"}
          </span>
        </span>
      ),
    },
    { key: "cat", header: "Catégorie", cell: (r) => CATEGORY_LABELS[r.category], hideOnMobile: true },
    { key: "upd", header: "Mise à jour", cell: (r) => fmtDate(r.updatedAt, locale), hideOnMobile: true },
    {
      key: "status",
      header: "Statut",
      cell: (r) => <Badge tone={r.published ? "success" : "neutral"}>{r.published ? "Publiée" : "Brouillon"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex flex-wrap items-start gap-2">
          <Button href={`/admin/reglementation/${r.id}`} size="sm" variant="secondary">
            Modifier
          </Button>
          <AdminForm action={publishRegulationAction} inline>
            <input type="hidden" name="id" value={r.id} />
            {r.published ? null : <input type="hidden" name="published" value="on" />}
            <Submit size="sm" variant={r.published ? "secondary" : "primary"}>
              {r.published ? "Dépublier" : "Publier"}
            </Submit>
          </AdminForm>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fiches réglementaires"
        icon={<IconRegle size={32} />}
        subtitle={`${rows.length} fiche(s), ${rows.filter((r) => r.published).length} publiée(s)`}
        actions={
          <Button href="/admin/reglementation/nouvelle" size="sm" icon={<IconPlus size={20} />}>
            Nouvelle fiche
          </Button>
        }
      />
      {one(sp.supprime) ? <Callout tone="success" role="status" title="Fiche supprimée." /> : null}
      {rows.length === 0 ? (
        <EmptyState
          icon={<IconRegle size={40} />}
          title="Aucune fiche réglementaire"
          message="Créez la première fiche pour informer les producteurs."
          action={<Button href="/admin/reglementation/nouvelle" size="sm">Nouvelle fiche</Button>}
        />
      ) : (
        <DataTable caption="Fiches réglementaires" columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
