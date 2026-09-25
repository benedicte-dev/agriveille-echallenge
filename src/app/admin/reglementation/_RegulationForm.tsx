import { REGULATION_CATEGORIES } from "@/server/content/schemas";
import { saveRegulationAction } from "../actions";
import { AdminForm, CheckboxField, SelectField, Submit, TextField } from "../_ui/AdminForm";
import { LocalizedFields } from "../_ui/LocalizedFields";

export const CATEGORY_LABELS: Record<(typeof REGULATION_CATEGORIES)[number], string> = {
  PHYTO: "Phytosanitaire",
  SEEDS: "Semences",
  EXPORT: "Exportation",
  TAX: "Fiscalité",
  LAND: "Foncier",
  ORGANIC: "Agriculture biologique",
};

type Reg = {
  id: string;
  slug: string;
  category: string;
  titleFr: string;
  titleFon: string | null;
  titleYo: string | null;
  summaryFr: string;
  summaryFon: string | null;
  summaryYo: string | null;
  bodyFr: string;
  bodyFon: string | null;
  bodyYo: string | null;
  sourceRef: string | null;
  published: boolean;
};

/** Formulaire partagé création / édition d'une fiche réglementaire. */
export function RegulationForm({ reg }: { reg?: Reg }) {
  return (
    <AdminForm action={saveRegulationAction} className="rounded-2xl border border-line bg-surface p-4">
      {reg ? <input type="hidden" name="id" value={reg.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="slug" label="Identifiant d'URL (slug)" hint="Minuscules, chiffres et tirets." defaultValue={reg?.slug} required maxLength={80} />
        <SelectField
          name="category"
          label="Catégorie"
          required
          defaultValue={reg?.category ?? "PHYTO"}
          options={REGULATION_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
        />
      </div>
      <LocalizedFields name="title" label="Titre" values={{ fr: reg?.titleFr, fon: reg?.titleFon, yo: reg?.titleYo }} maxFr={160} maxLz={300} />
      <LocalizedFields name="summary" label="Résumé" rows={3} values={{ fr: reg?.summaryFr, fon: reg?.summaryFon, yo: reg?.summaryYo }} maxFr={400} maxLz={800} />
      <LocalizedFields name="body" label="Texte de la fiche" rows={12} values={{ fr: reg?.bodyFr, fon: reg?.bodyFon, yo: reg?.bodyYo }} maxFr={20000} maxLz={40000} />
      <TextField name="sourceRef" label="Référence légale" hint="Texte officiel réel uniquement ; laissez vide si inconnue." defaultValue={reg?.sourceRef} maxLength={300} />
      <CheckboxField name="published" label="Publiée (visible par le public)" defaultChecked={reg?.published ?? false} />
      <CheckboxField name="autoTranslate" label="Traduire automatiquement en fon et yoruba" defaultChecked />
      <div>
        <Submit>{reg ? "Enregistrer les modifications" : "Créer la fiche"}</Submit>
      </div>
    </AdminForm>
  );
}
