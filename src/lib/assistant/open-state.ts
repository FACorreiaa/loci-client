import { createSignal } from "solid-js";

export type OpenedBy = "hold" | "keyboard";

// Module signals, set only from a gesture in the browser, so the server never
// sees anything but their empty start.
const [opened, setOpened] = createSignal<OpenedBy | null>(null);
const [handoff, setHandoff] = createSignal<string | null>(null);

/** How the overlay was opened, or null while it is shut. */
export const assistantOpenedBy = opened;
export const openAssistant = (by: OpenedBy) => setOpened(by);
export const closeAssistant = () => setOpened(null);

/** A question waiting for the planner. Read once, so a reload can't run it again. */
export const pendingHandoff = handoff;
export const sendToPlanner = (query: string, city?: string) => {
  // The tool asks for the person's own words, which may not name the city.
  const named = !city || query.toLowerCase().includes(city.toLowerCase());
  setHandoff(named ? query : `${query} in ${city}`);
};
export const clearHandoff = () => setHandoff(null);
