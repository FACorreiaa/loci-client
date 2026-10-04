import { createEffect, createSignal } from "solid-js";
import { ArrowBigDown, ArrowBigUp } from "lucide-solid";
import { applyVote, boardsErrorMessage, votePost, type Vote } from "~/lib/api/boards";
import { showToast } from "~/lib/toast-store";
import { cn } from "~/lib/utils";

/**
 * Up/down arrows with the score between them. The vote shows at once and
 * rolls back with a toast when the server refuses it (signed out, muted,
 * over the limit).
 */
export default function VoteControl(props: {
  postId: string;
  score: number;
  myVote: Vote;
  signedIn: boolean;
  class?: string;
}) {
  const [state, setState] = createSignal({ score: props.score, myVote: props.myVote });
  // A refetch brings the server's numbers back in.
  createEffect(() => setState({ score: props.score, myVote: props.myVote }));
  const [busy, setBusy] = createSignal(false);

  const press = async (dir: 1 | -1) => {
    if (!props.signedIn) {
      showToast({
        id: "boards-vote",
        title: "Sign in to vote.",
        action: { label: "Sign in", href: "/auth/signin" },
      });
      return;
    }
    if (busy()) return;
    const before = state();
    const next = applyVote(before, dir);
    setState(next);
    setBusy(true);
    try {
      const res = await votePost(props.postId, next.myVote);
      setState({ score: res.score, myVote: res.myVote });
    } catch (err) {
      setState(before);
      showToast({ id: "boards-vote", title: boardsErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const arrow = (dir: 1 | -1) =>
    cn(
      "rounded p-0.5 transition-colors hover:bg-accent disabled:opacity-50",
      state().myVote === dir ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div class={cn("flex w-9 shrink-0 flex-col items-center", props.class)}>
      <button
        type="button"
        class={arrow(1)}
        aria-label="Upvote"
        aria-pressed={state().myVote === 1}
        disabled={busy()}
        onClick={() => press(1)}
      >
        <ArrowBigUp class="h-5 w-5" fill={state().myVote === 1 ? "currentColor" : "none"} />
      </button>
      <span
        class={cn(
          "font-coord text-xs tabular-nums",
          state().myVote !== 0 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {state().score}
      </span>
      <button
        type="button"
        class={arrow(-1)}
        aria-label="Downvote"
        aria-pressed={state().myVote === -1}
        disabled={busy()}
        onClick={() => press(-1)}
      >
        <ArrowBigDown class="h-5 w-5" fill={state().myVote === -1 ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
