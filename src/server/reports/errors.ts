/**
 * Erreurs métier du service de signalements. Le code est stable (mappé en
 * statut HTTP par les routes, en message court par les actions) ; le message
 * est générique et sans détail technique (SPEC §8).
 */
export type ReportErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "ALREADY_REVIEWED"
  | "CONFLICT"
  | "PHOTO_TOO_LARGE"
  | "PHOTO_BAD_TYPE"
  | "UNAVAILABLE";

const MESSAGES: Record<ReportErrorCode, string> = {
  UNAUTHENTICATED: "Session expirée. Reconnectez-vous.",
  FORBIDDEN: "Accès refusé.",
  INVALID: "Information pas valide.",
  NOT_FOUND: "Signalement introuvable.",
  RATE_LIMITED: "Trop de signalements. Attendez un peu.",
  ALREADY_REVIEWED: "Ce signalement a déjà été traité.",
  CONFLICT: "Cet envoi a déjà été utilisé.",
  PHOTO_TOO_LARGE: "Photo trop lourde. Reprenez la photo.",
  PHOTO_BAD_TYPE: "Format de photo non accepté.",
  UNAVAILABLE: "Service momentanément indisponible. Réessayez.",
};

export const REPORT_ERROR_STATUS: Record<ReportErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID: 422,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  ALREADY_REVIEWED: 409,
  CONFLICT: 409,
  PHOTO_TOO_LARGE: 413,
  PHOTO_BAD_TYPE: 415,
  UNAVAILABLE: 503,
};

export class ReportError extends Error {
  readonly code: ReportErrorCode;
  /** Erreurs de champ (zod), clé = chemin, valeur = premier message. */
  readonly fields?: Record<string, string>;
  /** Délai conseillé avant nouvel essai (RATE_LIMITED). */
  readonly retryAfterMs?: number;

  constructor(code: ReportErrorCode, opts: { fields?: Record<string, string>; retryAfterMs?: number; message?: string } = {}) {
    super(opts.message ?? MESSAGES[code]);
    this.name = "ReportError";
    this.code = code;
    this.fields = opts.fields;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export function isReportError(err: unknown): err is ReportError {
  return err instanceof ReportError;
}

export function reportErrorMessage(code: ReportErrorCode): string {
  return MESSAGES[code];
}
