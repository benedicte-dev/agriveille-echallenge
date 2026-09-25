import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Locale, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/security/audit";
import { getRequestIp, getRequestUserAgent } from "@/lib/security/ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { RATE_LIMITS } from "@/lib/security/rate-limit-core";
import {
  GENERIC_LOGIN_ERROR,
  LOGIN_PATH,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  homePathForRole,
} from "./constants";
import { afterFailure, isLocked } from "./lockout";
import { verifyPin, verifyPinAgainstDummy } from "./pin";
import { generateSessionToken, hashSessionToken, isWellFormedToken } from "./token";

/** Utilisateur exposé aux pages et actions : jamais de pinHash. */
export interface CurrentUser {
  id: string;
  phone: string;
  fullName: string;
  role: Role;
  locale: Locale;
  communeId: string | null;
  organization: string | null;
}

const USER_SELECT = {
  id: true,
  phone: true,
  fullName: true,
  role: true,
  locale: true,
  communeId: true,
  organization: true,
  isActive: true,
} as const;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

// ── Sessions ──────────────────────────────────────────────────────────────

/**
 * Crée une session et pose le cookie. À appeler uniquement depuis une Server
 * Action ou un route handler. Rotation : la session portée par le cookie
 * courant (s'il y en a une) est supprimée avant d'émettre le nouveau jeton.
 */
export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  if (isWellFormedToken(previous)) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(previous) } });
  }
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      userAgent: await getRequestUserAgent(),
    },
  });
  // Ménage opportuniste des sessions expirées de cet utilisateur.
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Supprime la session courante (base + cookie). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (isWellFormedToken(token)) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Révoque toutes les sessions d'un utilisateur (désactivation, changement de PIN). */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

/**
 * Utilisateur connecté ou null. Mémoïsé par requête (React cache).
 * Utilisable dans les Server Components, Server Actions et route handlers.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!isWellFormedToken(token)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { expiresAt: true, user: { select: USER_SELECT } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) return null;
  const { isActive: _active, ...user } = session.user;
  void _active;
  return user;
});

/** Exige une session ; sinon redirection vers /connexion. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/**
 * Exige l'un des rôles donnés. ADMIN satisfait toujours une exigence AGENT
 * (SPEC §2 : ADMIN peut tout ce qu'AGENT peut). Un rôle non autorisé est
 * renvoyé vers son propre espace (aucune information divulguée).
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (hasRole(user.role, roles)) return user;
  redirect(homePathForRole(user.role));
}

export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  if (allowed.includes(role)) return true;
  return role === "ADMIN" && allowed.includes("AGENT");
}

/**
 * Contrôle de propriété (anti-IDOR). Si l'objet n'appartient pas à
 * l'utilisateur, réponse 404 (on ne confirme pas son existence).
 * `allowStaff` : AGENT et ADMIN passent (consultation / modération).
 */
export function assertOwner(
  user: Pick<CurrentUser, "id" | "role">,
  ownerId: string | null | undefined,
  opts: { allowStaff?: boolean } = {},
): void {
  if (ownerId && ownerId === user.id) return;
  if (opts.allowStaff && (user.role === "AGENT" || user.role === "ADMIN")) return;
  notFound();
}
/** Alias (SPEC §7 mentionne `requireOwner`). */
export const requireOwner = assertOwner;

// ── Connexion ─────────────────────────────────────────────────────────────

export type LoginResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; error: string };

/**
 * Vérifie téléphone (déjà normalisé) + PIN, applique la limitation par IP et le
 * verrouillage par compte, crée la session. Un seul message d'erreur générique.
 */
export async function login(phone: string, pin: string): Promise<LoginResult> {
  const ip = await getRequestIp();
  const limit = await rateLimit(`loginIp:${ip}`, RATE_LIMITS.loginIp);
  if (!limit.allowed) {
    return { ok: false, error: "Trop de tentatives depuis cet appareil. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { ...USER_SELECT, pinHash: true, failedLogins: true, lockedUntil: true },
  });
  const now = new Date();

  if (!user || !user.isActive) {
    await verifyPinAgainstDummy(pin);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  if (isLocked(user.lockedUntil, now)) {
    await verifyPinAgainstDummy(pin);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const valid = await verifyPin(user.pinHash, pin);
  if (!valid) {
    // Incrément atomique, puis verrouillage éventuel.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: { increment: 1 } },
      select: { failedLogins: true },
    });
    const next = afterFailure(updated.failedLogins, now);
    if (next.locked) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: next.failedLogins, lockedUntil: next.lockedUntil },
      });
      await audit(user.id, "auth.lockout", "User", user.id, { until: next.lockedUntil }, ip);
    }
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
  });
  await createSession(user.id);
  if (user.role === "AGENT" || user.role === "ADMIN") {
    await audit(user.id, "auth.login", "User", user.id, {}, ip);
  }
  const { pinHash: _h, failedLogins: _f, lockedUntil: _l, isActive: _a, ...current } = user;
  void _h; void _f; void _l; void _a;
  return { ok: true, user: current };
}

export async function logout(): Promise<void> {
  await destroySession();
}
