// Codecs between the profile proto's numeric enums and the lowercase strings the
// forms and the database both use.
//
// These are `enum` fields, not strings. The previous mapping did
// `profile.preferredTime ?? "DAY_PREFERENCE_ANY"`, but `??` only fires on null
// or undefined -- never on the enum value 0 -- so a raw number leaked through
// and was rendered as-is. In the other direction the forms wrote "any" and
// "moderate" straight into number-typed fields.
import {
  DayPreference,
  SearchPace,
  TransportPreference,
} from "@buf/loci_loci-proto.bufbuild_es/loci/profile/profile_pb.js";

const DAY_PREFERENCE: Record<number, string> = {
  [DayPreference.UNSPECIFIED]: "any",
  [DayPreference.ANY]: "any",
  [DayPreference.DAY]: "day",
  [DayPreference.NIGHT]: "night",
};

const SEARCH_PACE: Record<number, string> = {
  [SearchPace.UNSPECIFIED]: "any",
  [SearchPace.ANY]: "any",
  [SearchPace.RELAXED]: "relaxed",
  [SearchPace.MODERATE]: "moderate",
  [SearchPace.FAST]: "fast",
};

const TRANSPORT: Record<number, string> = {
  [TransportPreference.UNSPECIFIED]: "any",
  [TransportPreference.ANY]: "any",
  [TransportPreference.WALK]: "walk",
  [TransportPreference.PUBLIC]: "public",
  [TransportPreference.CAR]: "car",
};

// The numeric members of a proto enum, ascending. The runtime object also
// maps each number back to its name; those string values are skipped.
const members = <E extends number>(enumObject: Record<string, E | string>): E[] =>
  Object.values(enumObject)
    .filter((v): v is E => typeof v === "number")
    .sort((a, b) => a - b);

// Label -> enum member. Where two members share a label ("any") the lowest
// number wins, as it did when this walked Object.entries(table).
const invert = <E extends number>(
  table: Record<number, string>,
  values: readonly E[],
  fallback: E,
): Record<string, E> => {
  const out: Record<string, E> = {};
  for (const value of values) {
    const label = table[value];
    if (label !== undefined && out[label] === undefined) out[label] = value;
  }
  out[""] = fallback;
  return out;
};

const DAY_PREFERENCE_BY_LABEL = invert(DAY_PREFERENCE, members(DayPreference), DayPreference.ANY);
const SEARCH_PACE_BY_LABEL = invert(SEARCH_PACE, members(SearchPace), SearchPace.ANY);
const TRANSPORT_BY_LABEL = invert(TRANSPORT, members(TransportPreference), TransportPreference.ANY);

export const dayPreferenceToLabel = (value: number | undefined): string =>
  DAY_PREFERENCE[value ?? DayPreference.ANY] ?? "any";

export const searchPaceToLabel = (value: number | undefined): string =>
  SEARCH_PACE[value ?? SearchPace.ANY] ?? "any";

export const transportToLabel = (value: number | undefined): string =>
  TRANSPORT[value ?? TransportPreference.ANY] ?? "any";

export const labelToDayPreference = (label: string | undefined): DayPreference =>
  DAY_PREFERENCE_BY_LABEL[label ?? ""] ?? DayPreference.ANY;

export const labelToSearchPace = (label: string | undefined): SearchPace =>
  SEARCH_PACE_BY_LABEL[label ?? ""] ?? SearchPace.ANY;

export const labelToTransport = (label: string | undefined): TransportPreference =>
  TRANSPORT_BY_LABEL[label ?? ""] ?? TransportPreference.ANY;

// protobuf-es v2 Timestamps are plain { seconds, nanos } messages -- there is no
// .toDate(). Every profile timestamp came back as "" because of that.
export const timestampToISO = (ts: { seconds?: bigint | number } | undefined): string =>
  ts?.seconds === undefined ? "" : new Date(Number(ts.seconds) * 1000).toISOString();
