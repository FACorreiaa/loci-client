// Client-side "why this stop" helpers. Mirror server TrustSignals until the
// published BSR client package includes recommendation_rationale.

export interface WhyThisInput {
  category?: string | null;
  rating?: number | null;
  recommendation_rationale?: string | null;
  tags?: string[] | null;
  /** Why the place fits this traveller's taste (TasteMatch.reasons). */
  taste_reasons?: string[] | null;
}

/** Short human rationale for a POI / trip stop. */
export function deriveWhyThis(input: WhyThisInput): string | undefined {
  // What Loci knows about this traveller beats anything generic.
  const fromTaste = input.taste_reasons?.find((r) => r.trim())?.trim();
  if (fromTaste) return fromTaste;

  const fromServer = input.recommendation_rationale?.trim();
  if (fromServer) return fromServer;

  const category = input.category?.trim();
  const rating = input.rating ?? 0;
  if (rating >= 4.0 && category) {
    return `Highly rated ${category} that fits your search.`;
  }
  if (category) {
    return `A ${category} matching your preferences.`;
  }
  const tag = input.tags?.find((t) => t.trim());
  if (tag) {
    return `Suggested because of your interest in ${tag}.`;
  }
  return undefined;
}
