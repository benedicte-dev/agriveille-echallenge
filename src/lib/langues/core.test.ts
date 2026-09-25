import { describe, expect, it, vi } from "vitest";
import {
  LanguesError,
  cacheKey,
  createLanguesClient,
  sniffAudio,
  type LanguesConfig,
  type TranslationCacheStore,
} from "./core";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

function setup(responses: (Response | Error)[], extra: Partial<LanguesConfig> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("appel inattendu");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleeps: number[] = [];
  const client = createLanguesClient({
    baseUrl: "https://api.test/",
    apiKey: "KEY",
    hfToken: "HF",
    retries: 2,
    backoffMs: 10,
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async (ms) => void sleeps.push(ms),
    log: () => {},
    ...extra,
  });
  return { client, calls, fetchMock, sleeps };
}

function memoryCache(): TranslationCacheStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(k) {
      return data.get(k) ?? null;
    },
    async set({ key, text }) {
      data.set(key, text);
    },
  };
}

const WAV = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(8)]);
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(20)]);

describe("configuration", () => {
  it("refuse une configuration incomplète", () => {
    expect(() => createLanguesClient({ baseUrl: "", apiKey: "k", hfToken: "h" })).toThrow(LanguesError);
  });
});

describe("translate", () => {
  it("envoie les bons en-têtes et corps, parse data.text", async () => {
    const { client, calls } = setup([json({ success: true, data: { text: " N mɔ nu " } })]);
    await expect(client.translate("J'ai compris", "fon")).resolves.toBe("N mɔ nu");
    expect(calls[0].url).toBe("https://api.test/api/v1/translate");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer HF");
    expect(headers["X-API-Key"]).toBe("KEY");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      text: "J'ai compris",
      from_lang: "fr",
      to_lang: "fon",
    });
  });

  it("valide l'entrée avant tout appel", async () => {
    const { client, fetchMock } = setup([]);
    await expect(client.translate("   ", "fon")).rejects.toMatchObject({ code: "INPUT" });
    await expect(client.translate("x", "en" as never)).rejects.toMatchObject({ code: "INPUT" });
    await expect(client.translate("x".repeat(5001), "yo")).rejects.toMatchObject({ code: "INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejette une réponse au mauvais format", async () => {
    const { client } = setup([json({ success: true, data: { translated: "x" } })]);
    await expect(client.translate("Oui", "yo")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("rejette une réponse non JSON", async () => {
    const { client } = setup([new Response("<html>", { status: 200 })]);
    await expect(client.translate("Oui", "yo")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("réessaie sur 503 puis réussit, avec backoff", async () => {
    const { client, fetchMock, sleeps } = setup([
      json({ error: "réveil" }, 503),
      json({ success: true, data: { text: "Bẹ́ẹ̀ni" } }),
    ]);
    await expect(client.translate("Oui", "yo")).resolves.toBe("Bẹ́ẹ̀ni");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toHaveLength(1);
  });

  it("ne réessaie pas sur 401", async () => {
    const { client, fetchMock } = setup([json({ error: "bad token" }, 401)]);
    await expect(client.translate("Oui", "yo")).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("429 : respecte Retry-After (plafonné)", async () => {
    const { client, sleeps } = setup(
      [json({}, 429, { "retry-after": "2" }), json({ success: true, data: { text: "ok" } })],
      { maxRetryAfterMs: 1500 },
    );
    await client.translate("Oui", "fon");
    expect(sleeps).toEqual([1500]);
  });

  it("classe les délais dépassés en TIMEOUT et abandonne après les tentatives", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    const { client, fetchMock } = setup([timeout, timeout, timeout]);
    await expect(client.translate("Oui", "fon")).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("utilise le cache injecté", async () => {
    const cache = memoryCache();
    const { client, fetchMock } = setup([json({ success: true, data: { text: "ɖŏ tó" } })], {
      cache: { translations: cache },
    });
    expect(await client.translate("Écouter", "fon")).toBe("ɖŏ tó");
    expect(await client.translate("Écouter", "fon")).toBe("ɖŏ tó");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.data.get(cacheKey("fon", "Écouter"))).toBe("ɖŏ tó");
  });

  it("une panne du cache ne casse pas la traduction", async () => {
    const broken: TranslationCacheStore = {
      get: async () => {
        throw new Error("db down");
      },
      set: async () => {
        throw new Error("db down");
      },
    };
    const { client } = setup([json({ success: true, data: { text: "ok" } })], {
      cache: { translations: broken },
    });
    await expect(client.translate("Oui", "fon")).resolves.toBe("ok");
  });
});

describe("translateWithFallback", () => {
  it("repli français marqué en cas d'échec", async () => {
    const { client } = setup([json({}, 500), json({}, 500), json({}, 500)]);
    await expect(client.translateWithFallback("Danger", "fon")).resolves.toEqual({
      text: "Danger",
      lang: "fr",
      fallback: true,
    });
  });

  it("traduction normale sinon", async () => {
    const { client } = setup([json({ success: true, data: { text: "Ewu" } })]);
    await expect(client.translateWithFallback("Danger", "yo")).resolves.toEqual({
      text: "Ewu",
      lang: "yo",
      fallback: false,
    });
  });
});

describe("translateBatch", () => {
  it("aligne les résultats, null pour les échecs, ne renvoie que les manquants", async () => {
    const cache = memoryCache();
    cache.data.set(cacheKey("fon", "Oui"), "Ɛɛn");
    const { client, calls } = setup(
      [
        json({
          success: true,
          data: [
            { index: 0, success: true, original_text: "Non", translated_text: "Eo" },
            { index: 1, success: false, translated_text: null },
            { index: 9, success: true, translated_text: "hors lot" },
          ],
        }),
      ],
      { cache: { translations: cache } },
    );
    const out = await client.translateBatch(["Oui", "Non", "Peut-être"], "fon");
    expect(out).toEqual(["Ɛɛn", "Eo", null]);
    expect(calls[0].url).toBe("https://api.test/api/v1/translate/batch");
    expect(JSON.parse(String(calls[0].init.body)).texts).toEqual(["Non", "Peut-être"]);
  });
});

describe("tts", () => {
  it("fon : wav détecté par signature, langue mappée", async () => {
    const { client, calls } = setup([new Response(WAV, { headers: { "content-type": "audio/wav" } })]);
    const r = await client.tts("ɖŏ tó", "fon");
    expect(r.mime).toBe("audio/wav");
    expect(Buffer.isBuffer(r.data)).toBe(true);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ text: "ɖŏ tó", language: "fon" });
  });

  it("yo : mp3, langue « yoruba » côté API", async () => {
    const { client, calls } = setup([new Response(MP3, { headers: { "content-type": "audio/mpeg" } })]);
    const r = await client.tts("Gbọ́", "yo");
    expect(r.mime).toBe("audio/mpeg");
    expect(JSON.parse(String(calls[0].init.body)).language).toBe("yoruba");
  });

  it("refuse une réponse qui n'est pas de l'audio", async () => {
    const { client } = setup([json({ success: true })]);
    await expect(client.tts("x", "fon")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("refuse un texte trop long", async () => {
    const { client } = setup([]);
    await expect(client.tts("a".repeat(1001), "fon")).rejects.toMatchObject({ code: "INPUT" });
  });
});

describe("stt", () => {
  it("multipart audio + language, parse data.transcription", async () => {
    const { client, calls } = setup([
      json({ success: true, data: { transcription: " wo do no ", language: "fon", duration: 2.8 } }),
    ]);
    const r = await client.stt(WAV, "audio/wav", "fon");
    expect(r).toEqual({ text: "wo do no" });
    const form = calls[0].init.body as FormData;
    expect(form.get("language")).toBe("fon");
    const file = form.get("audio") as File;
    expect(file.name).toBe("enregistrement.wav");
    expect(file.size).toBe(WAV.length);
  });

  it("valide type et taille", async () => {
    const { client, fetchMock } = setup([]);
    await expect(client.stt(WAV, "text/plain", "fon")).rejects.toMatchObject({ code: "INPUT" });
    await expect(client.stt(Buffer.alloc(0), "audio/wav", "yo")).rejects.toMatchObject({ code: "INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sniffAudio", () => {
  it("reconnaît RIFF/WAVE, ID3 et trame MPEG", () => {
    expect(sniffAudio(WAV)).toBe("audio/wav");
    expect(sniffAudio(MP3)).toBe("audio/mpeg");
    expect(sniffAudio(Buffer.from([0xff, 0xfb, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("audio/mpeg");
    expect(sniffAudio(Buffer.from("{\"success\":true}"))).toBeNull();
  });
});
