/**
 * Remplit les champs fon / yoruba encore vides du contenu CMS (Crop, Pest,
 * Regulation, LevyRate) avec l'API 229langues.
 *
 *   pnpm exec tsx --env-file=.env scripts/content/translate-content.ts [--dry-run]
 *
 * - Ne touche jamais un champ déjà rempli (une correction manuelle faite dans
 *   /admin est donc préservée) ; relançable sans risque.
 * - Cache partagé avec l'application : table TranslationCache (même clé
 *   sha256(lang + texte)), donc une relance ou une sauvegarde CMS ne repaie pas.
 * - Markdown (Regulation.body) : traduit ligne à ligne, préfixes conservés
 *   (src/server/content/segments.ts).
 * - Hors Next : on n'importe pas src/server/langues.ts (« server-only »), on
 *   utilise le client pur de src/lib/langues/core.ts réglé pour les scripts.
 */
import { PrismaClient } from "@prisma/client";
import type { TargetLang, TranslationCacheStore } from "../../src/lib/langues/core";
import { cleanTranslation } from "../../src/lib/i18n/format";
import { rebuildMarkdown, segmentMarkdown, type Segmented } from "../../src/server/content/segments";
import { loadEnv, scriptClient, summarize, type CallStat } from "../i18n/shared";

const DRY_RUN = process.argv.includes("--dry-run");
const CHUNK = Number(process.env.CONTENT_CHUNK ?? 20);
const LANGS: TargetLang[] = ["fon", "yo"];

type Model = "crop" | "pest" | "regulation" | "levyRate";

interface Job {
  model: Model;
  id: string;
  label: string;
  /** Racine du champ : name, symptoms… → nameFr / nameFon / nameYo. */
  field: string;
  fr: string;
  markdown: boolean;
  missing: TargetLang[];
  seg: Segmented;
}

const prisma = new PrismaClient();

const dbCache: TranslationCacheStore = {
  async get(key) {
    const row = await prisma.translationCache.findUnique({ where: { sourceHash: key } });
    return row?.text ?? null;
  },
  async set({ key, lang, source, text }) {
    await prisma.translationCache.upsert({
      where: { sourceHash: key },
      create: { sourceHash: key, lang, source, text },
      update: { text },
    });
  },
};

const suffix = (lang: TargetLang) => (lang === "fon" ? "Fon" : "Yo");

function jobsFor(
  model: Model,
  rows: Record<string, unknown>[],
  fields: { field: string; markdown?: boolean }[],
  labelOf: (r: Record<string, unknown>) => string,
): Job[] {
  const jobs: Job[] = [];
  for (const row of rows) {
    for (const { field, markdown = false } of fields) {
      const fr = row[`${field}Fr`];
      if (typeof fr !== "string" || fr.trim().length === 0) continue;
      const missing = LANGS.filter((l) => {
        const v = row[`${field}${suffix(l)}`];
        return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
      });
      if (missing.length === 0) continue;
      const seg: Segmented = markdown ? segmentMarkdown(fr) : { texts: [fr.trim()], lines: [] };
      jobs.push({ model, id: String(row.id), label: labelOf(row), field, fr, markdown, missing, seg });
    }
  }
  return jobs;
}

async function main() {
  loadEnv();
  const started = Date.now();

  const [crops, pests, regulations, levies] = await Promise.all([
    prisma.crop.findMany(),
    prisma.pest.findMany(),
    prisma.regulation.findMany(),
    prisma.levyRate.findMany(),
  ]);

  const jobs: Job[] = [
    ...jobsFor("crop", crops, [{ field: "name" }], (r) => String(r.slug)),
    ...jobsFor(
      "pest",
      pests,
      [{ field: "name" }, { field: "symptoms" }, { field: "prevention" }, { field: "treatment" }],
      (r) => String(r.slug),
    ),
    ...jobsFor(
      "regulation",
      regulations,
      [{ field: "title" }, { field: "summary" }, { field: "body", markdown: true }],
      (r) => String(r.slug),
    ),
    ...jobsFor("levyRate", levies, [{ field: "label" }], (r) => String(r.code)),
  ];

  console.log(`Champs à traduire : ${jobs.length} (fon ${jobs.filter((j) => j.missing.includes("fon")).length}, yo ${jobs.filter((j) => j.missing.includes("yo")).length})`);
  if (jobs.length === 0 || DRY_RUN) {
    for (const j of jobs) console.log(`  ${j.model}/${j.label}.${j.field} → ${j.missing.join(",")} (${j.seg.texts.length} segment(s))`);
    await prisma.$disconnect();
    return;
  }

  const stats: CallStat[] = [];
  const api = scriptClient({ stats, translations: dbCache });
  const translated: Record<TargetLang, Map<string, string>> = { fon: new Map(), yo: new Map() };
  const failedChunks: Record<TargetLang, number> = { fon: 0, yo: 0 };

  for (const lang of LANGS) {
    const sources = [...new Set(jobs.filter((j) => j.missing.includes(lang)).flatMap((j) => j.seg.texts))];
    console.log(`[${lang}] ${sources.length} textes distincts, lots de ${CHUNK}`);
    for (let i = 0; i < sources.length; i += CHUNK) {
      const chunk = sources.slice(i, i + CHUNK);
      const t0 = Date.now();
      try {
        const res = await api.translateBatch(chunk, lang);
        res.forEach((text, k) => {
          if (text) translated[lang].set(chunk[k], cleanTranslation(text));
        });
        console.log(`  [${lang}] lot ${i / CHUNK + 1} : ${res.filter(Boolean).length}/${chunk.length} en ${Math.round((Date.now() - t0) / 1000)} s`);
      } catch (err) {
        failedChunks[lang]++;
        console.warn(`  [${lang}] lot ${i / CHUNK + 1} en échec (${(err as Error).message}) : champs laissés vides, repli fr à l'affichage`);
      }
    }
  }

  let written = 0;
  let skipped = 0;
  for (const job of jobs) {
    const data: Record<string, string> = {};
    for (const lang of job.missing) {
      const parts = job.seg.texts.map((t) => translated[lang].get(t) ?? null);
      const value = job.markdown ? rebuildMarkdown(job.seg, parts) : parts[0];
      if (value) data[`${job.field}${suffix(lang)}`] = value;
      else skipped++;
    }
    if (Object.keys(data).length === 0) continue;
    // Écriture conditionnelle : seulement si le champ est toujours vide (pas d'écrasement d'une correction faite entre-temps).
    for (const [key, value] of Object.entries(data)) {
      const where = { id: job.id, [key]: null };
      const args = { where, data: { [key]: value } };
      const { count } =
        job.model === "crop"
          ? await prisma.crop.updateMany(args as Parameters<typeof prisma.crop.updateMany>[0])
          : job.model === "pest"
            ? await prisma.pest.updateMany(args as Parameters<typeof prisma.pest.updateMany>[0])
            : job.model === "regulation"
              ? await prisma.regulation.updateMany(args as Parameters<typeof prisma.regulation.updateMany>[0])
              : await prisma.levyRate.updateMany(args as Parameters<typeof prisma.levyRate.updateMany>[0]);
      written += count;
    }
  }

  const s = summarize(stats);
  console.log(
    `Terminé en ${Math.round((Date.now() - started) / 1000)} s : ${written} champs écrits, ${skipped} laissés vides (repli fr).` +
      ` Appels API : ${s.calls} (${s.ok} OK, moyenne ${s.avgMs} ms, max ${s.maxMs} ms). Lots en échec : fon ${failedChunks.fon}, yo ${failedChunks.yo}.`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("translate-content : échec", err);
  await prisma.$disconnect();
  process.exit(1);
});
