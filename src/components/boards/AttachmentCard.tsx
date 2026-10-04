import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { A } from "@solidjs/router";
import { Building2, MapPin, Route } from "lucide-solid";
import { attachmentHref, type Attachment } from "~/lib/api/boards";
import { cn } from "~/lib/utils";

const KIND = {
  itinerary: { label: "Itinerary", icon: Route },
  poi: { label: "Place", icon: MapPin },
  city: { label: "City", icon: Building2 },
} as const;

/** A Loci item attached to a post, as it was when it was posted. */
export default function AttachmentCard(props: { attachment: Attachment; class?: string }) {
  const kind = () => KIND[props.attachment.kind];
  const href = () => attachmentHref(props.attachment);
  const body = () => (
    <>
      <Show
        when={props.attachment.imageUrl}
        fallback={
          <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Dynamic component={kind().icon} class="h-6 w-6" aria-hidden="true" />
          </span>
        }
      >
        <img
          src={props.attachment.imageUrl}
          alt=""
          loading="lazy"
          class="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      </Show>
      <span class="min-w-0">
        <span class="font-coord block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {kind().label}
          <Show when={props.attachment.city && props.attachment.kind !== "city"}>
            {" · "}
            {props.attachment.city}
          </Show>
        </span>
        <span class="block truncate font-medium">{props.attachment.title}</span>
        <Show when={props.attachment.subtitle}>
          <span class="line-clamp-2 text-sm text-muted-foreground">
            {props.attachment.subtitle}
          </span>
        </Show>
      </span>
    </>
  );
  const cls = () => cn("loci-card flex items-center gap-3 p-3", props.class);
  return (
    <Show when={href()} fallback={<div class={cls()}>{body()}</div>}>
      {(h) => (
        <A href={h()} class={cn(cls(), "loci-card-interactive")}>
          {body()}
        </A>
      )}
    </Show>
  );
}
