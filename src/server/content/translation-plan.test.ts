import { describe, expect, it } from "vitest";
import { planField } from "./translation-plan";

const base = { prevFr: "Maïs", nextFr: "Maïs", prev: { fon: "Gbadé", yo: "Àgbàdo" }, submitted: { fon: "Gbadé", yo: "Àgbàdo" } };

describe("planField", () => {
  it("création : traduit les deux langues", () => {
    const p = planField({ prevFr: null, nextFr: "Maïs", prev: { fon: null, yo: null }, submitted: { fon: "", yo: "" } }, true);
    expect(p).toEqual({ fon: { action: "translate" }, yo: { action: "translate" } });
  });
  it("rien n'a changé : garde les valeurs", () => {
    expect(planField(base, true)).toEqual({ fon: { action: "keep", value: "Gbadé" }, yo: { action: "keep", value: "Àgbàdo" } });
  });
  it("correction manuelle d'une personne locutrice : jamais écrasée, même si le français change", () => {
    const p = planField({ ...base, nextFr: "Maïs grain", submitted: { fon: "Gbadé kún", yo: "Àgbàdo" } }, true);
    expect(p.fon).toEqual({ action: "keep", value: "Gbadé kún" });
    expect(p.yo).toEqual({ action: "translate" });
  });
  it("champ vidé à la main : retraduit si l'auto est activée", () => {
    expect(planField({ ...base, submitted: { fon: "  ", yo: "Àgbàdo" } }, true).fon).toEqual({ action: "translate" });
  });
  it("auto désactivée et français modifié : l'ancienne traduction périmée est effacée (repli fr)", () => {
    const p = planField({ ...base, nextFr: "Maïs grain" }, false);
    expect(p).toEqual({ fon: { action: "keep", value: null }, yo: { action: "keep", value: null } });
  });
  it("auto désactivée, rien de changé : conserve", () => {
    expect(planField(base, false).fon).toEqual({ action: "keep", value: "Gbadé" });
  });
});
