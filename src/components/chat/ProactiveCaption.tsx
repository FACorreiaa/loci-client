import { Component } from "solid-js";

/**
 * The 11px uppercase line above a bubble the agent posted on its own
 * ("Standing task", "Briefing · 07:00"); apps/_reviews/muse-chat-contract.md
 * "Proactive messages". Replies carry no caption.
 */
export const ProactiveCaption: Component<{ label: string }> = (props) => (
  <p
    data-testid="proactive-caption"
    class="mb-1 px-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-[var(--muse-text-secondary)]"
  >
    {props.label}
  </p>
);

export default ProactiveCaption;
