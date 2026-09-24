import { Component, Show, createSignal } from "solid-js";
import type { ConversationMessage } from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { watchApi, watchErrorMessage, type WatchApi, type WatchProposal } from "~/lib/api/watches";
import { ProactiveCaption } from "./ProactiveCaption";

export interface WatchProposalCardProps {
  proposal: WatchProposal;
  /** Thread the confirmation posts into. Unset until the stream has started one. */
  sessionId?: string;
  /** CreateWatch succeeded; the confirmation is already saved server-side. */
  onCreated: (confirmation?: ConversationMessage) => void;
  /** "Not now" — no call is made. */
  onDismiss: () => void;
  /** Injected in tests. */
  api?: WatchApi;
}

/**
 * Standing-task offer (apps/_reviews/muse-chat-contract.md "Standing-task
 * card"): agent-bubble fill, card radius 16, title, schedule in words, the
 * instruction the agent will run, Confirm / Not now. Nothing is stored until
 * Confirm.
 */
const WatchProposalCard: Component<WatchProposalCardProps> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const confirm = async () => {
    if (busy()) return;
    const sessionId = props.sessionId;
    if (!sessionId) {
      setError("I'm still starting this conversation. Try again in a moment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { confirmation } = await (props.api ?? watchApi).create(sessionId, props.proposal);
      props.onCreated(confirmation);
    } catch (err) {
      setError(watchErrorMessage(err, "create"));
      setBusy(false);
    }
  };

  return (
    <div class="flex justify-start" data-testid="watch-proposal">
      <div class="max-w-[94%] min-w-0 sm:max-w-[420px]">
        <ProactiveCaption label="Standing task" />
        <section
          aria-label="Standing task proposal"
          class="rounded-2xl bg-[var(--muse-agent-bubble)] px-4 py-3 text-[var(--muse-text)]"
        >
          <h3 class="text-[15px] font-semibold leading-snug" data-testid="watch-title">
            {props.proposal.title}
          </h3>
          <p
            class="mt-0.5 text-[13px] text-[var(--muse-text-secondary)]"
            data-testid="watch-schedule"
          >
            {props.proposal.scheduleHuman}
          </p>
          <Show when={props.proposal.spec}>
            <p class="mt-2 line-clamp-3 text-sm leading-normal" data-testid="watch-spec">
              {props.proposal.spec}
            </p>
          </Show>

          <Show when={error()}>
            <p role="alert" class="mt-2 text-[13px] text-destructive" data-testid="watch-error">
              {error()}
            </p>
          </Show>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={busy()}
              class="h-9 rounded-full bg-[var(--muse-user-bubble)] px-4 text-sm font-semibold text-[var(--muse-user-text)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {busy() ? "Setting up…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => props.onDismiss()}
              disabled={busy()}
              class="h-9 rounded-full bg-[var(--muse-pill)] px-4 text-sm font-medium text-[var(--muse-text)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Not now
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WatchProposalCard;
