import { Show } from "solid-js";
import { Ban, MoreHorizontal, Trash2, VolumeX } from "lucide-solid";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/ui/dropdown-menu";
import { buttonVariants } from "~/ui/button";
import { cn } from "~/lib/utils";

/**
 * The ⋯ menu on a post or comment. Shows nothing at all when the viewer can
 * neither delete it nor moderate its author; the server re-checks both.
 */
export default function ModerationMenu(props: {
  canDelete: boolean;
  canModerate: boolean;
  onDelete: () => void;
  onSanction: (kind: "mute" | "ban") => void;
  label: string;
}) {
  return (
    <Show when={props.canDelete || props.canModerate}>
      <DropdownMenu placement="bottom-end">
        <DropdownMenuTrigger
          class={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground",
          )}
          aria-label={props.label}
        >
          <MoreHorizontal class="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48">
          <Show when={props.canDelete}>
            <DropdownMenuItem onSelect={props.onDelete} class="text-destructive">
              <Trash2 class="mr-2 h-4 w-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </Show>
          <Show when={props.canModerate}>
            <Show when={props.canDelete}>
              <DropdownMenuSeparator />
            </Show>
            <DropdownMenuItem onSelect={() => props.onSanction("mute")}>
              <VolumeX class="mr-2 h-4 w-4" aria-hidden="true" />
              Mute author
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onSanction("ban")} class="text-destructive">
              <Ban class="mr-2 h-4 w-4" aria-hidden="true" />
              Ban author
            </DropdownMenuItem>
          </Show>
        </DropdownMenuContent>
      </DropdownMenu>
    </Show>
  );
}
