/**
 * Does this chat message ask for something to happen later, on its own?
 *
 * A cheap, client-side guess that decides whether to ask the server for a
 * standing-task proposal (WatchService.ProposeWatch). It only decides whether
 * to *offer* the card: the message still goes to the normal chat, and nothing
 * is stored until the user presses Confirm. So a false positive costs one
 * card the user can dismiss, and a false negative costs nothing that exists
 * today — the rules lean towards precision.
 *
 * The server does the real reading of schedule and task
 * (loci-connect-server internal/domain/watch/parse.go).
 */

// "please", "can you", "could you" … in front of the request.
const LEAD = String.raw`^(?:(?:please|pls|can you|could you|would you|will you|hey loci|loci)[,\s]+)*`;

// Asking to be told later: unambiguous wherever it appears.
const NOTIFY =
  /\b(?:tell me (?:when|if|once|as soon as)|let me know (?:when|if|once|as soon as)|notify me|alert me|ping me|remind me|keep me (?:posted|updated|informed)|message me (?:when|if)|text me (?:when|if))\b/;

// "watch X" / "monitor X" as the request itself. Only at the start, so
// "where can I watch the sunset" and "what to watch out for" stay chat.
const WATCH_VERB = new RegExp(
  `${LEAD}(?:watch(?!\\s+out\\b)|monitor|track|keep an eye on|keep watch on|keep tabs on)\\b`,
);

const UNIT = String.raw`(?:minutes?|mins?|hours?|hrs?|days?|weeks?)`;
const DAY = String.raw`(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend)s?`;
const PART = String.raw`(?:morning|afternoon|evening|night)`;
const SCHEDULE_BODY = String.raw`(?:(?:every|each)\s+(?:${PART}|day|week|hour|${DAY}|\d{1,3}\s+${UNIT})|daily|hourly|weekly|once a (?:day|week))`;

// A schedule that opens the message is itself the request: "Every morning, …".
const SCHEDULE_FIRST = new RegExp(`${LEAD}${SCHEDULE_BODY}\\b`);
const SCHEDULE_ANYWHERE = new RegExp(`\\b${SCHEDULE_BODY}\\b`);

// A schedule mid-sentence only counts next to an instruction for the agent,
// so "restaurants open every day in Porto" stays a search.
const ACTION =
  /\b(?:check|send|tell|show|suggest|find|look|give|recommend|search|update|remind|ping|email|message)\b/;

export function looksLikeWatchRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (NOTIFY.test(t)) return true;
  if (WATCH_VERB.test(t)) return true;
  if (SCHEDULE_FIRST.test(t)) return true;
  return SCHEDULE_ANYWHERE.test(t) && ACTION.test(t);
}
