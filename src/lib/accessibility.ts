// src/lib/accessibility.ts
//
// A traveller's access needs (profile.proto AccessibilityNeeds) and the
// accessibility evidence the server attaches to places and walks between them
// (poi.proto AccessibilityNote, chat.proto AccessibleRoutePayload).
//
// Needs are functional needs, never diagnoses, and they are GDPR Article 9
// health data: the server stores them only with explicit consent and rejects
// them without it. Nothing in this module logs or reports them, and nothing
// should — keep them out of analytics, logger calls and error messages.
import { create } from "@bufbuild/protobuf";
import {
  AccessibilityNeedsSchema,
  MaxIncline,
  MobilityLevel,
  type AccessibilityNeeds as ProtoAccessibilityNeeds,
} from "@buf/loci_loci-proto.bufbuild_es/loci/profile/profile_pb.js";
import {
  AccessibilityNoteSeverity,
  AccessibilityNoteSource,
  type AccessibilityNote as ProtoAccessibilityNote,
} from "@buf/loci_loci-proto.bufbuild_es/loci/poi/poi_pb.js";
import type {
  AccessibleRoutePayload as ProtoAccessibleRoute,
  WalkingLeg as ProtoWalkingLeg,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";

// ==================
// NEEDS
// ==================

export type Mobility =
  | "none"
  | "limited_walking"
  | "walking_aid"
  | "manual_wheelchair"
  | "power_wheelchair"
  | "mobility_scooter";

export type Incline = "any" | "pct_10" | "pct_6" | "pct_3";

/** Form state for AccessibilityNeeds. Zero means "no limit" for the minutes. */
export interface AccessibilityNeeds {
  mobility: Mobility;
  max_walk_minutes_per_leg: number;
  max_walk_minutes_per_day: number;
  step_free_only: boolean;
  max_incline: Incline;
  rest_every_minutes: number;
  needs_seating_at_stops: boolean;
  needs_accessible_toilet: boolean;
  avoid_cobbles: boolean;
  low_vision: boolean;
  blind: boolean;
  deaf_or_hard_of_hearing: boolean;
  sensory_sensitive: boolean;
  prefers_quiet_times: boolean;
  needs_predictable_plan: boolean;
  fatigue_or_chronic_pain: boolean;
  service_animal: boolean;
  stroller: boolean;
  travelling_with_companion: boolean;
  notes: string;
}

/** The server's limit on the free-text note. */
export const NOTES_LIMIT = 500;
export const LEG_CHOICES = [0, 5, 10, 15, 20, 30, 45, 60];
export const DAY_CHOICES = [0, 30, 60, 90, 120, 180, 240];
export const REST_CHOICES = [0, 20, 30, 45, 60, 90];

export const MOBILITY_CHOICES: { value: Mobility; label: string }[] = [
  { value: "none", label: "No mobility needs" },
  { value: "limited_walking", label: "I can walk short distances" },
  { value: "walking_aid", label: "I use a cane, crutches or a walker" },
  { value: "manual_wheelchair", label: "I use a manual wheelchair" },
  { value: "power_wheelchair", label: "I use a power wheelchair" },
  { value: "mobility_scooter", label: "I use a mobility scooter" },
];

export const INCLINE_CHOICES: { value: Incline; label: string }[] = [
  { value: "any", label: "Any slope" },
  { value: "pct_10", label: "Steeper slopes are fine (10%)" },
  { value: "pct_6", label: "Moderate slopes (6%)" },
  { value: "pct_3", label: "Gentle slopes only (3%)" },
];

export const minutesLimitLabel = (m: number) => (m === 0 ? "No limit" : `${m} min`);

export const emptyNeeds = (): AccessibilityNeeds => ({
  mobility: "none",
  max_walk_minutes_per_leg: 0,
  max_walk_minutes_per_day: 0,
  step_free_only: false,
  max_incline: "any",
  rest_every_minutes: 0,
  needs_seating_at_stops: false,
  needs_accessible_toilet: false,
  avoid_cobbles: false,
  low_vision: false,
  blind: false,
  deaf_or_hard_of_hearing: false,
  sensory_sensitive: false,
  prefers_quiet_times: false,
  needs_predictable_plan: false,
  fatigue_or_chronic_pain: false,
  service_animal: false,
  stroller: false,
  travelling_with_companion: false,
  notes: "",
});

const MOBILITY_TO_PROTO: Record<Mobility, MobilityLevel> = {
  none: MobilityLevel.NONE,
  limited_walking: MobilityLevel.LIMITED_WALKING,
  walking_aid: MobilityLevel.WALKING_AID,
  manual_wheelchair: MobilityLevel.MANUAL_WHEELCHAIR,
  power_wheelchair: MobilityLevel.POWER_WHEELCHAIR,
  mobility_scooter: MobilityLevel.MOBILITY_SCOOTER,
};

const INCLINE_TO_PROTO: Record<Incline, MaxIncline> = {
  any: MaxIncline.ANY,
  pct_10: MaxIncline.PCT_10,
  pct_6: MaxIncline.PCT_6,
  pct_3: MaxIncline.PCT_3,
};

const invert = <K extends string, V extends number>(m: Record<K, V>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<number, K>;
const MOBILITY_FROM_PROTO = invert(MOBILITY_TO_PROTO);
const INCLINE_FROM_PROTO = invert(INCLINE_TO_PROTO);

/**
 * Needs the server returned, or null when the profile holds none. Needs
 * without a consent timestamp are treated as absent: the server never stores
 * one without the other, so seeing that means something upstream is wrong and
 * the safe reading is "nothing consented".
 */
export function needsFromProto(p: ProtoAccessibilityNeeds | undefined): AccessibilityNeeds | null {
  if (!p || !p.consentAt) return null;
  return {
    mobility: MOBILITY_FROM_PROTO[p.mobility] ?? "none",
    max_walk_minutes_per_leg: p.maxWalkMinutesPerLeg,
    max_walk_minutes_per_day: p.maxWalkMinutesPerDay,
    step_free_only: p.stepFreeOnly,
    max_incline: INCLINE_FROM_PROTO[p.maxIncline] ?? "any",
    rest_every_minutes: p.restEveryMinutes,
    needs_seating_at_stops: p.needsSeatingAtStops,
    needs_accessible_toilet: p.needsAccessibleToilet,
    avoid_cobbles: p.avoidCobbles,
    low_vision: p.lowVision,
    blind: p.blind,
    deaf_or_hard_of_hearing: p.deafOrHardOfHearing,
    sensory_sensitive: p.sensorySensitive,
    prefers_quiet_times: p.prefersQuietTimes,
    needs_predictable_plan: p.needsPredictablePlan,
    fatigue_or_chronic_pain: p.fatigueOrChronicPain,
    service_animal: p.serviceAnimal,
    stroller: p.stroller,
    travelling_with_companion: p.travellingWithCompanion,
    notes: p.notes,
  };
}

/** The wire message. consent_at is the server's to set and is never sent. */
export function needsToProto(n: AccessibilityNeeds): ProtoAccessibilityNeeds {
  return create(AccessibilityNeedsSchema, {
    mobility: MOBILITY_TO_PROTO[n.mobility],
    maxWalkMinutesPerLeg: n.max_walk_minutes_per_leg,
    maxWalkMinutesPerDay: n.max_walk_minutes_per_day,
    stepFreeOnly: n.step_free_only,
    maxIncline: INCLINE_TO_PROTO[n.max_incline],
    restEveryMinutes: n.rest_every_minutes,
    needsSeatingAtStops: n.needs_seating_at_stops,
    needsAccessibleToilet: n.needs_accessible_toilet,
    avoidCobbles: n.avoid_cobbles,
    lowVision: n.low_vision,
    blind: n.blind,
    deafOrHardOfHearing: n.deaf_or_hard_of_hearing,
    sensorySensitive: n.sensory_sensitive,
    prefersQuietTimes: n.prefers_quiet_times,
    needsPredictablePlan: n.needs_predictable_plan,
    fatigueOrChronicPain: n.fatigue_or_chronic_pain,
    serviceAnimal: n.service_animal,
    stroller: n.stroller,
    travellingWithCompanion: n.travelling_with_companion,
    notes: n.notes.trim().slice(0, NOTES_LIMIT),
  });
}

const normalised = (n: AccessibilityNeeds): AccessibilityNeeds => ({
  ...n,
  notes: n.notes.trim().slice(0, NOTES_LIMIT),
});

export const sameNeeds = (a: AccessibilityNeeds, b: AccessibilityNeeds) =>
  JSON.stringify(normalised(a)) === JSON.stringify(normalised(b));

/**
 * Whether the needs say anything. Matches the server's
 * AccessibilityNeeds.Active: "no mobility constraint" and "any slope" are the
 * same as unset, so an untouched form is "no needs".
 */
export const needsActive = (n: AccessibilityNeeds) => !sameNeeds(n, emptyNeeds());

/** Wheels or a stroller mean step-free routing, as on the server. */
export const needsStepFree = (n: AccessibilityNeeds) =>
  n.step_free_only ||
  n.stroller ||
  n.mobility === "manual_wheelchair" ||
  n.mobility === "power_wheelchair" ||
  n.mobility === "mobility_scooter";

/** The editor's accessibility state, alongside the rest of the profile form. */
export interface AccessibilityFormState {
  /** What the form shows. */
  needs: AccessibilityNeeds;
  /** The needs the server holds (consented), or null when it holds none. */
  stored: AccessibilityNeeds | null;
  /** The traveller ticked consent in this editing session. */
  consentGiven: boolean;
  /** The traveller asked to delete the stored needs. */
  clear: boolean;
}

export const accessibilityFormFor = (
  stored: AccessibilityNeeds | null,
): AccessibilityFormState => ({
  needs: stored ? { ...stored } : emptyNeeds(),
  stored,
  consentGiven: false,
  clear: false,
});

/** Fields are editable once consent exists, already stored or just given. */
export const canEditNeeds = (s: AccessibilityFormState) =>
  (s.stored !== null && !s.clear) || s.consentGiven;

/** Delete: clears the form and withdraws consent, so saving again asks again. */
export const deleteNeeds = (s: AccessibilityFormState): AccessibilityFormState => ({
  needs: emptyNeeds(),
  stored: s.stored,
  consentGiven: false,
  clear: s.stored !== null,
});

/** The accessibility fields of a CreateUserPreferenceProfileRequest. */
export function accessibilityCreateFields(s: AccessibilityFormState | undefined): {
  accessibilityNeeds?: ProtoAccessibilityNeeds;
  accessibilityConsentGiven?: boolean;
} {
  if (!s || !s.consentGiven || !needsActive(s.needs)) return {};
  return { accessibilityNeeds: needsToProto(s.needs), accessibilityConsentGiven: true };
}

/**
 * The accessibility fields of an UpdateUserPreferenceProfileRequest. Needs go
 * on the wire only when they change, so a save that touched nothing else never
 * re-sends health data. Order matters:
 *  1. fresh consent with needs wins (re-consent after a delete in one session),
 *  2. then a delete of what is stored,
 *  3. then changed stored needs (emptied needs are a delete too).
 */
export function accessibilityUpdateFields(s: AccessibilityFormState | undefined): {
  accessibilityNeeds?: ProtoAccessibilityNeeds;
  accessibilityConsentGiven?: boolean;
  clearAccessibilityNeeds?: boolean;
} {
  if (!s) return {};
  if (s.consentGiven && needsActive(s.needs)) {
    return { accessibilityNeeds: needsToProto(s.needs), accessibilityConsentGiven: true };
  }
  if (s.stored === null) return {};
  if (s.clear || !needsActive(s.needs)) return { clearAccessibilityNeeds: true };
  if (sameNeeds(s.needs, s.stored)) return {};
  return { accessibilityNeeds: needsToProto(s.needs) };
}

export const CONSENT_EXPLANATION =
  "Tell Loci what you need, such as step-free routes, rest breaks or an accessible toilet, " +
  "and plans are built around it. This is health information: it is kept on this profile only, " +
  "never shown to other travellers or used for ads, and you can delete it at any time.";

// ==================
// NOTES
// ==================

export type NoteSeverity = "info" | "caution" | "barrier";
export type NoteSource = "verified_crowd" | "open_data" | "routed" | "ai_estimate";

/** One accessibility claim about a place or a walk, with where it came from. */
export interface AccessibilityNote {
  text: string;
  severity: NoteSeverity;
  source: NoteSource;
  source_licence?: string;
}

const SEVERITY: Record<number, NoteSeverity> = {
  [AccessibilityNoteSeverity.INFO]: "info",
  [AccessibilityNoteSeverity.CAUTION]: "caution",
  [AccessibilityNoteSeverity.BARRIER]: "barrier",
};

const SOURCE: Record<number, NoteSource> = {
  [AccessibilityNoteSource.VERIFIED_CROWD]: "verified_crowd",
  [AccessibilityNoteSource.OPEN_DATA]: "open_data",
  [AccessibilityNoteSource.ROUTED]: "routed",
  [AccessibilityNoteSource.AI_ESTIMATE]: "ai_estimate",
};

/**
 * An unknown severity reads as caution and an unknown source as an AI
 * estimate: when the client cannot tell how sure a claim is, it must not
 * present it as surer than the least-sure thing the server sends.
 */
export const noteFromProto = (n: ProtoAccessibilityNote): AccessibilityNote => ({
  text: n.text,
  severity: SEVERITY[n.severity] ?? "caution",
  source: SOURCE[n.source] ?? "ai_estimate",
  source_licence: n.sourceLicence || undefined,
});

const SEVERITY_RANK: Record<NoteSeverity, number> = { barrier: 0, caution: 1, info: 2 };

/** Barriers first, then cautions, then information; stable within a level. */
export const bySeverity = (notes: AccessibilityNote[]) =>
  notes
    .map((note, i) => ({ note, i }))
    .sort((a, b) => SEVERITY_RANK[a.note.severity] - SEVERITY_RANK[b.note.severity] || a.i - b.i)
    .map((x) => x.note);

export function sourceLabel(n: AccessibilityNote): string {
  switch (n.source) {
    case "verified_crowd":
      return "Confirmed by travellers";
    case "open_data":
      return n.source_licence ? `Open data · ${n.source_licence}` : "Open data";
    case "routed":
      return "Route check";
    default:
      return "AI estimate · check ahead";
  }
}

export const severityLabel: Record<NoteSeverity, string> = {
  barrier: "Barrier",
  caution: "Caution",
  info: "Info",
};

// ==================
// WALKING LEGS
// ==================

export interface WalkingLeg {
  /** The server's reference for a stop: its id, or its name when it has none. */
  from_ref: string;
  to_ref: string;
  distance_m: number;
  duration_min: number;
  ascent_m: number;
  /** false: a straight-line estimate, not a checked route. */
  routed: boolean;
  notes: AccessibilityNote[];
  suggest_mode?: "taxi" | "transit";
}

/** One day's walks between consecutive stops (STREAM_EVENT_TYPE_ACCESSIBLE_ROUTE). */
export interface AccessibleRoute {
  /** 1-based, as on the wire and on POIDetailedInfo.day. */
  day: number;
  legs: WalkingLeg[];
  total_walk_minutes: number;
  warnings: string[];
}

const legFromProto = (l: ProtoWalkingLeg): WalkingLeg => ({
  from_ref: l.fromPoiId,
  to_ref: l.toPoiId,
  distance_m: l.distanceM,
  duration_min: l.durationMin,
  ascent_m: l.ascentM,
  routed: l.routed,
  notes: l.notes.map(noteFromProto),
  suggest_mode: l.suggestMode === "taxi" || l.suggestMode === "transit" ? l.suggestMode : undefined,
});

export const accessibleRouteFromProto = (p: ProtoAccessibleRoute): AccessibleRoute => ({
  day: p.day,
  legs: p.legs.map(legFromProto),
  total_walk_minutes: p.totalWalkMinutes,
  warnings: [...p.warnings],
});

/** Replace a day's route, keeping the others, in day order. */
export const withAccessibleRoute = (
  routes: AccessibleRoute[] | undefined,
  route: AccessibleRoute,
): AccessibleRoute[] =>
  [...(routes ?? []).filter((r) => r.day !== route.day), route].sort((a, b) => a.day - b.day);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * How the server names a stop in a WalkingLeg: its id, or its name when it has
 * none. The client substitutes a slug for a missing id, so a non-UUID id means
 * the server sent none.
 */
export const routeRef = (poi: { id?: string; name: string }) =>
  poi.id && UUID.test(poi.id) && poi.id !== NIL_UUID ? poi.id : poi.name;

/**
 * The walk that arrives at `to` straight from `from`. Both ends must match: the
 * client orders a day's stops by priority and the server by the order the
 * model listed them, and a leg drawn between two cards it does not connect
 * would be a confident wrong answer.
 */
export const legBetween = (
  route: AccessibleRoute | undefined,
  fromRef: string | undefined,
  toRef: string | undefined,
): WalkingLeg | undefined =>
  route && fromRef && toRef
    ? route.legs.find((l) => l.from_ref === fromRef && l.to_ref === toRef)
    : undefined;

export function legSummary(leg: WalkingLeg): string {
  const distance =
    leg.distance_m >= 1000 ? `${(leg.distance_m / 1000).toFixed(1)} km` : `${leg.distance_m} m`;
  const parts = [`${leg.duration_min} min walk`, distance];
  if (leg.ascent_m >= 10) parts.push(`${leg.ascent_m} m climb`);
  return parts.join(" · ");
}
