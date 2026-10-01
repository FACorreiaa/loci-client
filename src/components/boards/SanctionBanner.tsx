import { Show } from "solid-js";
import { VolumeX } from "lucide-solid";
import type { Sanction } from "~/lib/api/boards";

const until = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Tells a muted or banned reader why they can't post, and until when. */
export default function SanctionBanner(props: { sanction?: Sanction }) {
  return (
    <Show when={props.sanction}>
      {(s) => (
        <div
          role="status"
          class="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          <VolumeX class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>
            You're {s().kind === "ban" ? "banned" : "muted"} from boards
            {s().expiresAt ? ` until ${until(s().expiresAt)}` : ""}. You can still read, but you
            can't post, comment or vote.
          </p>
        </div>
      )}
    </Show>
  );
}
