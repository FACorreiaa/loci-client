/**
 * Turn a thrown Connect error into something worth showing a person.
 *
 * Connect prefixes a failure's message with its code, as in
 * "[failed_precondition] cannot delete the default travel profile". That prefix
 * means nothing to whoever clicked the button, and everywhere except the
 * two-factor card it was reaching them intact — this lived as a private helper
 * there and nowhere else.
 */
export function errorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return fallback;
  return raw.replace(/^\[.*?\]\s*/, "") || fallback;
}
