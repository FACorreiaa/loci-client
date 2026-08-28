import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Clock3, Globe2, LogOut, Map as MapIcon, Settings, User } from "lucide-solid";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/ui/tooltip";
import { useAuth } from "~/contexts/AuthContext";

const RAIL = [
  { href: "/globe", label: "Global view", icon: Globe2 },
  { href: "/trips", label: "Trips", icon: MapIcon },
  { href: "/recents", label: "Recents", icon: Clock3 },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/**
 * Icon rail for the chromeless globe route, which renders no Nav.
 *
 * Every item carries both an aria-label and a visible tooltip: an icon-only
 * link with no accessible name is a straight axe failure, and the a11y bar
 * here is 1.0.
 */
export default function GlobeRail() {
  const auth = useAuth();

  const item =
    "inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground " +
    "transition-colors hover:bg-muted hover:text-foreground " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <nav
      aria-label="Global view"
      class="island-panel fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 rounded-2xl p-1.5 md:block"
    >
      <ul class="flex flex-col items-center gap-1">
        <For each={RAIL}>
          {(entry) => (
            <li>
              <Tooltip placement="right">
                <TooltipTrigger
                  as={A}
                  href={entry.href}
                  aria-label={entry.label}
                  class={item}
                  activeClass="bg-primary/15 text-foreground"
                  end
                >
                  <entry.icon class="h-5 w-5" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{entry.label}</TooltipContent>
              </Tooltip>
            </li>
          )}
        </For>

        {/* Separated so sign-out is not announced as part of the link list. */}
        <li aria-hidden="true" class="my-1 h-px w-6 bg-border" />

        <li>
          <Tooltip placement="right">
            <TooltipTrigger
              as="button"
              type="button"
              aria-label="Sign out"
              class={item}
              onClick={() => auth.logout?.()}
            >
              <LogOut class="h-5 w-5" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </li>
      </ul>
    </nav>
  );
}
