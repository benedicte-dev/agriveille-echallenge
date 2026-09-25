import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconRegle } from "@/components/icons";
import { Badge, Callout, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { getRegulationAdmin } from "@/server/content/admin-cms";
import { getTranslator } from "@/server/content/ui/i18n";
import { deleteRegulationAction } from "../../actions";
import { AdminForm } from "../../_ui/AdminForm";
import { ConfirmSubmit } from "../../_ui/ConfirmSubmit";
import { fmtDateTime, one, type SearchParams } from "../../_ui/format";
import { RegulationForm } from "../_RegulationForm";

export const metadata: Metadata = { title: "Modifier une fiche réglementaire" };

export default async function EditRegulationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireRole("ADMIN");
  const { locale } = await getTranslator();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(id).success) notFound();
  const reg = await getRegulationAdmin(id);
  if (!reg) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={reg.titleFr}
        icon={<IconRegle size={32} />}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={reg.published ? "success" : "neutral"}>{reg.published ? "Publiée" : "Brouillon"}</Badge>
            <span>Mise à jour le {fmtDateTime(reg.updatedAt, locale)}</span>
          </span>
        }
        backHref="/admin/reglementation"
        backLabel="Retour aux fiches"
      />
      {one(sp.cree) ? <Callout tone="success" role="status" title="Fiche créée." /> : null}
      <RegulationForm reg={reg} />
      <section aria-labelledby="reg-danger" className="flex flex-col gap-3 rounded-2xl border border-critical p-4">
        <h2 id="reg-danger" className="text-xl">
          Supprimer la fiche
        </h2>
        <p className="text-ink-muted">La suppression est définitive. Pour la retirer temporairement, dépubliez-la.</p>
        <AdminForm action={deleteRegulationAction} inline>
          <input type="hidden" name="id" value={reg.id} />
          <div>
            <ConfirmSubmit confirm={`Supprimer définitivement la fiche « ${reg.titleFr} » ?`}>Supprimer la fiche</ConfirmSubmit>
          </div>
        </AdminForm>
      </section>
    </div>
  );
}
