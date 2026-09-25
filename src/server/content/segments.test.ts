import { describe, expect, it } from "vitest";
import { rebuildMarkdown, segmentMarkdown, stripBold } from "./segments";

describe("segmentMarkdown / rebuildMarkdown", () => {
  const md = "## L'essentiel\n\n- **N'achetez** que des produits homologués\n1. Ouvrez « Signaler »\n\nTexte final.";

  it("ne garde que le texte à traduire, sans préfixe ni gras", () => {
    expect(segmentMarkdown(md).texts).toEqual([
      "L'essentiel",
      "N'achetez que des produits homologués",
      "Ouvrez « Signaler »",
      "Texte final.",
    ]);
  });

  it("remet les préfixes et les lignes vides à l'identique", () => {
    const seg = segmentMarkdown(md);
    const out = rebuildMarkdown(seg, ["A", "B", "C", "D"]);
    expect(out).toBe("## A\n\n- B\n1. C\n\nD");
  });

  it("renvoie null si un segment manque (pas de fiche à moitié traduite)", () => {
    const seg = segmentMarkdown(md);
    expect(rebuildMarkdown(seg, ["A", null, "C", "D"])).toBeNull();
    expect(rebuildMarkdown(seg, ["A"])).toBeNull();
  });

  it("aplatit une traduction multi-ligne sur sa ligne", () => {
    const seg = segmentMarkdown("- un");
    expect(rebuildMarkdown(seg, ["deux\nlignes"])).toBe("- deux lignes");
  });

  it("stripBold", () => {
    expect(stripBold("**a** et __b__")).toBe("a et b");
  });
});
