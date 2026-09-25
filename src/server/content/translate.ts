import "server-only";

// @/server/langues branche le cache Prisma (TranslationCache) sur le client 229langues :
// on l'importe en premier pour que translateBatch en profite aussi.
import { translateWithFallback } from "@/server/langues";
import { translateBatch } from "@/lib/langues/client";
import { cleanTranslation } from "@/lib/i18n/format";
import { rebuildMarkdown, segmentMarkdown, type Segmented } from "./segments";
import { planField, type Lang, type LangDecision } from "./translation-plan";

/**
 * Traduction automatique des champs d'un contenu CMS à l'enregistrement.
 * - Un seul appel « batch » par langue pour tous les segments du formulaire
 *   (l'API est limitée à 5 requêtes / minute ; toTrilingual ferait un appel par
 *   texte) ; fon et yoruba partent en parallèle.
 * - Le markdown est traduit ligne à ligne (segments.ts).
 * - Ne lève jamais : un échec laisse le champ vide (repli français) et le
 *   signale dans `failed` pour que l'écran le dise.
 */
export interface TranslatableField {
  key: string;
  prevFr: string | null;
  nextFr: string;
  prev: Record<Lang, string | null>;
  submitted: Record<Lang, string | null | undefined>;
  markdown?: boolean;
}

export interface TranslationOutcome {
  values: Record<string, Record<Lang, string | null>>;
  /** Nombre de champs traduits automatiquement avec succès. */
  translated: number;
  /** Langues / champs pour lesquels l'API a échoué (repli fr). */
  failed: number;
}

export async function resolveTranslations(fields: TranslatableField[], autoTranslate: boolean): Promise<TranslationOutcome> {
  const plans = fields.map((f) => ({ f, plan: planField(f, autoTranslate) }));
  const values: TranslationOutcome["values"] = {};
  let translated = 0;
  let failed = 0;

  for (const { f, plan } of plans) {
    values[f.key] = {
      fon: plan.fon.action === "keep" ? plan.fon.value : null,
      yo: plan.yo.action === "keep" ? plan.yo.value : null,
    };
  }

  const perLang = await Promise.all(
    (["fon", "yo"] as const).map(async (lang) => {
      const todo = plans.filter(({ plan }) => (plan[lang] as LangDecision).action === "translate");
      const segs = new Map<string, Segmented>();
      const sources: string[] = [];
      for (const { f } of todo) {
        const seg: Segmented = f.markdown ? segmentMarkdown(f.nextFr) : { texts: [f.nextFr.trim()], lines: [] };
        segs.set(f.key, seg);
        for (const t of seg.texts) if (!sources.includes(t)) sources.push(t);
      }
      const byText = new Map<string, string>();
      try {
        if (sources.length === 1) {
          const r = await translateWithFallback(sources[0], lang);
          if (!r.fallback) byText.set(sources[0], cleanTranslation(r.text));
        } else if (sources.length > 1) {
          const res = await translateBatch(sources, lang);
          res.forEach((v, i) => {
            if (v) byText.set(sources[i], cleanTranslation(v));
          });
        }
      } catch (err) {
        console.error("[content] traduction automatique en échec", { lang, count: sources.length, err: String(err) });
      }
      return { lang, todo, segs, byText };
    }),
  );

  for (const { lang, todo, segs, byText } of perLang) {
    for (const { f } of todo) {
      const seg = segs.get(f.key)!;
      const parts = seg.texts.map((t) => byText.get(t) ?? null);
      const value = f.markdown ? rebuildMarkdown(seg, parts) : parts[0];
      if (value) {
        values[f.key][lang] = value;
        translated++;
      } else {
        values[f.key][lang] = null;
        failed++;
      }
    }
  }

  return { values, translated, failed };
}
