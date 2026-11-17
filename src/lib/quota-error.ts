// Quota / rate-limit error classification for AI request paths.
//
// The server denies over-quota requests with Connect Code.ResourceExhausted and
// sets the `X-Loci-Quota-Reason` metadata header:
//   - "free_daily_limit": free-tier user exhausted the 10 requests/day quota
//     (show an upgrade CTA pointing at /pricing)
//   - "fair_use": Pro user hit the hidden fair-use cap (NEVER show an upgrade
//     CTA - just explain that access resets at midnight UTC)
// Anything else that looks like a 429/resource-exhausted is an ordinary,
// transient rate limit and keeps the existing retry messaging.
import { Code, ConnectError } from "@connectrpc/connect";
import { parseStreamError } from "./errors";

export type QuotaErrorKind = "free_quota" | "fair_use" | "rate_limit" | null;

export interface QuotaErrorInfo {
  kind: QuotaErrorKind;
  userMessage: string;
  retryAfter?: number;
}

export const QUOTA_REASON_HEADER = "x-loci-quota-reason";

export const FREE_QUOTA_MESSAGE =
  "You've used your 10 free requests today. Upgrade to Pro for unlimited requests, or come back tomorrow.";
export const FAIR_USE_MESSAGE =
  "We've detected unusually high activity on your account, so requests are paused for now. Your access resets at midnight UTC.";

/** Error thrown by HTTP (SSE) chat paths when the server denies a request over quota. */
export class QuotaExceededError extends Error {
  constructor(public readonly info: QuotaErrorInfo) {
    super(info.userMessage);
    this.name = "QuotaExceededError";
  }
}

function kindFromReason(reason: string | null | undefined): QuotaErrorKind {
  if (!reason) return null;
  const normalized = reason.trim().toLowerCase();
  if (normalized === "free_daily_limit") return "free_quota";
  if (normalized === "fair_use") return "fair_use";
  return null;
}

function infoForKind(kind: QuotaErrorKind, retryAfter?: number): QuotaErrorInfo {
  switch (kind) {
    case "free_quota":
      return { kind, userMessage: FREE_QUOTA_MESSAGE };
    case "fair_use":
      return { kind, userMessage: FAIR_USE_MESSAGE };
    case "rate_limit":
      return {
        kind,
        userMessage: `AI service is busy. Please try again in ${retryAfter ?? 60} seconds.`,
        retryAfter,
      };
    default:
      return { kind: null, userMessage: "" };
  }
}

/**
 * Classify an error from any AI request path (ConnectError, Error, or the raw
 * error string emitted by stream events) into a quota error kind.
 *
 * ConnectError exposes response headers AND trailers merged on `error.metadata`
 * (a `Headers` object, so lookups are case-insensitive) - that is where the
 * `X-Loci-Quota-Reason` header surfaces for both unary and streaming RPCs.
 */
export function classifyQuotaError(error: unknown): QuotaErrorInfo {
  if (error instanceof QuotaExceededError) {
    return error.info;
  }

  if (error instanceof ConnectError) {
    const reasonKind = kindFromReason(error.metadata.get(QUOTA_REASON_HEADER));
    if (reasonKind) return infoForKind(reasonKind);
    if (error.code === Code.ResourceExhausted) {
      const parsed = parseStreamError(error.message);
      return infoForKind("rate_limit", parsed.retryAfter);
    }
    return infoForKind(null);
  }

  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (!message) return infoForKind(null);

  // Fall back to message sniffing for stream error events, which carry only a
  // plain error string (no metadata).
  const lower = message.toLowerCase();
  if (lower.includes("free_daily_limit")) return infoForKind("free_quota");
  if (lower.includes("fair_use") || lower.includes("fair use")) return infoForKind("fair_use");

  const parsed = parseStreamError(message);
  if (parsed.type === "rate_limit") return infoForKind("rate_limit", parsed.retryAfter);

  return infoForKind(null);
}

/**
 * Classify a fetch `Response` from the HTTP/SSE chat endpoints. Connect maps
 * ResourceExhausted to HTTP 429 and the quota reason rides on the response
 * headers.
 */
export function classifyQuotaHttpResponse(response: Response): QuotaErrorInfo {
  const reasonKind = kindFromReason(response.headers.get(QUOTA_REASON_HEADER));
  if (reasonKind) return infoForKind(reasonKind);
  if (response.status === 429) return infoForKind("rate_limit");
  return infoForKind(null);
}

/** Throw a `QuotaExceededError` if the response is a quota denial (free tier or fair use). */
export function throwIfQuotaDenied(response: Response): void {
  const info = classifyQuotaHttpResponse(response);
  if (info.kind === "free_quota" || info.kind === "fair_use") {
    throw new QuotaExceededError(info);
  }
}
