/**
 * The server stores the user turn as the prompt it assembled for the model,
 * not as what the user typed:
 *
 *   "Unified Chat Stream - Domain: itinerary, Message: Itinerary in Funchal."
 *
 * Anywhere that string is shown back to the user (chat history, recents) it
 * has to be unwrapped first. Anchored at both ends so a message that merely
 * mentions the wrapper is left alone.
 */
const PROMPT_WRAPPER = /^Unified Chat Stream - Domain:\s*\w+,\s*Message:\s*([\s\S]+)$/i;

export function stripPromptWrapper(s: string): string {
  const match = s.match(PROMPT_WRAPPER);
  return match ? match[1].trim() : s;
}
