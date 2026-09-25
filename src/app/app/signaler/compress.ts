/**
 * Compression côté navigateur avant tout envoi (SPEC §6) : 1280 px au plus sur
 * le grand côté, webp qualité 0,7 (jpeg si le navigateur ne sait pas encoder
 * le webp). Si le résultat dépasse 300 Ko, on baisse la qualité puis la taille
 * (E3) : la photo reçue par le serveur est toujours sous la limite stockée.
 */
export const MAX_SIDE_PX = 1280;
export const TARGET_QUALITY = 0.7;
export const MAX_PHOTO_BYTES = 300 * 1024;
/** Garde-fou : on ne décode pas une image source énorme (≈ 25 Mo). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export class PhotoError extends Error {
  constructor(readonly reason: "too_big_source" | "decode" | "encode") {
    super(reason);
    this.name = "PhotoError";
  }
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* repli <img> ci-dessous */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError("decode");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressPhoto(file: Blob): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoError("too_big_source");
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new PhotoError("decode");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoError("encode");

    let side = MAX_SIDE_PX;
    let type = "image/webp";
    const qualities = [TARGET_QUALITY, 0.55, 0.4];
    for (let round = 0; round < 4; round++) {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
      for (const q of qualities) {
        let blob = await toBlob(canvas, type, q);
        // Safari ancien : pas d'encodeur webp → il renvoie du png. On passe en jpeg.
        if (blob && blob.type !== type) {
          type = "image/jpeg";
          blob = await toBlob(canvas, type, q);
        }
        if (blob && blob.size <= MAX_PHOTO_BYTES && (blob.type === "image/webp" || blob.type === "image/jpeg")) {
          return blob;
        }
      }
      side = Math.round(side * 0.75);
    }
    throw new PhotoError("encode");
  } finally {
    img.close();
  }
}
