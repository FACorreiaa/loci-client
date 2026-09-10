import type { DomainType } from "~/lib/api/types";
import { getCompletionMessage } from "~/lib/chat/completion-message";

/**
 * Turns whatever the server stored for an assistant turn into something a
 * chat bubble can show. Lives apart from ChatMessage.tsx so it can be unit
 * tested without a DOM.
 *
 * Old sessions hold the raw stream payloads, tagged and concatenated in the
 * order the sections finished:
 *
 *   [city_data]\n{...}\n\n[general_pois]\n{...}\n\n[itinerary]\n{...}
 *
 * The server is being fixed to persist prose, but the client must never render
 * JSON regardless: every branch below ends in a sentence or in the original
 * prose, never in a brace.
 */

/** Which section to summarise first when a blob has several. */
const SECTION_ORDER = [
  "itinerary",
  "general_pois",
  "personalized_pois",
  "pois",
  "city_data",
  "hotels",
  "restaurants",
  "activities",
];

/**
 * A `[tag]` at the start of a line, followed by JSON, a fence, or a line end.
 * The lookahead is what keeps a markdown link like `[Book here](url)` from
 * reading as a tag.
 */
const TAG_AT_LINE_START = /^\[([a-z_]+)\][ \t]*(?=\r?\n|[{[`]|$)/gim;
const STARTS_WITH_TAG = /^\[[a-z_]+\][ \t]*(?:\r?\n|[{[`]|$)/i;

/** Something that could plausibly be a JSON document, as opposed to a
 *  footnote ("[1]") or a markdown link ("[text](url)"). */
const LOOKS_LIKE_JSON = /^\{|^\[\s*[{["\]]/;

const stripFence = (s: string) =>
  s
    .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1")
    .replace(/```json\s*(.*?)\s*```/s, "$1")
    .trim();

const cityFromContent = (s: string): string => {
  const match = s.match(/"city(?:_name)?"\s*:\s*"([^"]*)"/i);
  return match?.[1]?.trim() ?? "";
};

const domainFromTags = (tags: Iterable<string>): DomainType => {
  for (const tag of tags) {
    switch (tag.toLowerCase()) {
      case "hotels":
        return "accommodation";
      case "restaurants":
        return "dining";
      case "activities":
        return "activities";
    }
  }
  return "general";
};

/** Split a tagged blob into `tag -> body`. The first occurrence of a tag wins. */
const splitSections = (content: string): Map<string, string> => {
  const sections = new Map<string, string>();
  const matches = [...content.matchAll(TAG_AT_LINE_START)];
  matches.forEach((match, i) => {
    const tag = match[1].toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length;
    if (!sections.has(tag)) sections.set(tag, content.slice(start, end).trim());
  });
  return sections;
};

/**
 * One JSON payload to one sentence. Returns null when the payload does not
 * parse or has no shape we know how to describe, so a caller with several
 * sections can try the next one.
 */
const formatPayload = (cleaned: string): string | null => {
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  if (parsed.city && parsed.country) {
    const details = [];
    if (parsed.description) details.push(parsed.description);
    if (parsed.population) details.push(`Population: ${parsed.population}`);
    if (parsed.weather) details.push(`Weather: ${parsed.weather}`);
    let result = `Let me tell you about ${parsed.city}, ${parsed.country}!`;
    if (details.length) result += ` ${details.join(". ")}.`;
    return result;
  }
  if (Array.isArray(parsed)) {
    const first = parsed[0];
    if (parsed.length > 0 && first?.name && first?.category) {
      const type = first.cuisine_type ? "restaurants" : first.poi_type ? "attractions" : "places";
      return `I found ${parsed.length} great ${type} for you! Including ${first.name} and ${parsed.length - 1} more options.`;
    }
    return null;
  }
  if (Array.isArray(parsed.points_of_interest) && parsed.points_of_interest.length > 0) {
    const count = parsed.points_of_interest.length;
    const first = parsed.points_of_interest[0]?.name || "some amazing places";
    return `I created a personalized itinerary with ${count} places to visit, including ${first} and more!`;
  }
  if (parsed.general_city_data?.city) {
    const c = parsed.general_city_data;
    return `I found information about ${c.city}, ${c.country}. ${c.description || "Let me share the details with you!"}`;
  }
  return null;
};

export const formatMessageContent = (content: string): string => {
  const trimmed = content.trim();

  // Tagged: one or more `[section]` blocks.
  if (STARTS_WITH_TAG.test(trimmed)) {
    const sections = splitSections(trimmed);
    const ordered = [
      ...SECTION_ORDER.filter((tag) => sections.has(tag)),
      ...[...sections.keys()].filter((tag) => !SECTION_ORDER.includes(tag)),
    ];

    const bodies = ordered.map((tag) => stripFence(sections.get(tag) ?? "")).filter(Boolean);

    for (const body of bodies) {
      const sentence = formatPayload(body);
      if (sentence) return sentence;
    }

    // A tag over prose (the shape the fixed server sends): show the prose,
    // minus the tag. Only when every section is prose — a broken JSON section
    // next to a prose one still gets the sentence below.
    if (bodies.length > 0 && bodies.every((body) => !LOOKS_LIKE_JSON.test(body))) {
      return bodies.join("\n\n");
    }

    return getCompletionMessage(domainFromTags(sections.keys()), cityFromContent(trimmed));
  }

  // Untagged: either JSON (possibly fenced) or ordinary prose / markdown.
  const cleaned = stripFence(trimmed);
  if (!LOOKS_LIKE_JSON.test(cleaned)) return content;
  return formatPayload(cleaned) ?? getCompletionMessage("general", cityFromContent(cleaned));
};
