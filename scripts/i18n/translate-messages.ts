/**
 * Génère src/lib/i18n/messages/{fon,yo}.json à partir de fr.json via l'API
 * 229langues, puis écrit scripts/i18n/REPORT.md.
 *
 *   pnpm exec tsx scripts/i18n/translate-messages.ts
 *
 * - Variables {x} protégées en __V0__ avant l'envoi (le moteur traduit « {name} »),
 *   restaurées et vérifiées après ; en cas de perte : repli fr pour la clé.
 * - Cache disque scripts/i18n/.cache/translations.json : relancer reprend là où
 *   l'on s'est arrêté (seuls les textes manquants repartent vers l'API).
 * - Débit : un appel toutes les 12,5 s (limite de l'API : 5 req/min).
 */
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { protectVars, restoreVars } from "../../src/lib/i18n/format";
import type { TargetLang } from "../../src/lib/langues/core";
import {
  CACHE_DIR,
  MESSAGES_DIR,
  ROOT,
  diskTranslationCache,
  loadEnv,
  readJson,
  scriptClient,
  summarize,
  writeJson,
  type CallStat,
} from "./shared";

/** Clés recopiées telles quelles (noms propres, noms de langues, unités). */
const KEEP_AS_IS = new Set(["app.name", "lang.fr", "lang.fon", "lang.yo", "common.kg", "common.fcfa"]);

const SAMPLE_KEYS = [
  "nav.home",
  "tile.parcels",
  "tile.weather",
  "tile.alerts",
  "tile.report",
  "tile.market",
  "dashboard.hello",
  "auth.pin_hint",
  "auth.wrong",
  "alert.ack",
  "alert.type.DROUGHT",
  "alert.type.HEAVY_RAIN",
  "report.take_photo",
  "market.sell",
  "offline.message",
];

const BATCH = 50;

type Outcome = { text: string; status: "translated" | "kept" | "fallback"; reason?: string };

async function main() {
  loadEnv();
  const fr = readJson<Record<string, string>>(join(MESSAGES_DIR, "fr.json"), {});
  const keys = Object.keys(fr);
  const stats: CallStat[] = [];
  const cache = diskTranslationCache(join(CACHE_DIR, "translations.json"));
  const api = scriptClient({ stats, translations: cache });
  const started = Date.now();

  const outcomes: Record<TargetLang, Record<string, Outcome>> = { fon: {}, yo: {} };

  for (const lang of ["fon", "yo"] as const) {
    console.log(`\n== ${lang} : ${keys.length} clés`);
    // Textes uniques à envoyer (après protection des variables).
    const prepared = new Map<string, { text: string; tokens: string[] }>();
    const unique: string[] = [];
    for (const key of keys) {
      if (KEEP_AS_IS.has(key)) continue;
      const p = protectVars(fr[key]);
      prepared.set(key, p);
      if (!unique.includes(p.text)) unique.push(p.text);
    }

    const translated = new Map<string, string | null>();
    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);
      process.stdout.write(`  lot ${i / BATCH + 1}/${Math.ceil(unique.length / BATCH)} (${chunk.length})… `);
      try {
        const res = await api.translateBatch(chunk, lang);
        chunk.forEach((src, j) => translated.set(src, res[j]));
        console.log(`ok (${res.filter((r) => r === null).length} échecs)`);
      } catch (err) {
        console.log(`échec du lot : ${(err as Error).message}`);
        chunk.forEach((src) => translated.set(src, null));
      }
    }

    // Seconde chance, un par un, pour les éléments échoués.
    for (const [src, out] of translated) {
      if (out !== null) continue;
      try {
        translated.set(src, await api.translate(src, lang));
      } catch (err) {
        console.warn(`  échec unitaire « ${src.slice(0, 40)} » : ${(err as Error).message}`);
      }
    }

    const dict: Record<string, string> = {};
    for (const key of keys) {
      if (KEEP_AS_IS.has(key)) {
        dict[key] = fr[key];
        outcomes[lang][key] = { text: fr[key], status: "kept" };
        continue;
      }
      const p = prepared.get(key)!;
      const out = translated.get(p.text) ?? null;
      if (out === null) {
        dict[key] = fr[key];
        outcomes[lang][key] = { text: fr[key], status: "fallback", reason: "API en échec" };
        continue;
      }
      const restored = restoreVars(out, p.tokens);
      if (!restored.ok) {
        dict[key] = fr[key];
        outcomes[lang][key] = { text: fr[key], status: "fallback", reason: restored.reason };
        continue;
      }
      dict[key] = restored.text;
      outcomes[lang][key] = { text: restored.text, status: "translated" };
    }
    writeJson(join(MESSAGES_DIR, `${lang}.json`), dict);
    console.log(`  écrit messages/${lang}.json`);
  }

  writeReport(fr, outcomes, stats, Date.now() - started);
  console.log("\nAppels API :", summarize(stats));
}

function writeReport(
  fr: Record<string, string>,
  outcomes: Record<TargetLang, Record<string, Outcome>>,
  stats: CallStat[],
  elapsedMs: number,
) {
  const keys = Object.keys(fr);
  const count = (lang: TargetLang, s: Outcome["status"]) =>
    keys.filter((k) => outcomes[lang][k].status === s).length;
  const same = (lang: TargetLang) =>
    keys.filter((k) => outcomes[lang][k].status === "translated" && outcomes[lang][k].text === fr[k]);
  const s = summarize(stats);
  const esc = (x: string) => x.replace(/\|/g, "\\|");

  const lines: string[] = [
    "# Rapport de traduction automatique (fr → fon, yo)",
    "",
    `Généré le ${new Date().toISOString()} par \`scripts/i18n/translate-messages.ts\`.`,
    "",
    "> **Avertissement honnête.** Ces traductions sortent d'un moteur automatique (API 229langues).",
    "> Elles n'ont été relues par **aucune personne locutrice** du fon ni du yoruba. Elles peuvent",
    "> être approximatives, trop littérales, voire fausses sur les termes agricoles ou techniques.",
    "> Avant toute mise en production auprès des fermiers, une relecture par des locuteurs natifs",
    "> (idéalement des agents de vulgarisation agricole) est indispensable. L'interface affiche",
    "> la mention `lang.machine_notice` pour le signaler.",
    "",
    "## Chiffres",
    "",
    "| | fon | yo |",
    "|---|---|---|",
    `| Clés au total | ${keys.length} | ${keys.length} |`,
    `| Traduites | ${count("fon", "translated")} | ${count("yo", "translated")} |`,
    `| Recopiées telles quelles (noms propres, unités) | ${count("fon", "kept")} | ${count("yo", "kept")} |`,
    `| Repli français | ${count("fon", "fallback")} | ${count("yo", "fallback")} |`,
    `| Traduction identique au français | ${same("fon").length} | ${same("yo").length} |`,
    "",
    `Appels API (cette exécution) : ${s.calls} (dont ${s.ok} réussis), durée moyenne ${s.avgMs} ms, max ${s.maxMs} ms.`,
    `Durée totale : ${Math.round(elapsedMs / 1000)} s (débit volontairement limité à ~5 appels/min).`,
    "Les textes déjà en cache disque ne repartent pas vers l'API : une relance peut faire 0 appel.",
    "",
    "## Clés en repli français",
    "",
  ];
  const fallbacks = (["fon", "yo"] as const).flatMap((lang) =>
    keys
      .filter((k) => outcomes[lang][k].status === "fallback")
      .map((k) => `- \`${lang}\` \`${k}\` : ${outcomes[lang][k].reason}`),
  );
  lines.push(...(fallbacks.length ? fallbacks : ["Aucune."]), "");

  lines.push(
    "## Échantillon pour relecture (15 paires)",
    "",
    "| Clé | Français | Fɔngbe (auto) | Yorùbá (auto) |",
    "|---|---|---|---|",
    ...SAMPLE_KEYS.filter((k) => k in fr).map(
      (k) =>
        `| \`${k}\` | ${esc(fr[k])} | ${esc(outcomes.fon[k].text)} | ${esc(outcomes.yo[k].text)} |`,
    ),
    "",
    "## Procédure de correction",
    "",
    "1. Corriger directement `src/lib/i18n/messages/fon.json` ou `yo.json` (ne pas relancer le script",
    "   après correction manuelle : il réécrit les fichiers).",
    "2. Garder les variables `{name}`, `{count}`… à l'identique.",
    "3. Relancer `pnpm exec vitest run src/lib/i18n` : un test vérifie que les jeux de clés et les",
    "   variables sont identiques entre les trois langues.",
    "",
  );
  writeFileSync(join(ROOT, "scripts/i18n/REPORT.md"), lines.join("\n"), "utf8");
  console.log("  écrit scripts/i18n/REPORT.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
