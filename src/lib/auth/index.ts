import "server-only";
export {
  getCurrentUser,
  requireUser,
  requireRole,
  hasRole,
  assertOwner,
  requireOwner,
  createSession,
  destroySession,
  revokeAllSessions,
  login,
  logout,
} from "./session";
export type { CurrentUser, LoginResult } from "./session";
export { hashPin, verifyPin } from "./pin";
export { generateSessionToken, hashSessionToken } from "./token";
export {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  MAX_FAILED_LOGINS,
  LOCKOUT_MS,
  PROTECTED_PREFIXES,
  LOGIN_PATH,
  GENERIC_LOGIN_ERROR,
  homePathForRole,
} from "./constants";
export type { AppRole } from "./constants";
export { normalizeBeninPhone, isValidBeninPhone, formatBeninPhone, maskBeninPhone, BENIN_PHONE_REGEX } from "./phone";
