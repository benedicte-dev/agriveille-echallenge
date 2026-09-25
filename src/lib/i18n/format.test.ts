import { describe, expect, it } from "vitest";
import {
  cleanTranslation,
  extractVars,
  interpolate,
  protectVars,
  restoreVars,
  sameVars,
  translateKey,
} from "./format";

describe("interpolate", () => {
  it("remplace les variables présentes", () => {
    expect(interpolate("Bonjour {name}, {count} alertes", { name: "Afi", count: 3 })).toBe(
      "Bonjour Afi, 3 alertes",
    );
  });

  it("laisse visible une variable absente", () => {
    expect(interpolate("Bonjour {name}", {})).toBe("Bonjour {name}");
  });

  it("accepte zéro et ignore les clés héritées du prototype", () => {
    expect(interpolate("{count} kg", { count: 0 })).toBe("0 kg");
    expect(interpolate("{toString}", {})).toBe("{toString}");
  });

  it("sans vars renvoie le gabarit", () => {
    expect(interpolate("Prix {amount}")).toBe("Prix {amount}");
  });
});

describe("translateKey (repli)", () => {
  const fr = { "a.b": "Bonjour {name}", "only.fr": "Seulement fr" };
  const fon = { "a.b": "A fɔn {name}", "only.fr": "" };

  it("utilise la langue demandée", () => {
    expect(translateKey(fon, "a.b", { name: "Koffi" }, fr)).toBe("A fɔn Koffi");
  });

  it("replie sur le français si la clé est vide ou absente", () => {
    expect(translateKey(fon, "only.fr", undefined, fr)).toBe("Seulement fr");
    expect(translateKey({}, "a.b", { name: "X" }, fr)).toBe("Bonjour X");
  });

  it("renvoie la clé si elle est inconnue partout", () => {
    expect(translateKey(fon, "nope.key", undefined, fr)).toBe("nope.key");
  });
});

describe("protection des variables", () => {
  it("remplace les variables par des jetons et dédoublonne", () => {
    const p = protectVars("{a} et {b} puis {a}");
    expect(p.text).toBe("__V0__ et __V1__ puis __V0__");
    expect(p.tokens).toEqual(["{a}", "{b}"]);
  });

  it("restaure, même avec espaces ou casse changés par le moteur", () => {
    const { tokens } = protectVars("Bonjour {name}, {count}");
    const r = restoreVars("A fɔn __ v0 __ , __V1__", tokens);
    expect(r).toEqual({ ok: true, text: "A fɔn {name} , {count}" });
  });

  it("détecte une variable perdue", () => {
    const { tokens } = protectVars("Bonjour {name}");
    const r = restoreVars("A fɔn", tokens);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("{name}");
  });

  it("détecte un jeton inconnu", () => {
    const { tokens } = protectVars("Bonjour {name}");
    expect(restoreVars("__V0__ __V3__", tokens).ok).toBe(false);
  });

  it("détecte un jeton corrompu", () => {
    const { tokens } = protectVars("Bonjour {name}");
    expect(restoreVars("__V0__ reste V1__", tokens).ok).toBe(false);
  });

  it("texte sans variable : aller-retour neutre", () => {
    const p = protectVars("J'ai compris");
    expect(p.tokens).toEqual([]);
    expect(restoreVars("N mɔ nu", p.tokens)).toEqual({ ok: true, text: "N mɔ nu" });
  });

  it("extractVars / sameVars", () => {
    expect(extractVars("{b} {a} {b}")).toEqual(["a", "b"]);
    expect(sameVars("{a} {b}", "{b} x {a}")).toBe(true);
    expect(sameVars("{a}", "{nyikɔ}")).toBe(false);
  });
});

describe("cleanTranslation", () => {
  it("retire les invisibles, les doubles espaces et l'espace avant la ponctuation", () => {
    expect(cleanTranslation("Jǐ \u200B\u200Bɖaxó  ɖé ja")).toBe("Jǐ ɖaxó ɖé ja");
    expect(cleanTranslation(" Gle ce lɛ . ")).toBe("Gle ce lɛ.");
    expect(cleanTranslation("A ɖo __V0__ akpáxwé lɛ .")).toBe("A ɖo __V0__ akpáxwé lɛ.");
  });

  it("ne modifie pas les lettres accentuées", () => {
    expect(cleanTranslation("Tẹ awọn nọmba mẹrin rẹ sii")).toBe("Tẹ awọn nọmba mẹrin rẹ sii");
  });
});
