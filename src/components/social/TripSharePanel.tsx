import { createEffect, createSignal, For, Show } from "solid-js";
import { Check, Copy, Globe2, Link as LinkIcon, Lock, Users } from "lucide-solid";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/ui/dialog";
import { Button } from "~/ui/button";
import { useSetTripVisibility, type TripVisibility } from "~/lib/api/trips";
import { copyShareLink } from "~/lib/api/share";
import { hasShareLink, sharedTripUrl, VISIBILITY_OPTIONS } from "~/lib/social/visibility";
import { capture } from "~/lib/analytics";
import { cn } from "~/lib/utils";

const ICONS: Record<TripVisibility, typeof Lock> = {
  private: Lock,
  friends: Users,
  link: LinkIcon,
  public: Globe2,
};

/**
 * Who may open a trip, and its link. Replaces the old one-tap "make public":
 * sharing is now a choice between four levels, and private is always one
 * click away.
 */
export default function TripSharePanel(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  visibility?: TripVisibility;
  shareCode?: string;
}) {
  const setVisibility = useSetTripVisibility();
  const [level, setLevel] = createSignal<TripVisibility>(props.visibility ?? "private");
  const [code, setCode] = createSignal(props.shareCode ?? "");
  const [copied, setCopied] = createSignal(false);

  createEffect(() => {
    setLevel(props.visibility ?? "private");
    setCode(props.shareCode ?? "");
  });

  const choose = (v: TripVisibility) => {
    if (v === level() || setVisibility.isPending) return;
    const previous = level();
    setLevel(v);
    setVisibility.mutate(
      { tripId: props.tripId, visibility: v },
      {
        onSuccess: (r) => {
          setCode(r.shareCode);
          if (v !== "private") capture("share_link_created", { content_type: "trip" });
        },
        onError: () => setLevel(previous),
      },
    );
  };

  const url = () => (code() ? sharedTripUrl(code()) : "");

  const copy = async () => {
    if (url() && (await copyShareLink(url()))) {
      capture("share_link_copied", { content_type: "trip" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Share this trip</DialogTitle>
          <DialogDescription>
            Friends and link viewers get a read-only copy. Notes and booking links stay yours.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Who can see this trip" class="grid gap-2">
          <For each={VISIBILITY_OPTIONS}>
            {(o) => {
              const Icon = ICONS[o.value];
              const selected = () => level() === o.value;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected()}
                  disabled={setVisibility.isPending}
                  onClick={() => choose(o.value)}
                  class={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    selected() ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <Icon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium">{o.label}</span>
                    <span class="block text-xs text-muted-foreground">{o.description}</span>
                  </span>
                  <Show when={selected()}>
                    <Check class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  </Show>
                </button>
              );
            }}
          </For>
        </div>

        <Show when={setVisibility.isError}>
          <p class="text-sm text-destructive" role="alert">
            Couldn't change who can see this trip. Try again.
          </p>
        </Show>

        <Show when={hasShareLink(level()) && url()}>
          <div class="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
            <input
              readOnly
              value={url()}
              aria-label="Trip link"
              class="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" variant="secondary" class="gap-1.5" onClick={() => void copy()}>
              <Copy class="h-3.5 w-3.5" aria-hidden="true" />
              {copied() ? "Copied" : "Copy link"}
            </Button>
          </div>
        </Show>
      </DialogContent>
    </Dialog>
  );
}
