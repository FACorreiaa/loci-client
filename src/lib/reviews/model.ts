// Reviews, the rules: what a star means, what a form may send, how long text
// folds, how a helpful vote toggles. Mirrors loci-ios Features/Reviews/Model
// so both clients read and write reviews the same way.

export type RatingTone = "high" | "middle" | "low";

const LABELS = ["", "Terrible", "Poor", "Average", "Good", "Excellent"];

/** "Terrible" … "Excellent" for a whole star; "" outside 1–5. */
export function ratingLabel(rating: number): string {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? LABELS[rating] : "";
}

/** Colour band for an average: 4 and up is good, 3 and up is fine, below is poor. */
export function ratingTone(average: number): RatingTone {
  if (average >= 4) return "high";
  if (average >= 3) return "middle";
  return "low";
}

/** The server stores doubles; the UI shows whole stars 1–5. */
export function clampRating(rating: number): number {
  if (!Number.isFinite(rating)) return 1;
  return Math.min(5, Math.max(1, Math.round(rating)));
}

export const CONTENT_MIN = 10;
export const CONTENT_MAX = 1000;
export const TITLE_MAX = 100;

export type FormIssue =
  | "noRating"
  | "noContent"
  | "contentTooShort"
  | "contentTooLong"
  | "titleTooLong";

export interface ReviewFormValues {
  rating: number;
  title: string;
  content: string;
}

/** Everything wrong with a form, in the order the form shows it; empty means it can be sent. */
export function formIssues(values: ReviewFormValues): FormIssue[] {
  const issues: FormIssue[] = [];
  if (!(values.rating >= 1 && values.rating <= 5)) issues.push("noRating");
  const content = values.content.trim();
  if (content.length === 0) issues.push("noContent");
  else if (content.length < CONTENT_MIN) issues.push("contentTooShort");
  else if (content.length > CONTENT_MAX) issues.push("contentTooLong");
  if (values.title.trim().length > TITLE_MAX) issues.push("titleTooLong");
  return issues;
}

export function formIssueMessage(issue: FormIssue): string {
  switch (issue) {
    case "noRating":
      return "Please select a rating";
    case "noContent":
      return "Please write your review";
    case "contentTooShort":
      return `Review must be at least ${CONTENT_MIN} characters`;
    case "contentTooLong":
      return `Review must be at most ${CONTENT_MAX} characters`;
    case "titleTooLong":
      return `Title must be at most ${TITLE_MAX} characters`;
  }
}

export const FOLD_AT = 200;

export function needsFold(text: string): boolean {
  return text.length > FOLD_AT;
}

/** The first 199 characters and an ellipsis, or the text itself when it fits. */
export function foldText(text: string): string {
  return needsFold(text) ? text.slice(0, FOLD_AT - 1) + "…" : text;
}

export interface VoteState {
  voted: boolean;
  helpful: number;
}

/**
 * A tap on Helpful toggles: the request carries the new state (`isLike`),
 * and the count moves with it. Web used to send true every time, so a second
 * tap could never take a vote back.
 */
export function nextVote(state: VoteState): VoteState & { isLike: boolean } {
  const voted = !state.voted;
  const helpful = voted ? state.helpful + 1 : Math.max(0, state.helpful - 1);
  return { voted, helpful, isLike: voted };
}

/** A vote the page is showing: the server's state, or one in flight or settled. */
export interface ShownVote extends VoteState {
  pending: boolean;
}

/** Where a review's vote starts: the server's `voted_by_me` and count, or what this page last set. */
export function shownVote(
  review: { votedByMe: boolean; helpful: number },
  override: ShownVote | undefined,
): ShownVote {
  return override ?? { voted: review.votedByMe, helpful: review.helpful, pending: false };
}

/**
 * The tap: flips at once and marks the vote in flight, or null when a vote is
 * already in flight (a second tap is ignored rather than racing the first).
 */
export function beginVote(current: ShownVote): (ShownVote & { isLike: boolean }) | null {
  if (current.pending) return null;
  const next = nextVote(current);
  return { ...next, pending: true };
}

/** The server answered: its `new_helpful_count` is the count, whatever we guessed. */
export function settleVote(inFlight: ShownVote, newHelpfulCount: number): ShownVote {
  return { voted: inFlight.voted, helpful: Math.max(0, newHelpfulCount), pending: false };
}

/** The server refused: back to what was shown before the tap. */
export function rollbackVote(before: ShownVote): ShownVote {
  return { ...before, pending: false };
}

// --- visit date ---
// A visit is a calendar day, not an instant. The picked day goes out as 12:00
// UTC and is read back in UTC, so it never moves a day in another time zone
// (the same rule as iOS).

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-03-05" → 2026-03-05T12:00:00Z; undefined for an empty or malformed day. */
export function visitDayToDate(day: string): Date | undefined {
  const m = DAY_RE.exec(day.trim());
  if (!m) return undefined;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The stored visit back as the day the form shows (UTC), or "". */
export function visitDayFromISO(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** "Visited March 2026", read in UTC. */
export function visitLabel(iso?: string, locale?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.toLocaleDateString(locale ?? "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Visited ${month}`;
}

// --- reports ---

/** The reasons ReportReview accepts; anything else is InvalidArgument. */
export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "fake", label: "Fake review" },
  { value: "offensive", label: "Offensive" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_DETAILS_MAX = 1000;

export function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

// --- statistics ---

export type StarBreakdown = Record<1 | 2 | 3 | 4 | 5, number>;

/** Each star's share (0–100, rounded) of the breakdown's own sum, so the bars agree with each other. */
export function breakdownShares(breakdown: StarBreakdown): StarBreakdown {
  const sum = breakdown[1] + breakdown[2] + breakdown[3] + breakdown[4] + breakdown[5];
  const share = (n: number) => (sum > 0 ? Math.round((n / sum) * 100) : 0);
  return {
    1: share(breakdown[1]),
    2: share(breakdown[2]),
    3: share(breakdown[3]),
    4: share(breakdown[4]),
    5: share(breakdown[5]),
  };
}

export interface MineSummary {
  count: number;
  averageGiven: number;
  helpfulReceived: number;
  /** How many of your reviews gave each star count. */
  distribution: StarBreakdown;
}

const emptyBreakdown = (): StarBreakdown => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

/** My reviews' summary line computed from the loaded rows. */
export function summariseMine(rows: readonly { rating: number; helpful: number }[]): MineSummary {
  const distribution = emptyBreakdown();
  for (const r of rows) distribution[clampRating(r.rating) as 1 | 2 | 3 | 4 | 5] += 1;
  if (rows.length === 0) return { count: 0, averageGiven: 0, helpfulReceived: 0, distribution };
  const total = rows.reduce((sum, r) => sum + r.rating, 0);
  return {
    count: rows.length,
    averageGiven: Math.round((total / rows.length) * 10) / 10,
    helpfulReceived: rows.reduce((sum, r) => sum + r.helpful, 0),
    distribution,
  };
}

/**
 * My reviews' summary: the server's UserReviewStatistics when it sent them
 * (api #101 fills them, covering every page), otherwise worked out from the
 * rows loaded so far (older servers leave the message empty).
 */
export function mineSummary(
  server: MineSummary | undefined,
  rows: readonly { rating: number; helpful: number }[],
): MineSummary {
  if (server && server.count > 0) {
    return { ...server, averageGiven: Math.round(server.averageGiven * 10) / 10 };
  }
  return summariseMine(rows);
}
