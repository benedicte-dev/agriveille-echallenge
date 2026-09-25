import { TextField } from "./AdminForm";

/**
 * Champ français + variantes fon / yoruba éditables. Laissées vides (ou
 * inchangées alors que le français change), elles sont traduites
 * automatiquement à l'enregistrement ; une saisie manuelle est conservée.
 */
export function LocalizedFields({
  name,
  label,
  values,
  rows,
  maxFr,
  maxLz,
  required = true,
}: {
  name: string;
  label: string;
  values: { fr?: string | null; fon?: string | null; yo?: string | null };
  rows?: number;
  maxFr: number;
  maxLz: number;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <TextField name={`${name}Fr`} label={`${label} (français)`} defaultValue={values.fr} rows={rows} maxLength={maxFr} required={required} lang="fr" />
      <details className="flex flex-col gap-3" open={Boolean(values.fon || values.yo)}>
        <summary className="min-h-touch cursor-pointer py-2 font-semibold text-primary">Versions fon et yoruba</summary>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <TextField
            name={`${name}Fon`}
            label={`${label} (fon)`}
            hint="Vide : traduit automatiquement à l'enregistrement."
            defaultValue={values.fon}
            rows={rows}
            maxLength={maxLz}
            lang="fon"
          />
          <TextField
            name={`${name}Yo`}
            label={`${label} (yoruba)`}
            hint="Vide : traduit automatiquement à l'enregistrement."
            defaultValue={values.yo}
            rows={rows}
            maxLength={maxLz}
            lang="yo"
          />
        </div>
      </details>
    </div>
  );
}
