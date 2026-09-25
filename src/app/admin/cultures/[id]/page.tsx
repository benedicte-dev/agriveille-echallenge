import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconSemis } from "@/components/icons";
import { Callout, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { getCropAdmin } from "@/server/content/admin-cms";
import { CROP_ICON_KEYS, normalizeCropIcon } from "@/server/content/schemas";
import { getTranslator } from "@/server/content/ui/i18n";
import { saveCropAction } from "../../actions";
import { AdminForm, CheckboxField, CheckboxGroup, SelectField, Submit, TextField } from "../../_ui/AdminForm";
import { LocalizedFields } from "../../_ui/LocalizedFields";
import { monthLabels, one, type SearchParams } from "../../_ui/format";

export const metadata: Metadata = { title: "Modifier une culture" };

export default async function EditCropPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireRole("ADMIN");
  const [{ id }, sp, { locale }] = await Promise.all([params, searchParams, getTranslator()]);
  if (!idSchema.safeParse(id).success) notFound();
  const crop = await getCropAdmin(id);
  if (!crop) notFound();

  const monthOptions = monthLabels(locale).map((label, i) => ({ value: String(i + 1), label }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={crop.nameFr}
        icon={<IconSemis size={32} />}
        subtitle={`Cycle de ${crop.cycleDays} jours`}
        backHref="/admin/cultures"
        backLabel="Retour aux cultures"
      />
      {one(sp.cree) ? <Callout tone="success" role="status" title="Culture créée." /> : null}
      <AdminForm action={saveCropAction} className="rounded-2xl border border-line bg-surface p-4">
        <input type="hidden" name="id" value={crop.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="slug" label="Identifiant d'URL (slug)" hint="Minuscules, chiffres et tirets." defaultValue={crop.slug} required maxLength={80} />
          <SelectField
            name="icon"
            label="Pictogramme"
            required
            defaultValue={normalizeCropIcon(crop.icon)}
            options={CROP_ICON_KEYS.map((k) => ({ value: k, label: k }))}
          />
        </div>
        <LocalizedFields name="name" label="Nom" values={{ fr: crop.nameFr, fon: crop.nameFon, yo: crop.nameYo }} maxFr={80} maxLz={120} />
        <CheckboxGroup name="sowingMonths" legend="Mois de semis" options={monthOptions} defaultValue={crop.sowingMonths.map(String)} />
        <CheckboxGroup name="harvestMonths" legend="Mois de récolte" options={monthOptions} defaultValue={crop.harvestMonths.map(String)} />
        <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-base font-semibold">Besoins agronomiques</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="cycleDays" label="Durée du cycle (jours)" type="number" step="1" min={20} max={1000} inputMode="numeric" required defaultValue={crop.cycleDays} />
            <TextField name="minRainMm" label="Pluie minimale sur le cycle (mm)" type="number" step="1" min={0} max={5000} inputMode="numeric" required defaultValue={crop.minRainMm} />
            <TextField name="optimalTempMin" label="Température optimale minimale (°C)" type="number" step="0.1" min={-5} max={50} inputMode="decimal" required defaultValue={crop.optimalTempMin} />
            <TextField name="optimalTempMax" label="Température optimale maximale (°C)" type="number" step="0.1" min={-5} max={50} inputMode="decimal" required defaultValue={crop.optimalTempMax} />
          </div>
        </fieldset>
        <TextField name="notes" label="Notes" rows={4} maxLength={2000} defaultValue={crop.notes} />
        <CheckboxField name="autoTranslate" label="Traduire automatiquement en fon et yoruba" defaultChecked />
        <div>
          <Submit>Enregistrer les modifications</Submit>
        </div>
      </AdminForm>
    </div>
  );
}
