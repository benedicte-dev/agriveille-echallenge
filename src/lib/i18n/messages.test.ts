import { describe, expect, it } from "vitest";
import fr from "./messages/fr.json";
import fon from "./messages/fon.json";
import yo from "./messages/yo.json";
import { getMessages, t } from "./messages";
import { extractVars } from "./format";
import { LOCALE_NAMES, toLocale } from "./config";
import { audioUrlFor } from "./audio";
import manifest from "../../../public/audio/manifest.json";

const dicts: Record<string, Record<string, string>> = { fon, yo };

describe("dictionnaires", () => {
  const frKeys = Object.keys(fr).sort();

  it("fr.json a environ 200 clés plates non vides", () => {
    expect(frKeys.length).toBeGreaterThanOrEqual(200);
    for (const [k, v] of Object.entries(fr)) {
      expect(k).toMatch(/^[a-z_]+(\.[A-Za-z0-9_]+)+$/);
      expect(typeof v).toBe("string");
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  for (const lang of ["fon", "yo"]) {
    it(`${lang}.json a exactement le même jeu de clés`, () => {
      expect(Object.keys(dicts[lang]).sort()).toEqual(frKeys);
    });

    it(`${lang}.json garde les mêmes variables que le français`, () => {
      const frDict = fr as Record<string, string>;
      for (const k of frKeys) {
        expect(extractVars(dicts[lang][k]), `${lang} ${k}`).toEqual(extractVars(frDict[k]));
      }
    });
  }

  it("noms des langues", () => {
    expect(LOCALE_NAMES).toEqual({ fr: "Français", fon: "Fɔngbe", yo: "Yorùbá" });
  });
});

describe("getMessages / t", () => {
  it("langue inconnue → français", () => {
    expect(toLocale("en")).toBe("fr");
    expect(getMessages("xx" as never)).toBe(getMessages("fr"));
  });

  it("interpole et replie sur le français", () => {
    expect(t(getMessages("fr"), "dashboard.hello", { name: "Afi" })).toBe("Bonjour Afi");
    expect(t({}, "alert.ack")).toBe("J'ai compris");
    expect(t(getMessages("fon"), "inconnue.cle")).toBe("inconnue.cle");
  });
});

describe("audioUrlFor", () => {
  it("renvoie null pour le français et les clés sans audio", () => {
    expect(audioUrlFor("fr", "alert.ack")).toBeNull();
    expect(audioUrlFor("fon", "cle.inexistante")).toBeNull();
    expect(audioUrlFor("fon", "__proto__")).toBeNull();
  });

  it("renvoie les chemins du manifeste", () => {
    const m = manifest as Record<string, Record<string, string>>;
    for (const lang of ["fon", "yo"] as const) {
      for (const [key, url] of Object.entries(m[lang] ?? {})) {
        expect(audioUrlFor(lang, key)).toBe(url);
        expect(url).toMatch(new RegExp(`^/audio/${lang}/[A-Za-z0-9_.]+\\.(wav|mp3)$`));
      }
    }
  });
});
