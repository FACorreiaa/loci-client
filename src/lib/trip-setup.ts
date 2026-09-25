// The first-run trip questionnaire (routes/trip-setup.tsx): what it sends and
// when it is offered. Pure, so the mapping is tested without the route.
//
// Two bugs lived here: the chips' display labels were sent as `interest_ids`
// (InvalidArgument on every submit with a selection), and the pace and
// mobility values ("packed", "walking", "transit") were not the labels
// profile-enums knows, so both silently became ANY.

/** Curated chips, matched against the interest catalogue by name. */
export const TRIP_SETUP_INTERESTS = [
  "Food & Dining",
  "Art & Culture",
  "History",
  "Nature & Parks",
  "Nightlife",
  "Shopping",
  "Architecture",
  "Photography",
  "Local Culture",
  "Adventure",
  "Relaxation",
  "Family",
] as const;

export interface CatalogueInterest {
  id: string;
  name: string;
}

/** Catalogue ids for the chosen labels, in chip order; labels the catalogue lacks are dropped. */
export function interestIdsFor(
  labels: readonly string[],
  catalogue: readonly CatalogueInterest[],
): string[] {
  const byName = new Map(catalogue.map((i) => [i.name.trim().toLowerCase(), i.id]));
  const out: string[] = [];
  for (const label of labels) {
    const id = byName.get(label.trim().toLowerCase());
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Questionnaire value → the label profile-enums maps to a SearchPace. */
const PACE_LABEL: Record<string, string> = {
  relaxed: "relaxed",
  moderate: "moderate",
  packed: "fast",
};

/** Questionnaire value → the label profile-enums maps to a TransportPreference. */
const MOBILITY_LABEL: Record<string, string> = {
  walking: "walk",
  transit: "public",
  car: "car",
  wheelchair: "walk",
};

export interface TripSetupInput {
  budget: string;
  pace: string;
  mobility: string;
  interests: readonly string[];
  catalogue: readonly CatalogueInterest[];
}

export interface TripSetupProfile {
  profile_name: string;
  is_default: boolean;
  budget_level: number;
  preferred_pace: string;
  preferred_transport: string;
  prefer_accessible_pois: boolean;
  interests: string[];
}

/** The default profile the first search will read. */
export function tripSetupProfile(input: TripSetupInput): TripSetupProfile {
  return {
    profile_name: "My Trip Profile",
    is_default: true,
    budget_level: Number(input.budget) || 2,
    preferred_pace: PACE_LABEL[input.pace] ?? "moderate",
    preferred_transport: MOBILITY_LABEL[input.mobility] ?? "walk",
    prefer_accessible_pois: input.mobility === "wheelchair",
    interests: interestIdsFor(input.interests, input.catalogue),
  };
}

/** localStorage key: the questionnaire was shown (finished or skipped) on this browser. */
export const TRIP_SETUP_SEEN_KEY = "loci_trip_setup_seen";

/** Offer the questionnaire once: never again after it was seen, never to an account that already has profiles. */
export function shouldOfferTripSetup(
  seen: string | null,
  profileCount: number | undefined,
): boolean {
  if (seen) return false;
  return (profileCount ?? 0) === 0;
}

/**
 * Where a successful sign-in lands. A fresh account with no profiles goes to
 * the questionnaire once; a failed profile read never blocks sign-in.
 */
export async function postSignInTarget(args: {
  seen: string | null;
  countProfiles: () => Promise<number>;
}): Promise<string> {
  if (args.seen) return "/";
  try {
    return shouldOfferTripSetup(args.seen, await args.countProfiles()) ? "/trip-setup" : "/";
  } catch {
    return "/";
  }
}

export function readTripSetupSeen(): string | null {
  try {
    return localStorage.getItem(TRIP_SETUP_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markTripSetupSeen(): void {
  try {
    localStorage.setItem(TRIP_SETUP_SEEN_KEY, "1");
  } catch {
    /* private mode */
  }
}
