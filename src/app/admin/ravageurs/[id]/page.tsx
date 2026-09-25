import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconInsecte } from "@/components/icons";
import { Callout, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { cropOptions, getPestAdmin } from "@/server/content/admin-cms";
import { savePestAction } from "../../actions";
import { AdminForm, CheckboxField, CheckboxGroup, SelectField, Submit, TextField } from "../../_ui/AdminForm";
import { LocalizedFields } from "../../_ui/LocalizedFields";
import { one, type SearchParams } from "../../_ui/format";

export const metadata: Metadata = { title: "Modifier un ravageur" };

export default async function EditPestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireRole("ADMIN");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(id).success) notFound();
  const [pest, crops] = await Promise.all([getPestAdmin(id), cropOptions()]);
  if (!pest) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={pest.nameFr}
        icon={<IconInsecte size={32} />}
        subtitle={pest.kind === "PEST" ? "Ravageur" : "Maladie"}
        backHref="/admin/ravageurs"
        backLabel="Retour aux ravageurs"
      />
      {one(sp.cree) ? <Callout tone="success" role="status" title="Fiche créée." /> : null}
      <AdminForm action={savePestAction} className="rounded-2xl border border-line bg-surface p-4">
        <input type="hidden" name="id" value={pest.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="slug" label="Identifiant d'URL (slug)" hint="Minuscules, chiffres et tirets." defaultValue={pest.slug} required maxLength={80} />
          <SelectField
            name="kind"
            label="Type"
            required
            defaultValue={pest.kind}
            options={[
              { value: "PEST", label: "Ravageur" },
              { value: "DISEASE", label: "Maladie" },
            ]}
          />
        </div>
        <LocalizedFields name="name" label="Nom" values={{ fr: pest.nameFr, fon: pest.nameFon, yo: pest.nameYo }} maxFr={120} maxLz={200} />
        <CheckboxGroup
          name="cropIds"
          legend="Cultures touchées"
          options={crops.map((c) => ({ value: c.id, label: c.nameFr }))}
          defaultValue={pest.crops.map((c) => c.id)}
          columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        />
        <LocalizedFields name="symptoms" label="Symptômes" rows={4} values={{ fr: pest.symptomsFr, fon: pest.symptomsFon, yo: pest.symptomsYo }} maxFr={3000} maxLz={5000} />
        <LocalizedFields name="prevention" label="Prévention" rows={4} values={{ fr: pest.preventionFr, fon: pest.preventionFon, yo: pest.preventionYo }} maxFr={3000} maxLz={5000} />
        <LocalizedFields name="treatment" label="Traitement" rows={4} values={{ fr: pest.treatmentFr, fon: pest.treatmentFon, yo: pest.treatmentYo }} maxFr={3000} maxLz={5000} />
        <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-base font-semibold">Seuils de risque (alertes automatiques)</legend>
          <p className="text-sm text-ink-muted">Laissez un champ vide pour ne pas utiliser ce critère.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField name="riskTempMin" label="Température minimale (°C)" type="number" step="0.1" min={-5} max={50} inputMode="decimal" defaultValue={pest.riskTempMin} />
            <TextField name="riskTempMax" label="Température maximale (°C)" type="number" step="0.1" min={-5} max={50} inputMode="decimal" defaultValue={pest.riskTempMax} />
            <TextField name="riskHumidityMin" label="Humidité minimale (%)" type="number" step="1" min={0} max={100} inputMode="decimal" defaultValue={pest.riskHumidityMin} />
          </div>
        </fieldset>
        <CheckboxField name="autoTranslate" label="Traduire automatiquement en fon et yoruba" defaultChecked />
        <div>
          <Submit>Enregistrer les modifications</Submit>
        </div>
      </AdminForm>
    </div>
  );
}
