/**
 * Vérification des images téléversées par signature magique (jamais par
 * l'extension ni le type MIME déclaré par le client) et limites de taille.
 * Module pur : utilisable dans les Server Actions et les route handlers.
 */

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Taille maximale acceptée avant toute lecture du contenu (SPEC §8). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** Taille maximale stockée en base pour une photo de signalement (SPEC §3). */
export const MAX_STORED_PHOTO_BYTES = 300 * 1024;

export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageCheck =
  | { ok: true; mime: ImageMime; size: number }
  | { ok: false; error: "EMPTY" | "TOO_LARGE" | "BAD_TYPE" };

export interface ImageCheckOptions {
  maxBytes?: number;
  allowed?: readonly ImageMime[];
}

export function validateImageBytes(bytes: Uint8Array, opts: ImageCheckOptions = {}): ImageCheck {
  const maxBytes = opts.maxBytes ?? MAX_STORED_PHOTO_BYTES;
  const allowed = opts.allowed ?? (["image/jpeg", "image/png", "image/webp"] as const);
  if (bytes.length === 0) return { ok: false, error: "EMPTY" };
  if (bytes.length > maxBytes) return { ok: false, error: "TOO_LARGE" };
  const mime = detectImageMime(bytes);
  if (!mime || !allowed.includes(mime)) return { ok: false, error: "BAD_TYPE" };
  return { ok: true, mime, size: bytes.length };
}

/**
 * Lit un fichier de formulaire en contrôlant la taille déclarée AVANT de
 * charger le contenu, puis vérifie la signature. Renvoie les octets validés.
 */
export async function readImageFile(
  file: unknown,
  opts: ImageCheckOptions & { maxUploadBytes?: number } = {},
): Promise<{ ok: true; bytes: Uint8Array<ArrayBuffer>; mime: ImageMime } | { ok: false; error: "MISSING" | "EMPTY" | "TOO_LARGE" | "BAD_TYPE" }> {
  if (!(typeof Blob !== "undefined" && file instanceof Blob)) return { ok: false, error: "MISSING" };
  if (file.size === 0) return { ok: false, error: "EMPTY" };
  if (file.size > (opts.maxUploadBytes ?? MAX_UPLOAD_BYTES)) return { ok: false, error: "TOO_LARGE" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateImageBytes(bytes, opts);
  if (!check.ok) return check;
  return { ok: true, bytes, mime: check.mime };
}

export const IMAGE_ERROR_MESSAGES: Record<"MISSING" | "EMPTY" | "TOO_LARGE" | "BAD_TYPE", string> = {
  MISSING: "Aucune photo reçue.",
  EMPTY: "La photo est vide.",
  TOO_LARGE: "Photo trop lourde. Réessayez : elle sera compressée automatiquement.",
  BAD_TYPE: "Format non accepté. Utilisez une photo JPEG, PNG ou WebP.",
};
