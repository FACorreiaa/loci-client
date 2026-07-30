/**
 * Error handling utilities for RPC streaming
 */

export interface ParsedError {
  type: "quota_exhausted" | "rate_limit" | "network" | "validation" | "server" | "unknown";
  userMessage: string;
  technicalMessage: string;
  retryAfter?: number;
  canRetry: boolean;
  errorCode?: string;
}

/**
 * Parse error messages from stream events or RPC errors
 */
export const parseStreamError = (error: string): ParsedError => {
  const errorLower = error.toLowerCase();

  // Your own daily plan quota, which is NOT the same thing as the upstream AI
  // provider being busy: retrying in 60s cannot help, the counter resets at
  // midnight UTC. Telling people "the AI service is busy" here sent them into a
  // retry loop against a wall. Must be checked before the generic rate-limit
  // branch, whose `resource_exhausted` match would otherwise swallow it.
  if (
    errorLower.includes("daily request quota") ||
    errorLower.includes("daily free quota") ||
    errorLower.includes("daily fair-use quota") ||
    errorLower.includes("daily quota")
  ) {
    const isFree = errorLower.includes("plan free") || errorLower.includes("free quota");
    return {
      type: "quota_exhausted",
      userMessage: isFree
        ? "You've used today's free requests. The limit resets at midnight UTC — or upgrade to Pro for a higher one."
        : "You've hit today's fair-use limit. It resets at midnight UTC.",
      technicalMessage: error,
      canRetry: false,
    };
  }

  // Rate limit / Quota exceeded
  if (
    errorLower.includes("429") ||
    errorLower.includes("resource_exhausted") ||
    errorLower.includes("quota") ||
    errorLower.includes("rate limit")
  ) {
    // Try to extract retry delay
    const retryMatch = error.match(/retry in (\d+\.?\d*)s/i);
    const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;

    return {
      type: "rate_limit",
      userMessage: `AI service is busy. Please try again in ${retrySeconds} seconds.`,
      technicalMessage: error,
      retryAfter: retrySeconds,
      canRetry: true,
      errorCode: "429",
    };
  }

  // Network errors
  if (
    errorLower.includes("network") ||
    errorLower.includes("fetch") ||
    errorLower.includes("connection") ||
    errorLower.includes("timeout")
  ) {
    return {
      type: "network",
      userMessage: "Connection issue. Please check your internet and try again.",
      technicalMessage: error,
      canRetry: true,
    };
  }

  // Validation errors
  if (
    errorLower.includes("invalid") ||
    errorLower.includes("validation") ||
    errorLower.includes("parse")
  ) {
    return {
      type: "validation",
      userMessage: "There was an issue processing your request. Please try again.",
      technicalMessage: error,
      canRetry: true,
    };
  }

  // Server errors
  if (
    errorLower.includes("500") ||
    errorLower.includes("internal") ||
    errorLower.includes("server error")
  ) {
    return {
      type: "server",
      userMessage: "Server error. Our team has been notified.",
      technicalMessage: error,
      canRetry: true,
    };
  }

  // Default unknown error
  return {
    type: "unknown",
    userMessage: "Something went wrong. Please try again.",
    technicalMessage: error,
    canRetry: true,
  };
};

/**
 * Validate a stream event has required fields
 */
export const isValidStreamEvent = (event: unknown): boolean => {
  if (!event || typeof event !== "object") return false;

  const e = event as Record<string, unknown>;

  // Must have a type
  if (!("type" in e) || typeof e.type !== "string") return false;

  // Error events must have an error field
  if (e.type === "error" && !("error" in e)) return false;

  // Data events should have data
  if (["itinerary", "chunk", "complete"].includes(e.type as string)) {
    // Allow empty data for complete events
    if (e.type === "complete") return true;
    if (!("data" in e)) return false;
  }

  return true;
};

/**
 * Check if an error is retryable
 */
export const isRetryableError = (error: ParsedError): boolean => {
  // Rate limits are always retryable after delay
  if (error.type === "rate_limit") return true;

  // Network errors are retryable
  if (error.type === "network") return true;

  // Server errors might be transient
  if (error.type === "server") return true;

  return error.canRetry;
};

/**
 * Calculate exponential backoff delay
 */
export const getBackoffDelay = (
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
): number => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
};

/**
 * Sleep utility for retry delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> => {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 30000, onRetry } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = getBackoffDelay(attempt, baseDelay, maxDelay);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};
