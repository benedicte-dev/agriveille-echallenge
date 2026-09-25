/**
 * Découpage d'un markdown simple (titres, listes, paragraphes, gras) en
 * segments traduisibles, puis reconstruction. Module pur (aucun import
 * serveur) : partagé par le CMS et par scripts/content/translate-content.ts.
 *
 * Pourquoi : le moteur 229langues ne connaît pas le markdown. Envoyer le corps
 * entier perd les puces et les titres. On ne traduit donc que le texte de
 * chaque ligne, et on remet le préfixe (« ## », « - », « 1. ») à l'identique.
 * Le gras (**…**) est retiré avant traduction : le moteur déplace ou supprime
 * les astérisques, ce qui produirait du markdown cassé.
 */

const LINE_RE = /^(\s*(?:#{1,6}\s+|[-*]\s+|\d{1,3}[.)]\s+)?)(.*)$/;

interface Line {
  prefix: string;
  /** Index du segment à traduire, ou -1 si la ligne est vide. */
  segment: number;
}

export interface Segmented {
  /** Textes à traduire, dans l'ordre. */
  texts: string[];
  lines: Line[];
}

export function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
}

export function segmentMarkdown(md: string): Segmented {
  const texts: string[] = [];
  const lines: Line[] = [];
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const m = LINE_RE.exec(raw);
    const prefix = m?.[1] ?? "";
    const text = stripBold((m?.[2] ?? "").trim());
    if (text.length === 0) {
      lines.push({ prefix: raw.trim().length === 0 ? "" : prefix.trimEnd(), segment: -1 });
      continue;
    }
    lines.push({ prefix, segment: texts.length });
    texts.push(text);
  }
  return { texts, lines };
}

/**
 * Reconstruit le markdown traduit. Renvoie null si un segment manque (le
 * champ reste alors vide et l'affichage retombe sur le français, plutôt que
 * de mélanger deux langues dans une même fiche).
 */
export function rebuildMarkdown(seg: Segmented, translated: readonly (string | null | undefined)[]): string | null {
  if (translated.length !== seg.texts.length) return null;
  const out: string[] = [];
  for (const line of seg.lines) {
    if (line.segment === -1) {
      out.push(line.prefix);
      continue;
    }
    const t = translated[line.segment];
    if (typeof t !== "string" || t.trim().length === 0) return null;
    out.push(line.prefix + t.replace(/\s*\n+\s*/g, " ").trim());
  }
  return out.join("\n");
}
