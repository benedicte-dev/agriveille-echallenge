/**
 * État renvoyé par les Server Actions M3 aux formulaires (useActionState). Module pur.
 */
export interface ActionState {
  status: "idle" | "success" | "error";
  /** Message déjà traduit, affiché dans un Callout. */
  message?: string;
  /** Erreurs par champ, déjà traduites. */
  fieldErrors?: Record<string, string>;
  /** Donnée utile au client après succès (ex. numéro de quittance). */
  data?: Record<string, string | number | boolean>;
}

export const IDLE: ActionState = { status: "idle" };

/** Champs texte d'un FormData, limités à une liste blanche (les champs internes de Next sont ignorés). */
export function pickFields(formData: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = formData.get(k);
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
