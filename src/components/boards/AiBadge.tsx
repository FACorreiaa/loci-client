import { Bot } from "lucide-solid";
import { cn } from "~/lib/utils";

/** Marks a post the server wrote with a model rather than a person. */
export default function AiBadge(props: { class?: string }) {
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary/40 px-1.5 py-0.5 text-[10px] font-normal text-primary",
        props.class,
      )}
    >
      <Bot class="h-3 w-3" aria-hidden="true" />
      AI generated
    </span>
  );
}
