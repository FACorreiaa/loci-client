import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Code, ConnectError } from "@connectrpc/connect";
import { ThumbsDown, ThumbsUp } from "lucide-solid";
import { Button } from "~/ui/button";
import UserAvatar from "~/components/social/UserAvatar";
import {
  applyErrorMessage,
  useApplyProposal,
  useDismissProposal,
  useReactToProposal,
  type ProposalReaction,
  type TripProposal,
} from "~/lib/api/trip-proposals";

export interface TripProposalsProps {
  tripId: string;
  proposals: TripProposal[];
  isOwner: boolean;
  /** The owner, or a co-planner the owner lets apply. */
  mayApply: boolean;
  currentUserId?: string;
  /** The trip's version as the owner sees it; undefined until loaded. */
  baseVersion: bigint | undefined;
  /** The owner's copy of the trip is stale: the page refetches it. */
  onConflict: () => void;
}

/**
 * The trip's open suggestions. Everyone on the trip sees them and reacts;
 * the owner applies or turns them down (a co-planner applies too when the
 * owner lets them); whoever suggested one can take it back.
 */
export default function TripProposals(props: TripProposalsProps) {
  return (
    <section class="loci-card no-print mb-6 p-4" aria-labelledby="trip-proposals-title">
      <h2
        id="trip-proposals-title"
        class="font-coord mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
      >
        Suggestions · {props.proposals.length}
      </h2>
      <ul class="space-y-3">
        <For each={props.proposals}>{(p) => <ProposalRow {...props} proposal={p} />}</For>
      </ul>
    </section>
  );
}

function ProposalRow(props: TripProposalsProps & { proposal: TripProposal }) {
  const react = useReactToProposal();
  const apply = useApplyProposal();
  const dismiss = useDismissProposal();
  const [error, setError] = createSignal<string | null>(null);

  const p = () => props.proposal;
  const mine = () => !!props.currentUserId && p().proposer?.id === props.currentUserId;
  const who = () =>
    p().source === "chat"
      ? "From the trip planner"
      : `${p().proposer?.displayName ?? "Someone"} suggests`;
  const busy = () => react.isPending || apply.isPending || dismiss.isPending;

  const setReaction = (value: ProposalReaction) =>
    react.mutate({
      tripId: props.tripId,
      proposalId: p().id,
      value: p().myReaction === value ? 0 : value,
    });

  const doApply = () => {
    const baseVersion = props.baseVersion;
    if (baseVersion === undefined) return;
    setError(null);
    apply.mutate(
      { tripId: props.tripId, proposalId: p().id, baseVersion },
      {
        onError: (err) => {
          setError(applyErrorMessage(err));
          if (
            err instanceof ConnectError &&
            err.code === Code.FailedPrecondition &&
            err.rawMessage.includes("version")
          ) {
            props.onConflict();
          }
        },
      },
    );
  };

  const doDismiss = () =>
    dismiss.mutate(
      { tripId: props.tripId, proposalId: p().id },
      { onError: () => setError("Couldn't turn this down. Try again.") },
    );

  const reactionClass = (on: boolean) =>
    `inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
      on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
    }`;

  return (
    <li class="rounded-xl border border-border p-3" data-testid="trip-proposal">
      <div class="flex items-start gap-3">
        <Show when={p().source === "editor" && p().proposer}>
          {(u) => <UserAvatar user={u()} size="sm" />}
        </Show>
        <div class="min-w-0 flex-1">
          <p class="text-xs text-muted-foreground">{who()}</p>
          <p class="text-sm font-medium leading-snug">{p().summary}</p>
        </div>
      </div>

      <Show when={error()}>
        <p role="alert" class="mt-2 text-[13px] text-destructive">
          {error()}
        </p>
      </Show>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class={reactionClass(p().myReaction === 1)}
          aria-pressed={p().myReaction === 1}
          aria-label={`Thumbs up, ${p().upVotes}`}
          disabled={busy()}
          onClick={() => setReaction(1)}
        >
          <ThumbsUp class="h-3.5 w-3.5" aria-hidden="true" />
          {p().upVotes}
        </button>
        <button
          type="button"
          class={reactionClass(p().myReaction === -1)}
          aria-pressed={p().myReaction === -1}
          aria-label={`Thumbs down, ${p().downVotes}`}
          disabled={busy()}
          onClick={() => setReaction(-1)}
        >
          <ThumbsDown class="h-3.5 w-3.5" aria-hidden="true" />
          {p().downVotes}
        </button>

        <div class="ml-auto flex flex-wrap gap-2">
          <Show when={props.mayApply}>
            <Show
              when={!p().needsPick}
              fallback={
                <Button as={A} href="/chat" size="sm" variant="outline">
                  Pick in chat
                </Button>
              }
            >
              <Button
                size="sm"
                disabled={busy() || props.baseVersion === undefined}
                onClick={doApply}
              >
                {apply.isPending ? "Applying…" : "Apply"}
              </Button>
            </Show>
          </Show>
          <Show when={props.isOwner || mine()}>
            <Button size="sm" variant="ghost" disabled={busy()} onClick={doDismiss}>
              {props.isOwner && !mine() ? "Not now" : "Take back"}
            </Button>
          </Show>
        </div>
      </div>
    </li>
  );
}
