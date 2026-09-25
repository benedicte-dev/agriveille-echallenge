/**
 * Fonctions pures de traduction : interpolation, repli, protection des
 * variables avant une traduction automatique. Sans dépendance, sans I/O.
 */

export type Messages = Readonly<Record<string, string>>;
export type Vars = Readonly<Record<string, string | number>>;

/** Motif d'une variable : `{name}`, `{count}`, `{amount_fcfa}`. */
const VAR_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * Remplace `{name}` par `vars.name`. Une variable absente de `vars` est laissée
 * telle quelle (visible, donc repérable) plutôt que remplacée par "undefined".
 */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(VAR_RE, (whole, name: string) => {
    const v = Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : undefined;
    return v === undefined || v === null ? whole : String(v);
  });
}

/**
 * Cherche `key` dans `messages`, puis dans `fallback` (le français), puis
 * renvoie la clé elle-même : l'écran n'est jamais vide et le trou se voit.
 */
export function translateKey(
  messages: Messages,
  key: string,
  vars?: Vars,
  fallback?: Messages,
): string {
  const own = messages[key];
  if (typeof own === "string" && own.length > 0) return interpolate(own, vars);
  const fb = fallback?.[key];
  if (typeof fb === "string" && fb.length > 0) return interpolate(fb, vars);
  return key;
}

/** Liste triée et dédoublonnée des noms de variables d'un gabarit. */
export function extractVars(template: string): string[] {
  const names = new Set<string>();
  for (const m of template.matchAll(VAR_RE)) names.add(m[1]);
  return [...names].sort();
}

/**
 * Protège les variables avant une traduction automatique. Le moteur traduit
 * `{name}` (constaté : « {nyikɔ} »), mais recopie des jetons `__V0__`.
 */
export function protectVars(template: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  const text = template.replace(VAR_RE, (whole) => {
    let idx = tokens.indexOf(whole);
    if (idx === -1) {
      tokens.push(whole);
      idx = tokens.length - 1;
    }
    return `__V${idx}__`;
  });
  return { text, tokens };
}

/**
 * Restaure les variables protégées. Tolère les espaces et la casse que le
 * moteur peut introduire (« __ v0 __ »). Renvoie `ok:false` si un jeton manque,
 * est dupliqué ou si un jeton inconnu apparaît : l'appelant bascule alors en
 * repli français pour cette clé.
 */
export function restoreVars(
  translated: string,
  tokens: readonly string[],
): { ok: true; text: string } | { ok: false; reason: string } {
  const counts = new Map<number, number>();
  const TOKEN_RE = /_{2}\s*[vV]\s*(\d+)\s*_{2}/g;
  const text = translated.replace(TOKEN_RE, (_whole, digits: string) => {
    const idx = Number(digits);
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
    return tokens[idx] ?? `__INVALID_${idx}__`;
  });
  for (const idx of counts.keys()) {
    if (idx >= tokens.length) return { ok: false, reason: `jeton inconnu __V${idx}__` };
  }
  for (let i = 0; i < tokens.length; i++) {
    if (!counts.has(i)) return { ok: false, reason: `variable perdue ${tokens[i]}` };
  }
  // Un reste de jeton mal formé (« __V », « V0__ ») signale une corruption.
  if (/__\s*[vV]\d*|[vV]\d+\s*__/.test(text)) {
    return { ok: false, reason: "jeton de variable corrompu" };
  }
  return { ok: true, text };
}

/** Vrai si `translated` contient exactement les mêmes variables que `source`. */
export function sameVars(source: string, translated: string): boolean {
  const a = extractVars(source);
  const b = extractVars(translated);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
