import { createSignal, Show, type Component } from "solid-js";
import { PlaceActionKind } from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import TripActionCard from "~/components/chat/TripActionCard";
import type { AssistantApi } from "~/lib/api/assistant";
import { queryKeys } from "~/lib/api/shared";
import { tripKeys } from "~/lib/api/trips";
import { tripActionErrorMessage, type TripActionApi } from "~/lib/api/trip-actions";
import type { Card } from "~/lib/assistant/turns";
import queryClient from "~/lib/query-client";

export type TripCardData = Extract<Card, { kind: "trip" }>;
export type PlaceCardData = Extract<Card, { kind: "place" }>;
export type HandoffCardData = Extract<Card, { kind: "handoff" }>;

const pill =
  "h-9 rounded-full px-4 text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primary = `${pill} bg-[var(--muse-user-bubble)] font-semibold text-[var(--muse-user-text)]`;
const secondary = `${pill} bg-[var(--muse-pill)] font-medium text-[var(--muse-text)]`;
// The same width as TripActionCard, as they sit in one column.
const surface =
  "max-w-[94%] rounded-2xl bg-[var(--muse-agent-bubble)] px-4 py-3 text-[var(--muse-text)] sm:max-w-[440px]";

/**
 * The planner's own trip card, answered through the assistant. The server checks
 * the trip's version when the card is confirmed, so it needs none from here.
 */
export const AssistantTripCard: Component<{
  card: TripCardData;
  api: AssistantApi;
  onSettled: (note?: string) => void;
}> = (props) => {
  let confirmation: string | undefined;
  const adapter: TripActionApi = {
    apply: async (id, option) => {
      const res = await props.api.confirm(id, option);
      confirmation = res.confirmation;
      return { trip: res.trip };
    },
    dismiss: (id) => props.api.dismiss(id),
  };
  const refresh = () => {
    const tripId = props.card.proposal.tripId;
    void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
    void queryClient.invalidateQueries({ queryKey: tripKeys.list() });
  };
  return (
    <TripActionCard
      proposal={props.card.proposal}
      baseVersion={0n}
      suggestion={props.card.awaitsOwner}
      api={adapter}
      onConflict={refresh}
      onApplied={() => {
        refresh();
        props.onSettled(confirmation ?? "Done.");
      }}
      onDismissed={() => props.onSettled()}
    />
  );
};

/** Saving a place. Nothing is saved until Confirm. */
export const AssistantPlaceCard: Component<{
  card: PlaceCardData;
  api: AssistantApi;
  onSettled: (note?: string) => void;
}> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const refresh = () => {
    if (props.card.place.kind === PlaceActionKind.ADD_TO_LIST) {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      if (props.card.place.listId) {
        void queryClient.invalidateQueries({ queryKey: ["list", props.card.place.listId] });
      }
    } else {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favoritesRoot });
    }
  };

  const confirm = async () => {
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await props.api.confirm(props.card.id);
      refresh();
      props.onSettled(res.confirmation);
    } catch (err) {
      setError(tripActionErrorMessage(err));
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (busy()) return;
    setBusy(true);
    try {
      await props.api.dismiss(props.card.id);
    } catch {
      // Dismissing is a courtesy to the server; the card goes either way.
    }
    props.onSettled();
  };

  return (
    <section aria-label="Proposed save" class={surface} data-testid="assistant-place">
      <p class="text-[15px] font-semibold leading-snug">{props.card.place.summary}</p>
      <Show when={error()}>
        <p role="alert" class="mt-2 text-[13px] text-destructive">
          {error()}
        </p>
      </Show>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class={primary}
          disabled={busy()}
          onClick={confirm}
          data-testid="assistant-place-confirm"
        >
          {busy() ? "Saving…" : "Confirm"}
        </button>
        <button
          type="button"
          class={secondary}
          disabled={busy()}
          onClick={dismiss}
          data-testid="assistant-place-dismiss"
        >
          Not now
        </button>
      </div>
    </section>
  );
};

/** An offer to plan in the full planner. Nothing has started until the tap. */
export const AssistantHandoffCard: Component<{
  card: HandoffCardData;
  onStart: () => void;
  onDismiss: () => void;
}> = (props) => (
  <section aria-label="Plan this in the planner" class={surface} data-testid="assistant-handoff">
    <p class="text-[15px] font-semibold leading-snug">{props.card.query}</p>
    <p class="mt-1 text-[13px] text-[var(--muse-text-secondary)]">
      The planner can build this for you.
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        class={primary}
        onClick={() => props.onStart()}
        data-testid="assistant-handoff-start"
      >
        Start planning
      </button>
      <button type="button" class={secondary} onClick={() => props.onDismiss()}>
        Not now
      </button>
    </div>
  </section>
);
