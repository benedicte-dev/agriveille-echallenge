/**
 * Décide, à l'enregistrement d'un contenu CMS, quelles traductions fon / yo
 * demander à l'API et lesquelles garder (module pur).
 *
 * Règles, pour chaque langue :
 * 1. Saisie manuelle : si la personne a modifié le champ (valeur envoyée non
 *    vide et différente de la valeur en base), on la garde telle quelle — c'est
 *    une correction par une personne locutrice.
 * 2. Sinon, si le français a changé ou si le champ est vide → traduction auto.
 * 3. Sinon on garde la valeur existante.
 * Une case « Traduire automatiquement » décochée désactive la règle 2 : le
 * champ vide reste vide (repli français à l'affichage).
 */
export type Lang = "fon" | "yo";

export interface FieldState {
  prevFr: string | null;
  nextFr: string;
  prev: Record<Lang, string | null>;
  submitted: Record<Lang, string | null | undefined>;
}

export type LangDecision = { action: "keep"; value: string | null } | { action: "translate" };

const clean = (v: string | null | undefined) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > 0 ? t : null;
};

export function planField(state: FieldState, autoTranslate: boolean): Record<Lang, LangDecision> {
  const frChanged = state.prevFr === null || state.prevFr.trim() !== state.nextFr.trim();
  const out = {} as Record<Lang, LangDecision>;
  for (const lang of ["fon", "yo"] as const) {
    const submitted = clean(state.submitted[lang]);
    const prev = clean(state.prev[lang]);
    const manualEdit = submitted !== null && submitted !== prev;
    if (manualEdit) out[lang] = { action: "keep", value: submitted };
    else if (autoTranslate && (frChanged || submitted === null)) out[lang] = { action: "translate" };
    else out[lang] = { action: "keep", value: frChanged ? null : submitted };
  }
  return out;
}
