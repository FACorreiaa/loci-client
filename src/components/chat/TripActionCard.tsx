import { For, Show, createSignal, type Component } from "solid-js";
import type {
  ActionProposal,
  ConversationMessage,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { mapTrip, type Trip } from "~/lib/api/trips";
import { Code, ConnectError } from "@connectrpc/connect";
import { tripActionApi, tripActionErrorMessage, type TripActionApi } from "~/lib/api/trip-actions";
import { ProactiveCaption } from "./ProactiveCaption";

export interface TripActionCardProps {
  proposal: ActionProposal;
  /** The trip's current version; undefined until the trip has loaded. */
  baseVersion: bigint | undefined;
  /** The trip changed since the suggestion: the page refetches it. */
  onConflict?: (tripId: string) => void;
  /** ApplyTripAction succeeded: the trip as it now is, and the thread's confirmation. */
  onApplied: (trip: Trip | undefined, confirmation?: ConversationMessage) => void;
  onDismissed: () => void;
  /** Injected in tests. */
  api?: TripActionApi;
}

const pill =
  "h-9 rounded-full px-4 text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A change the planner proposes to the trip this chat is about. Nothing
 * changes until Confirm (or a pick, for hotels); the server applies it once,
 * against the version the card was shown with.
 */
const TripActionCard: Component<TripActionCardProps> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const api = () => props.api ?? tripActionApi;
  const kind = () => props.proposal.action?.kind.case;
  const pickOne = () => kind() === "searchHotels";
  // Links come from the server, but only https ones ever become an href.
  const flightLinks = () => {
    const choice = props.proposal.options[0]?.choice;
    return choice?.case === "flight"
      ? choice.value.links.filter((l) => l.url.startsWith("https://"))
      : [];
  };
  /** Nothing can be applied until the trip's version is known. */
  const waiting = () => props.baseVersion === undefined;
  const canConfirm = () =>
    !pickOne() && (kind() !== "searchFlights" || props.proposal.options.length > 0);

  const apply = async (optionIndex?: number) => {
    const baseVersion = props.baseVersion;
    if (busy() || baseVersion === undefined) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api().apply(props.proposal.id, optionIndex, baseVersion);
      props.onApplied(res.trip ? mapTrip(res.trip) : undefined, res.confirmation);
    } catch (err) {
      setError(tripActionErrorMessage(err));
      // A stale trip: have the page refetch it, so the next card (or this
      // one, asked again) applies against the current version.
      if (
        err instanceof ConnectError &&
        err.code === Code.FailedPrecondition &&
        err.rawMessage.includes("version")
      ) {
        props.onConflict?.(props.proposal.tripId);
      }
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (busy()) return;
    setBusy(true);
    try {
      await api().dismiss(props.proposal.id);
    } catch {
      // Dismissing is a courtesy to the server; the card goes either way.
    }
    props.onDismissed();
  };

  return (
    <div class="flex justify-start" data-testid="trip-action">
      <div class="max-w-[94%] min-w-0 sm:max-w-[440px]">
        <ProactiveCaption label="Trip planner" />
        <section
          aria-label="Proposed trip change"
          class="rounded-2xl bg-[var(--muse-agent-bubble)] px-4 py-3 text-[var(--muse-text)]"
        >
          <p class="text-[15px] font-semibold leading-snug">{props.proposal.summary}</p>

          <Show when={pickOne() && props.proposal.options.length > 0}>
            <ul class="mt-2 space-y-1">
              <For each={props.proposal.options}>
                {(o, i) => (
                  <li>
                    <button
                      type="button"
                      data-testid="trip-action-option"
                      disabled={busy() || waiting()}
                      onClick={() => apply(i())}
                      class="w-full rounded-xl bg-[var(--muse-pill)] px-3 py-2 text-left text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span class="font-medium">{o.label}</span>
                      <Show when={o.detail}>
                        <span class="block text-[12px] text-[var(--muse-text-secondary)]">
                          {o.detail}
                        </span>
                      </Show>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <Show when={flightLinks().length > 0}>
            <div class="mt-2 flex flex-wrap gap-3">
              <For each={flightLinks()}>
                {(l) => (
                  <a
                    class="text-sm underline underline-offset-2"
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label}
                  </a>
                )}
              </For>
            </div>
          </Show>

          <Show when={error()}>
            <p
              role="alert"
              class="mt-2 text-[13px] text-destructive"
              data-testid="trip-action-error"
            >
              {error()}
            </p>
          </Show>

          <div class="mt-3 flex flex-wrap gap-2">
            <Show when={canConfirm()}>
              <button
                type="button"
                data-testid="trip-action-confirm"
                disabled={busy() || waiting()}
                onClick={() => apply(kind() === "searchFlights" ? 0 : undefined)}
                class={`${pill} bg-[var(--muse-user-bubble)] font-semibold text-[var(--muse-user-text)]`}
              >
                {waiting()
                  ? "Loading trip…"
                  : busy()
                    ? "Updating…"
                    : kind() === "searchFlights"
                      ? "Save to trip"
                      : "Confirm"}
              </button>
            </Show>
            <button
              type="button"
              data-testid="trip-action-dismiss"
              disabled={busy()}
              onClick={dismiss}
              class={`${pill} bg-[var(--muse-pill)] font-medium text-[var(--muse-text)]`}
            >
              Not now
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TripActionCard;
