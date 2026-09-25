/**
 * Audio pré-généré (fon, yoruba) des libellés essentiels du parcours fermier.
 * Le français est lu par speechSynthesis (fr-FR) côté navigateur : pas de fichier.
 * Manifeste produit par scripts/i18n/generate-audio.ts.
 */
import manifest from "../../../public/audio/manifest.json";
import type { Locale } from "./config";

type Manifest = Partial<Record<Locale, Record<string, string>>>;
const MANIFEST: Manifest = manifest as Manifest;

/** Chemin public (ex. `/audio/fon/alert.ack.mp3`) ou null si pas d'audio. */
export function audioUrlFor(locale: Locale, key: string): string | null {
  const byKey = MANIFEST[locale];
  if (!byKey || !Object.prototype.hasOwnProperty.call(byKey, key)) return null;
  return byKey[key] ?? null;
}

export function hasAudio(locale: Locale, key: string): boolean {
  return audioUrlFor(locale, key) !== null;
}
