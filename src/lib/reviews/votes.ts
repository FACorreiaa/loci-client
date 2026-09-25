// Which reviews this browser marked helpful. The server has no "voted by me"
// flag yet (pass-2 item 12), so the toggle is remembered here; it is a
// convenience, not truth, and it never reaches the server.
const KEY = "loci_review_votes";

export function readVotes(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

export function writeVotes(votes: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...votes]));
  } catch {
    /* private mode */
  }
}
