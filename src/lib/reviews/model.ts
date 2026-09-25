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

export interface MineSummary {
  count: number;
  averageGiven: number;
  helpfulReceived: number;
}

/** My reviews' summary line, from the rows: the server leaves UserReviewStatistics empty. */
export function summariseMine(rows: readonly { rating: number; helpful: number }[]): MineSummary {
  if (rows.length === 0) return { count: 0, averageGiven: 0, helpfulReceived: 0 };
  const total = rows.reduce((sum, r) => sum + r.rating, 0);
  return {
    count: rows.length,
    averageGiven: Math.round((total / rows.length) * 10) / 10,
    helpfulReceived: rows.reduce((sum, r) => sum + r.helpful, 0),
  };
}
