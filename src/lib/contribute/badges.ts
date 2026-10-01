/** A contributor badge as the hero shows it. */
export interface ContributorBadge {
  slug: string;
  name: string;
  /** Empty when the server sent no copy for it. */
  description: string;
}

export interface BadgeDetailWire {
  slug: string;
  displayName: string;
  description: string;
}

/** `first_report` → `First report`: readable, if not the server's own words. */
export const badgeNameFromSlug = (slug: string): string => {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words === "" ? slug : words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The profile's badges with their display copy.
 *
 * `badge_details` carries the same badges as `badges`, in the same order, with
 * the wording the server owns. It prefers those; a server that predates it, or
 * a detail with no display name, falls back to the slug. A slug only in
 * `badges` still shows, and nothing is listed twice.
 */
export const toContributorBadges = (
  slugs: readonly string[],
  details: readonly BadgeDetailWire[],
): ContributorBadge[] => {
  const bySlug = new Map(details.map((detail) => [detail.slug, detail]));
  const order = [...details.map((detail) => detail.slug), ...slugs];
  const seen = new Set<string>();
  const badges: ContributorBadge[] = [];
  for (const slug of order) {
    if (slug === "" || seen.has(slug)) continue;
    seen.add(slug);
    const detail = bySlug.get(slug);
    const name = detail?.displayName.trim() ?? "";
    badges.push({
      slug,
      name: name === "" ? badgeNameFromSlug(slug) : name,
      description: detail?.description.trim() ?? "",
    });
  }
  return badges;
};
