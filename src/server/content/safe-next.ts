/**
 * Validation du paramètre ?next= après connexion (anti open-redirect).
 * Accepte uniquement un chemin interne : commence par « / », pas par « // »
 * ni « /\ » (interprété comme // par les navigateurs), sans caractère de
 * contrôle, sans schéma. Module pur, testé dans safe-next.test.ts.
 */
const MAX_LEN = 512;

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v.length === 0 || v.length > MAX_LEN) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//") || v.startsWith("/\\")) return null;
  // Caractères de contrôle (dont \t \n \r que les navigateurs suppriment) et antislash.
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return null;
  // Vérification finale par l'analyseur d'URL : l'origine doit rester la nôtre.
  try {
    const base = "https://agriveille.invalid";
    const url = new URL(v, base);
    if (url.origin !== base) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/** Le chemin demandé est-il compatible avec l'espace du rôle ? (évite une boucle de redirection) */
export function nextAllowedForRole(path: string, role: "FARMER" | "BUYER" | "AGENT" | "ADMIN"): boolean {
  const prefix = (p: string) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`);
  if (prefix("/admin")) return role === "ADMIN";
  if (prefix("/agent")) return role === "AGENT" || role === "ADMIN";
  if (prefix("/acheteur")) return role === "BUYER";
  if (prefix("/app")) return role === "FARMER";
  if (prefix("/connexion") || prefix("/inscription")) return false;
  return true;
}
