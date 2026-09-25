/**
 * Génère l'audio TTS fon et yoruba des libellés essentiels du parcours
 * fermier, dans public/audio/{fon,yo}/<clé>.{mp3,wav}, et le manifeste
 * public/audio/manifest.json { locale: { key: "/audio/..." } }.
 *
 *   pnpm exec tsx scripts/i18n/generate-audio.ts
 *
 * Prérequis : messages/fon.json et yo.json (translate-messages.ts). Le texte
 * envoyé au TTS est la traduction, pas le français. Une clé restée en repli
 * français est ignorée (un modèle fon qui lit du français serait inaudible).
 * Un WAV > 150 Ko est converti en MP3 mono 32 kb/s si ffmpeg est présent.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractVars } from "../../src/lib/i18n/format";
import { sniffAudio, type VoiceLang } from "../../src/lib/langues/core";
import {
  CACHE_DIR,
  MESSAGES_DIR,
  ROOT,
  diskAudioCache,
  loadEnv,
  readJson,
  recordStats,
  scriptClient,
  summarize,
  writeJson,
  type CallStat,
} from "./shared";

/** Libellés essentiels : tuiles, boutons clés, connexion, alertes. */
export const AUDIO_KEYS = [
  "tile.parcels",
  "tile.weather",
  "tile.alerts",
  "tile.report",
  "tile.market",
  "tile.levies",
  "common.listen",
  "common.back",
  "common.next",
  "common.cancel",
  "common.confirm",
  "common.yes",
  "common.no",
  "common.retry",
  "auth.phone",
  "auth.pin",
  "auth.pin_hint",
  "auth.pin_new",
  "auth.pin_repeat",
  "auth.submit",
  "auth.erase",
  "auth.welcome",
  "auth.wrong",
  "alert.ack",
  "alert.listen",
  "alert.advice",
  "alert.new",
  "alert.type.DROUGHT",
  "alert.type.HEAVY_RAIN",
  "alert.type.HEAT",
  "alert.type.WIND",
  "alert.type.PEST_RISK",
  "alert.type.PEST_OUTBREAK",
  "alert.type.SOWING_WINDOW",
  "alert.type.HARVEST_WINDOW",
  "report.take_photo",
  "report.record",
  "report.send",
  "report.sent",
  "market.sell",
  "offline.banner",
] as const;

const MAX_WAV_BYTES = 150 * 1024;
const PUBLIC_AUDIO = join(ROOT, "public/audio");

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function toMp3(input: Buffer, outFile: string): void {
  const tmp = join(CACHE_DIR, `tmp-${process.pid}.wav`);
  writeFileSync(tmp, input);
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-i", tmp, "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "32k", outFile],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(tmp, { force: true });
  }
}

type Row = { lang: VoiceLang; key: string; file?: string; bytes?: number; note?: string };

async function main() {
  loadEnv();
  const fr = readJson<Record<string, string>>(join(MESSAGES_DIR, "fr.json"), {});
  const dicts: Record<VoiceLang, Record<string, string>> = {
    fon: readJson(join(MESSAGES_DIR, "fon.json"), {}),
    yo: readJson(join(MESSAGES_DIR, "yo.json"), {}),
  };
  const stats: CallStat[] = [];
  const api = scriptClient({ stats, audio: diskAudioCache(join(CACHE_DIR, "audio")) });
  const ffmpeg = hasFfmpeg();
  console.log(`ffmpeg : ${ffmpeg ? "présent" : "absent"}`);

  const manifest: Record<string, Record<string, string>> = { fon: {}, yo: {} };
  const rows: Row[] = [];

  for (const lang of ["fon", "yo"] as const) {
    mkdirSync(join(PUBLIC_AUDIO, lang), { recursive: true });
    for (const key of AUDIO_KEYS) {
      const text = dicts[lang][key];
      if (!text) {
        rows.push({ lang, key, note: "clé absente du dictionnaire" });
        continue;
      }
      if (text === fr[key]) {
        rows.push({ lang, key, note: "repli français : pas d'audio" });
        continue;
      }
      if (extractVars(text).length > 0) {
        rows.push({ lang, key, note: "contient une variable : pas d'audio figé" });
        continue;
      }
      process.stdout.write(`  ${lang} ${key}… `);
      try {
        const { mime, data } = await api.tts(text, lang);
        let file: string;
        if (mime === "audio/wav" && data.length > MAX_WAV_BYTES && ffmpeg) {
          file = `${key}.mp3`;
          toMp3(data, join(PUBLIC_AUDIO, lang, file));
        } else {
          file = `${key}.${mime === "audio/wav" ? "wav" : "mp3"}`;
          writeFileSync(join(PUBLIC_AUDIO, lang, file), data);
        }
        const out = readFileSync(join(PUBLIC_AUDIO, lang, file));
        if (!sniffAudio(out)) throw new Error("fichier écrit illisible (signature)");
        manifest[lang][key] = `/audio/${lang}/${file}`;
        rows.push({ lang, key, file, bytes: out.length });
        console.log(`${file} ${Math.round(out.length / 1024)} Ko`);
      } catch (err) {
        rows.push({ lang, key, note: `échec : ${(err as Error).message}` });
        console.log(`échec : ${(err as Error).message}`);
      }
    }
  }

  writeJson(join(PUBLIC_AUDIO, "manifest.json"), manifest);
  const s = summarize(stats);
  console.log("Appels API :", s);
  updateReport(rows, s, recordStats("tts", stats), ffmpeg);
}

function updateReport(
  rows: Row[],
  s: ReturnType<typeof summarize>,
  all: ReturnType<typeof summarize>,
  ffmpeg: boolean,
) {
  const reportPath = join(ROOT, "scripts/i18n/REPORT.md");
  const begin = "<!-- audio:begin -->";
  const end = "<!-- audio:end -->";
  const done = rows.filter((r) => r.file);
  const total = done.reduce((a, r) => a + (r.bytes ?? 0), 0);
  const section = [
    begin,
    "## Audio TTS (generate-audio.ts)",
    "",
    `Clés visées : ${AUDIO_KEYS.length} par langue. Fichiers produits : fon ${done.filter((r) => r.lang === "fon").length}, yo ${done.filter((r) => r.lang === "yo").length}.`,
    `Taille totale : ${Math.round(total / 1024)} Ko. ffmpeg : ${ffmpeg ? "présent (WAV > 150 Ko convertis en MP3 mono 32 kb/s)" : "absent (WAV conservés)"}.`,
    `Appels TTS (cette exécution) : ${s.calls}, durée moyenne ${s.avgMs} ms, max ${s.maxMs} ms (0 si tout venait du cache).`,
    `Cumul TTS de toutes les exécutions : ${all.ok} appels réussis, durée moyenne ${all.avgMs} ms, max ${all.maxMs} ms.`,
    "",
    "La voix est synthétique et lit la traduction automatique : même réserve de relecture que le texte.",
    "",
    ...rows.filter((r) => r.note).map((r) => `- \`${r.lang}\` \`${r.key}\` : ${r.note}`),
    end,
  ].join("\n");
  const current = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";
  const next = current.includes(begin)
    ? current.replace(new RegExp(`${begin}[\\s\\S]*${end}`), section)
    : `${current.trimEnd()}\n\n${section}\n`;
  writeFileSync(reportPath, next, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
