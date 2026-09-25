/**
 * Mini-analyseur markdown pour les fiches réglementaires (contenu CMS).
 * Sous-ensemble volontairement réduit : titres (## et ###), paragraphes,
 * listes à puces (- ou *), listes numérotées (1.), gras (**…**).
 * Tout le reste est du texte brut. Sortie : un arbre de données (pas de HTML) ;
 * le rendu React (Markdown.tsx) échappe donc tout par construction, sans
 * dangerouslySetInnerHTML. Module pur, testé dans markdown.test.ts.
 */

export type Inline = { type: "text"; text: string } | { type: "strong"; text: string };

export type Block =
  | { type: "heading"; level: 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const MAX_INPUT = 50_000;

/** Découpe une ligne en texte et passages en gras. Un « ** » non fermé reste du texte. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ type: "text", text: text.slice(last, start) });
    out.push({ type: "strong", text: m[1] });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  // Fusionne les textes adjacents (sortie stable pour les tests).
  return out.filter((n) => n.text.length > 0);
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const ORDERED = /^\d{1,3}[.)]\s+(.*)$/;

export function parseMarkdown(input: string | null | undefined): Block[] {
  if (!input) return [];
  const lines = input.slice(0, MAX_INPUT).replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", content: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushPara();
      flushList();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flushPara();
      flushList();
      // Le h1 est réservé au titre de la page : # et ## → h2, ### et plus → h3.
      blocks.push({ type: "heading", level: h[1].length <= 2 ? 2 : 3, content: parseInline(h[2].trim()) });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    if (b || o) {
      flushPara();
      const ordered = Boolean(o);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(parseInline(((b ?? o)![1] ?? "").trim()));
      continue;
    }
    if (list) {
      // Ligne de continuation d'un élément de liste.
      const lastItem = list.items[list.items.length - 1];
      lastItem.push({ type: "text", text: " " }, ...parseInline(line));
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/** Sections : chaque titre ouvre une section (la première peut être sans titre). */
export interface Section {
  heading: Block | null;
  blocks: Block[];
}

export function sectionize(blocks: Block[]): Section[] {
  const out: Section[] = [];
  for (const b of blocks) {
    if (b.type === "heading") out.push({ heading: b, blocks: [] });
    else if (out.length === 0) out.push({ heading: null, blocks: [b] });
    else out[out.length - 1].blocks.push(b);
  }
  return out;
}

/** Texte brut (pour le bouton Écouter) : sans marques, une phrase par bloc. */
export function markdownToPlainText(input: string | null | undefined): string {
  return blocksToPlainText(parseMarkdown(input));
}

export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      const flat = (c: Inline[]) => c.map((n) => n.text).join("").trim();
      if (b.type === "list") return b.items.map(flat).map((s) => (/[.!?:]$/.test(s) ? s : `${s}.`)).join(" ");
      const s = flat(b.content);
      return /[.!?:]$/.test(s) ? s : `${s}.`;
    })
    .join("\n");
}
