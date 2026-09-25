import "server-only";

export {
  createReport,
  reviewReport,
  listReports,
  getReport,
  getReportPhoto,
  countPendingReports,
  listPestOptions,
  getReportFormContext,
} from "./service";
export type {
  ReportActor,
  ServiceOptions,
  CreateReportResult,
  ReviewResult,
  ReportListItem,
  ReportPage,
  ReportDetail,
  PestLabel,
  PestOption,
  ReportFormContext,
} from "./service";
export { ReportError, isReportError, reportErrorMessage, REPORT_ERROR_STATUS } from "./errors";
export type { ReportErrorCode } from "./errors";
export {
  createReportSchema,
  reviewReportSchema,
  listReportsSchema,
  clientIdSchema,
  DEFAULT_OUTBREAK_RADIUS_KM,
  REPORT_TEXT_MAX,
  REVIEW_NOTE_MAX,
} from "./schemas";
export type { CreateReportInput, ReviewReportInput, ListReportsInput } from "./schemas";
export {
  OUTBREAK_CRITICAL_COUNT,
  OUTBREAK_CLUSTER_RADIUS_KM,
  OUTBREAK_WINDOW_DAYS,
  outbreakDedupKey,
  outbreakSeverity,
} from "./outbreak";
