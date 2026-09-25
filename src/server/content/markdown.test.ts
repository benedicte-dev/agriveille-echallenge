import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { markdownToPlainText, parseInline, parseMarkdown } from "./markdown";
import { Markdown } from "./Markdown";

describe("parseInline", () => {
  it("découpe le gras", () => {
    expect(parseInline("a **b** c")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", text: "b" },
      { type: "text", text: " c" },
    ]);
  });
  it("laisse un ** non fermé en texte", () => {
    expect(parseInline("prix **bas")).toEqual([{ type: "text", text: "prix **bas" }]);
  });
});

describe("parseMarkdown", () => {
  it("reconnaît titres, listes et paragraphes", () => {
    const blocks = parseMarkdown("## L'essentiel\n\n- **Un**\n- Deux\n\n1. A\n2. B\n\nTexte\nsuite");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "list", "list", "paragraph"]);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
    expect(blocks[1]).toMatchObject({ ordered: false });
    expect(blocks[2]).toMatchObject({ ordered: true });
    expect(blocks[3]).toEqual({ type: "paragraph", content: [{ type: "text", text: "Texte suite" }] });
  });
  it("ne produit jamais de h1 (réservé au titre de page)", () => {
    const [b] = parseMarkdown("# Titre");
    expect(b).toMatchObject({ type: "heading", level: 2 });
  });
  it("sépare une liste à puces d'une liste numérotée qui la suit", () => {
    const blocks = parseMarkdown("- a\n1. b");
    expect(blocks).toHaveLength(2);
  });
  it("gère l'entrée vide", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
  });
});

describe("Markdown (rendu React)", () => {
  const html = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }));

  it("échappe le HTML brut : aucune balise injectée", () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
  it("échappe aussi à l'intérieur du gras et des listes", () => {
    const out = html('- **<b onclick="x">gras</b>**\n## <i>titre</i>');
    expect(out).toContain("<strong>&lt;b onclick=&quot;x&quot;&gt;gras&lt;/b&gt;</strong>");
    expect(out).toContain("<h2");
    expect(out).toContain("&lt;i&gt;titre&lt;/i&gt;");
    expect(out).not.toMatch(/<b |<i>/);
  });
  it("ne crée pas de lien à partir d'un lien markdown ou javascript:", () => {
    const out = html("[clic](javascript:alert(1))");
    expect(out).not.toContain("<a");
    expect(out).toContain("[clic](javascript:alert(1))");
  });
  it("rend listes et paragraphes", () => {
    const out = html("Intro\n\n- un\n- deux\n\n1. premier");
    expect(out).toMatch(/<p>Intro<\/p>/);
    expect(out).toMatch(/<ul[^>]*><li[^>]*>un<\/li><li[^>]*>deux<\/li><\/ul>/);
    expect(out).toMatch(/<ol[^>]*><li[^>]*>premier<\/li><\/ol>/);
  });
});

describe("markdownToPlainText", () => {
  it("retire les marques et ponctue chaque bloc", () => {
    expect(markdownToPlainText("## Titre\n\n- **Un** point\n- deux")).toBe("Titre.\nUn point. deux.");
  });
});
