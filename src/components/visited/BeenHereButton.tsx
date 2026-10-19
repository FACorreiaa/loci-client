import { Show, createSignal } from "solid-js";
import { Check, Footprints } from "lucide-solid";
import { useAuth } from "~/contexts/AuthContext";
import {
  buildManualVisit,
  useRecordManualVisit,
  type ManualVisitPlace,
} from "~/lib/api/travel-history";

/**
 * "I've been here": adds the place to the traveller's places-I've-been and
 * teaches their taste profile. Hidden when signed out, or when the place has
 * no city or coordinates to record it against.
 */
export default function BeenHereButton(props: {
  place: ManualVisitPlace;
  /** Called once the visit is recorded, e.g. to ask how it was. */
  onRecorded?: () => void;
}) {
  const auth = useAuth();
  const record = useRecordManualVisit();
  const [done, setDone] = createSignal(false);

  const onClick = async () => {
    if (done() || record.isPending) return;
    try {
      await record.mutateAsync(props.place);
      setDone(true);
      props.onRecorded?.();
    } catch {
      // The mutation's error state renders below; the button stays usable.
    }
  };

  return (
    <Show when={auth.isAuthenticated() && buildManualVisit(props.place)}>
      <button
        type="button"
        onClick={onClick}
        disabled={record.isPending}
        aria-pressed={done()}
        title={record.isError ? "Couldn't save that — try again" : "Add to the places you've been"}
        class="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition-colors"
        classList={{
          "bg-accent/10 border-accent/40 text-accent": done(),
          "text-foreground hover:bg-muted": !done(),
          "opacity-60": record.isPending,
        }}
      >
        <Show when={done()} fallback={<Footprints class="h-3.5 w-3.5" />}>
          <Check class="h-3.5 w-3.5" />
        </Show>
        {done() ? "Been here" : "I've been here"}
      </button>
    </Show>
  );
}
