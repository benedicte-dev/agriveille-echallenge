import "server-only";
/**
 * QR code de quittance, généré côté serveur (SVG → data URL, autorisée par la CSP img-src data:).
 */
import QRCode from "qrcode";
import { headers } from "next/headers";

const HOST_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

/** Origine publique : NEXT_PUBLIC_APP_URL si définie, sinon en-têtes de la requête (host validé). */
export async function appOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    try {
      const u = new URL(env);
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin;
    } catch {
      console.error("[levies] NEXT_PUBLIC_APP_URL invalide, repli sur les en-têtes");
    }
  }
  const h = await headers();
  const rawHost = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const host = HOST_RE.test(rawHost) ? rawHost : "localhost:3000";
  const rawProto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const proto = rawProto === "https" || rawProto === "http" ? rawProto : host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export function verifyPath(code: string): string {
  return `/verifier/${encodeURIComponent(code)}`;
}

/** Data URL SVG du QR (correction d'erreur M : lisible même imprimé sur papier médiocre). */
export async function qrDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
