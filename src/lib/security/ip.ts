/**
 * Adresse IP du client depuis les en-têtes. Sur Vercel, `x-forwarded-for` est
 * réécrit par la plateforme (première valeur = client). En local, repli sur
 * `x-real-ip` puis « unknown ». Ne jamais s'en servir comme preuve d'identité :
 * uniquement pour la limitation de débit et le journal d'audit.
 */

type HeaderReader = Pick<Headers, "get">;

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:.]{2,45}$/;

function clean(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  let v = candidate.trim();
  // « [::1]:1234 » ou « 1.2.3.4:5678 »
  if (v.startsWith("[")) v = v.slice(1, v.indexOf("]") > 0 ? v.indexOf("]") : undefined);
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(v)) v = v.split(":")[0];
  if (IPV4.test(v) || (v.includes(":") && IPV6.test(v))) return v;
  return null;
}

export function getClientIpFromHeaders(headers: HeaderReader): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = clean(xff.split(",")[0]);
    if (first) return first;
  }
  return clean(headers.get("x-real-ip")) ?? clean(headers.get("cf-connecting-ip")) ?? "unknown";
}

/** Dans une Server Action / un Server Component / un route handler. */
export async function getRequestIp(): Promise<string> {
  const { headers } = await import("next/headers");
  try {
    return getClientIpFromHeaders(await headers());
  } catch {
    return "unknown";
  }
}

export async function getRequestUserAgent(): Promise<string | null> {
  const { headers } = await import("next/headers");
  try {
    const ua = (await headers()).get("user-agent");
    return ua ? ua.slice(0, 255) : null;
  } catch {
    return null;
  }
}
