/** How long a piece of text may wait for a sentence to end before it is spoken. */
const MAX_PENDING = 240;

// A full stop after a number, a lone capital or a title is rarely the end of a
// sentence: "3.5 stars", "J. Smith", "St. George".
const SENTENCE_END =
  /(?<![0-9])(?<!\b[A-Z])(?<!\b(?:St|Dr|Mr|Mrs|Ms|Av|Sr|Sra))[.!?…]+["')\]]*\s+|\n+/g;

/**
 * Turns streamed text into pieces to read aloud.
 *
 * Speech starts on the first complete sentence rather than on the whole answer,
 * so a reply that takes a few seconds to arrive starts being heard in one.
 */
export class SentenceChunker {
  private pending = "";

  /** Adds text and returns any sentences it completed. */
  push(text: string): string[] {
    this.pending += text;
    const out: string[] = [];
    let start = 0;
    for (const match of this.pending.matchAll(SENTENCE_END)) {
      const end = match.index + match[0].length;
      const piece = this.pending.slice(start, end).trim();
      if (piece) out.push(piece);
      start = end;
    }
    this.pending = this.pending.slice(start);
    while (this.pending.length > MAX_PENDING) {
      const cut = this.pending.lastIndexOf(" ", MAX_PENDING);
      if (cut <= 0) break;
      out.push(this.pending.slice(0, cut).trim());
      this.pending = this.pending.slice(cut + 1);
    }
    return out.map(speakable).filter(Boolean);
  }

  /** Whatever is left when the answer ends. */
  flush(): string[] {
    const rest = speakable(this.pending.trim());
    this.pending = "";
    return rest ? [rest] : [];
  }
}

/** Strips what a voice would read out as punctuation. */
export function speakable(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
