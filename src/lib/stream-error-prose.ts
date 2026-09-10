/**
 * Server-authored sentences ("Unable to find places near your location. Please
 * try again or expand your search radius.") reach the client already
 * user-facing. parseStreamError only knows transport failures, so it filed
 * them under "unknown" and replaced them with "Something went wrong." —
 * throwing away the one line that told the person what to do. Prose passes
 * through; anything that smells like a stack trace or a wire error does not.
 */
export const readsAsProse = (s: string): boolean => {
  const t = s.trim();
  if (t.length < 12 || t.length > 240) return false;
  if (!/[.!]$/.test(t)) return false;
  if (/[{}[\]<>]|code[=:]|\bat\s+\w+\s*\(|\bError:|\[connect/i.test(t)) return false;
  return /^[A-Z]/.test(t);
};
