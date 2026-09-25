// The first-run trip questionnaire (routes/trip-setup.tsx): what it sends and
// when it is offered. Pure, so the mapping is tested without the route.
//
// Bugs that lived here: the chips' display labels were sent as `interest_ids`
// (InvalidArgument on every submit with a selection); the pace and mobility
// values ("packed", "walking", "transit") were not the labels profile-enums
// knows, so both silently became ANY; and the first-run offer required zero
// profiles, which never happens because the server creates one per user.

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

/** Questionnaire value → the label profile-enums maps to a SearchPace (proto SEARCH_PACE_*). */
const PACE_LABEL: Record<string, string> = {
  relaxed: "relaxed",
  moderate: "moderate",
  packed: "fast",
};

/**
 * Questionnaire value → the label profile-enums maps to a TransportPreference
 * (proto TRANSPORT_PREFERENCE_WALK / _PUBLIC / _CAR). Step-free travel is
 * transit plus prefer_accessible_pois: the proto has no wheelchair mode, and
 * WALK would bias the plan towards long on-foot legs.
 */
const MOBILITY_LABEL: Record<string, string> = {
  walking: "walk",
  transit: "public",
  car: "car",
  wheelchair: "public",
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

export const TRIP_SETUP_PROFILE_NAME = "My Trip Profile";

/**
 * The name the server gives the profile it creates for every new user (the
 * `AFTER INSERT ON users` trigger in migration 0008). Every account therefore
 * has at least one profile from its first second.
 */
export const SERVER_DEFAULT_PROFILE_NAME = "Default";

/** The default profile the first search will read. */
export function tripSetupProfile(input: TripSetupInput): TripSetupProfile {
  return {
    profile_name: TRIP_SETUP_PROFILE_NAME,
    is_default: true,
    budget_level: Number(input.budget) || 2,
    preferred_pace: PACE_LABEL[input.pace] ?? "moderate",
    preferred_transport: MOBILITY_LABEL[input.mobility] ?? "walk",
    prefer_accessible_pois: input.mobility === "wheelchair",
    interests: interestIdsFor(input.interests, input.catalogue),
  };
}

/** The slice of a stored profile the first-run logic reads. */
export interface ExistingProfile {
  id: string;
  profile_name: string;
  is_default: boolean;
  preferred_vibes?: readonly string[] | null;
  dietary_needs?: readonly string[] | null;
  interests?: readonly { id: string }[] | null;
  tags?: readonly { id: string }[] | null;
}

export type TripSetupSave =
  | { mode: "create"; data: TripSetupProfile }
  | {
      mode: "update";
      profileId: string;
      data: TripSetupProfile & {
        preferred_vibes: string[];
        dietary_needs: string[];
        tags: string[];
      };
    };

/**
 * Create or update. An account always has the server's default profile, so
 * creating would leave two: the untouched "Default" and "My Trip Profile".
 * The default profile is updated in place instead. The server replaces
 * list-valued fields wholesale on update, so vibes, dietary needs and tags are
 * carried over, and a name the user chose is kept.
 */
export function tripSetupSave(
  input: TripSetupInput,
  existing: readonly ExistingProfile[],
): TripSetupSave {
  const data = tripSetupProfile(input);
  const target = existing.find((p) => p.is_default);
  if (!target) return { mode: "create", data };
  return {
    mode: "update",
    profileId: target.id,
    data: {
      ...data,
      profile_name:
        target.profile_name && target.profile_name !== SERVER_DEFAULT_PROFILE_NAME
          ? target.profile_name
          : TRIP_SETUP_PROFILE_NAME,
      preferred_vibes: [...(target.preferred_vibes ?? [])],
      dietary_needs: [...(target.dietary_needs ?? [])],
      tags: (target.tags ?? []).map((t) => t.id),
    },
  };
}

/** Still exactly what the server created at sign-up: nothing a person chose. */
export function isUntouchedProfile(p: ExistingProfile): boolean {
  return (
    p.profile_name === SERVER_DEFAULT_PROFILE_NAME &&
    !p.interests?.length &&
    !p.tags?.length &&
    !p.preferred_vibes?.length &&
    !p.dietary_needs?.length
  );
}

/** localStorage key prefix: the questionnaire was shown (finished or skipped) to this user here. */
export const TRIP_SETUP_SEEN_KEY = "loci_trip_setup_seen";

export const tripSetupSeenKey = (userId: string): string => `${TRIP_SETUP_SEEN_KEY}:${userId}`;

/**
 * Offer the questionnaire once, to a brand-new account: never again after it
 * was seen, and never to an account that already has a profile someone
 * customised.
 */
export function shouldOfferTripSetup(args: {
  isNewUser: boolean;
  seen: string | null;
  profiles: readonly ExistingProfile[];
}): boolean {
  if (!args.isNewUser || args.seen) return false;
  return args.profiles.every(isUntouchedProfile);
}

/**
 * A same-origin path to continue to, or the fallback. Rejects absolute and
 * protocol-relative URLs (open redirect) and the auth and questionnaire routes
 * themselves (loops).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/discover"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  if (next.startsWith("/trip-setup") || next.startsWith("/auth/")) return fallback;
  return next;
}

export const tripSetupHref = (next?: string | null): string => {
  const path = next ? safeNextPath(next, "") : "";
  return path ? `/trip-setup?next=${encodeURIComponent(path)}` : "/trip-setup";
};

/**
 * Where a successful sign-in lands: where the user was headed (home when
 * nowhere), or, for a brand-new account, the questionnaire once and then
 * there. A failed profile read never blocks sign-in.
 */
export async function postSignInTarget(args: {
  isNewUser: boolean;
  seen: string | null;
  returnTo?: string | null;
  loadProfiles: () => Promise<readonly ExistingProfile[]>;
}): Promise<string> {
  const destination = args.returnTo || "/";
  if (!args.isNewUser || args.seen) return destination;
  try {
    const profiles = await args.loadProfiles();
    return shouldOfferTripSetup({ isNewUser: true, seen: args.seen, profiles })
      ? tripSetupHref(args.returnTo)
      : destination;
  } catch {
    return destination;
  }
}

export function readTripSetupSeen(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(tripSetupSeenKey(userId));
  } catch {
    return null;
  }
}

export function markTripSetupSeen(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(tripSetupSeenKey(userId), "1");
  } catch {
    /* private mode */
  }
}
