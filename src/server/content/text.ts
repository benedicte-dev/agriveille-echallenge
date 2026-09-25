/** Utilitaires de texte purs. */

/** Coupe un texte à `max` caractères sur un mot, avec « … ». */
export function clip(text: string, max: number): string {
  const t = text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

