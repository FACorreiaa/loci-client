import type { PlaceFactField } from "~/lib/api/place-intelligence";

/**
 * The canonical vocabulary a field report can be written in.
 *
 * Corroboration on the server is an exact string match across two distinct
 * scouts. Free prose therefore never corroborates: "9am-5pm" and "09:00–17:00"
 * are the same fact told two ways, and the server sees two unrelated claims. So
 * every answer is a token from a fixed list, normalised to one spelling before
 * it is sent.
 *
 * This table is mirrored in Go at
 * loci-connect-server/internal/domain/placeintel/values.go. The two must change
 * together — a token that exists on only one side is either a question nobody
 * can answer or an answer the server rejects after the scout has given it.
 */

export type FieldKind = "single" | "multi" | "structured";

export interface FieldOption {
  /** The wire value. Stable; renaming one invalidates stored history. */
  token: string;
  /** What the scout reads. Free to change. */
  label: string;
}

export interface FieldVocabulary {
  kind: FieldKind;
  question: string;
  options: FieldOption[];
  /** Cap on selections for a multi-select field. */
  maxSelections?: number;
}

/**
 * "none" means "I checked, and none of these apply", so it cannot sit beside
 * the things it denies. The server rejects that combination too.
 */
export const EXCLUSIVE_TOKEN = "none";

export const PLACE_FACT_VOCABULARY: Record<PlaceFactField, FieldVocabulary> = {
  PLACE_FACT_FIELD_OPENING_HOURS: {
    kind: "structured",
    question: "When is it open?",
    options: [],
  },
  PLACE_FACT_FIELD_PRICE_LEVEL: {
    kind: "single",
    question: "What does a typical visit cost?",
    options: [
      { token: "budget", label: "€ Budget" },
      { token: "moderate", label: "€€ Moderate" },
      { token: "pricey", label: "€€€ Pricey" },
      { token: "splurge", label: "€€€€ Splurge" },
    ],
  },
  PLACE_FACT_FIELD_ACCESSIBILITY: {
    kind: "multi",
    question: "What did you see that helps with access?",
    options: [
      { token: "step_free", label: "Step-free entrance" },
      { token: "accessible_wc", label: "Accessible toilet" },
      { token: "lift", label: "Lift" },
      { token: "wide_doors", label: "Wide doorways" },
      { token: "tactile", label: "Tactile guidance" },
      { token: EXCLUSIVE_TOKEN, label: "None of these" },
    ],
  },
  PLACE_FACT_FIELD_DIETARY: {
    kind: "multi",
    question: "Which diets are properly catered for?",
    options: [
      { token: "vegetarian", label: "Vegetarian" },
      { token: "vegan", label: "Vegan" },
      { token: "gluten_free", label: "Gluten free" },
      { token: "halal", label: "Halal" },
      { token: "kosher", label: "Kosher" },
      { token: EXCLUSIVE_TOKEN, label: "None of these" },
    ],
  },
  PLACE_FACT_FIELD_CROWD_LEVEL: {
    kind: "single",
    question: "How busy was it?",
    options: [
      { token: "quiet", label: "Quiet" },
      { token: "moderate", label: "Moderate" },
      { token: "busy", label: "Busy" },
      { token: "packed", label: "Packed" },
    ],
  },
  PLACE_FACT_FIELD_NOISE_LEVEL: {
    kind: "single",
    question: "How loud was it?",
    options: [
      { token: "quiet", label: "You can whisper" },
      { token: "conversational", label: "Normal talk" },
      { token: "lively", label: "Raise your voice" },
      { token: "loud", label: "Can't hear" },
    ],
  },
  PLACE_FACT_FIELD_CHILD_FRIENDLY: {
    kind: "single",
    question: "Would you bring children?",
    options: [
      { token: "yes", label: "Yes" },
      { token: "limited", label: "Some limits" },
      { token: "no", label: "Not really" },
    ],
  },
  PLACE_FACT_FIELD_DOG_FRIENDLY: {
    kind: "single",
    question: "Are dogs welcome?",
    options: [
      { token: "yes", label: "Yes, inside" },
      { token: "outdoor_only", label: "Outdoor seating only" },
      { token: "no", label: "No dogs" },
    ],
  },
  PLACE_FACT_FIELD_VIBE: {
    kind: "multi",
    // Capped low on purpose. Corroboration needs two scouts to pick the *same
    // set*, and the number of possible sets grows fast: three picks from eight
    // tags is 92 possible answers, two is 36. A tighter cap is the difference
    // between a field that can verify and one that never does.
    maxSelections: 2,
    question: "How did it feel? Pick up to two.",
    options: [
      { token: "cosy", label: "Cosy" },
      { token: "lively", label: "Lively" },
      { token: "romantic", label: "Romantic" },
      { token: "touristy", label: "Touristy" },
      { token: "local", label: "Local" },
      { token: "quiet", label: "Quiet" },
      { token: "work_friendly", label: "Good for working" },
      { token: "outdoorsy", label: "Outdoorsy" },
    ],
  },
};

/** The fields a scout can be asked about, in the order they are offered. */
export const CONTRIBUTABLE_FIELDS: PlaceFactField[] = [
  "PLACE_FACT_FIELD_OPENING_HOURS",
  "PLACE_FACT_FIELD_PRICE_LEVEL",
  "PLACE_FACT_FIELD_ACCESSIBILITY",
  "PLACE_FACT_FIELD_DIETARY",
  "PLACE_FACT_FIELD_CROWD_LEVEL",
  "PLACE_FACT_FIELD_NOISE_LEVEL",
  "PLACE_FACT_FIELD_CHILD_FRIENDLY",
  "PLACE_FACT_FIELD_DOG_FRIENDLY",
  "PLACE_FACT_FIELD_VIBE",
];

export const vocabularyFor = (field: PlaceFactField): FieldVocabulary =>
  PLACE_FACT_VOCABULARY[field];

export const fieldQuestion = (field: PlaceFactField): string =>
  PLACE_FACT_VOCABULARY[field]?.question ?? "What is true right now?";

/** Short human label for a field, used in task cards and summaries. */
export const fieldLabel = (field: PlaceFactField): string =>
  field
    .replace("PLACE_FACT_FIELD_", "")
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/**
 * The one spelling a set of tokens is sent as.
 *
 * De-duplicated and sorted, so two scouts who pick the same things in a
 * different order produce a byte-identical string and their claims can find
 * each other. Must match `normalizeValue` in the Go mirror exactly.
 */
export const serializeTokens = (tokens: string[]): string =>
  Array.from(new Set(tokens.map((token) => token.trim().toLowerCase())))
    .filter((token) => token !== "")
    .sort()
    .join(",");
