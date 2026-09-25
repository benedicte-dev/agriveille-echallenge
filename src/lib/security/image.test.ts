import { describe, expect, it } from "vitest";
import { detectImageMime, readImageFile, validateImageBytes, MAX_UPLOAD_BYTES } from "./image";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const gif = new TextEncoder().encode("GIF89a......");
const html = new TextEncoder().encode("<html><script>alert(1)</script>");
const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]); // RIFF mais WAVE

describe("detectImageMime", () => {
  it("reconnaît jpeg, png, webp", () => {
    expect(detectImageMime(jpeg)).toBe("image/jpeg");
    expect(detectImageMime(png)).toBe("image/png");
    expect(detectImageMime(webp)).toBe("image/webp");
  });
  it("refuse gif, html, wav, octets tronqués", () => {
    expect(detectImageMime(gif)).toBeNull();
    expect(detectImageMime(html)).toBeNull();
    expect(detectImageMime(wav)).toBeNull();
    expect(detectImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("validateImageBytes", () => {
  it("contrôle vide, taille et type autorisé", () => {
    expect(validateImageBytes(new Uint8Array())).toEqual({ ok: false, error: "EMPTY" });
    expect(validateImageBytes(jpeg, { maxBytes: 4 })).toEqual({ ok: false, error: "TOO_LARGE" });
    expect(validateImageBytes(png, { allowed: ["image/jpeg", "image/webp"] })).toEqual({ ok: false, error: "BAD_TYPE" });
    expect(validateImageBytes(webp)).toMatchObject({ ok: true, mime: "image/webp" });
  });
});

describe("readImageFile", () => {
  it("refuse avant lecture un fichier trop gros et ignore le type déclaré", async () => {
    const big = new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)], { type: "image/jpeg" });
    expect(await readImageFile(big)).toEqual({ ok: false, error: "TOO_LARGE" });
    const lying = new Blob([html], { type: "image/png" });
    expect(await readImageFile(lying)).toEqual({ ok: false, error: "BAD_TYPE" });
    expect(await readImageFile("pas un fichier")).toEqual({ ok: false, error: "MISSING" });
    const ok = await readImageFile(new Blob([jpeg]));
    expect(ok).toMatchObject({ ok: true, mime: "image/jpeg" });
  });
});
