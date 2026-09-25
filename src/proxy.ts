import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Contrôle optimiste (Next 16 : proxy.ts remplace middleware.ts) : sans cookie
 * de session, les espaces protégés renvoient vers /connexion. La vérification
 * qui fait foi (session en base, rôle, propriété) reste dans requireUser /
 * requireRole côté serveur.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/acheteur/:path*", "/agent/:path*", "/admin/:path*"],
};
