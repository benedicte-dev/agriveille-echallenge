/** Concatène des classes en ignorant les valeurs falsy. Pas de dépendance externe. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
