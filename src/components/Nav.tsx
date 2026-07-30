import { A, useLocation } from "@solidjs/router";
import {
  Bookmark,
  ChevronDown,
  Clock3,
  Compass,
  Heart,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  GitCompare,
  Settings,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useAuth } from "~/contexts/AuthContext";
import ThemeSelector from "~/components/ThemeSelector";
import { Button } from "~/ui/button";
import { handleLinkPreload } from "~/lib/preload";

const publicItems = [
  { name: "How it works", href: "/features" },
  { name: "About", href: "/about" },
  { name: "MCP", href: "/mcp" },
  { name: "Pricing", href: "/pricing" },
];

const journeyItems = [
  { name: "Discover", href: "/discover", icon: Compass },
  { name: "Compare", href: "/compare", icon: GitCompare },
  { name: "Nearby", href: "/nearme", icon: MapPin },
  { name: "Trips", href: "/trips", icon: Map },
  { name: "Ask Loci", href: "/chat", icon: MessageCircle },
];

const accountItems = [
  { name: "Contribute", href: "/contribute", icon: Users },
  { name: "Favorites", href: "/favorites", icon: Heart },
  { name: "Bookmarks", href: "/bookmarks", icon: Bookmark },
  { name: "Recents", href: "/recents", icon: Clock3 },
  { name: "Travel profiles", href: "/profiles", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Nav() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = createSignal(false);
  const [accountOpen, setAccountOpen] = createSignal(false);

  const initials = () =>
    (user()?.display_name || user()?.username || user()?.email || "Traveler")
      .slice(0, 1)
      .toUpperCase();

  return (
    <>
      <nav class="sticky top-0 z-50 island-nav">
        <div class="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <A href="/" class="group flex shrink-0 items-center gap-3" aria-label="Loci home">
            <span class="relative grid h-9 w-9 place-items-center rounded-full border border-primary bg-primary text-primary-foreground">
              <MapPin class="h-4 w-4" />
              <span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
            </span>
            <span>
              <span class="block font-serif text-xl font-semibold leading-none tracking-tight">
                Loci
              </span>
              <span class="font-coord hidden text-[9px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
                Field guide
              </span>
            </span>
          </A>

          <Show when={!isLoading()}>
            <div class="hidden flex-1 items-center justify-center gap-1 md:flex">
              <For each={isAuthenticated() ? journeyItems : publicItems}>
                {(item) => {
                  const Icon = "icon" in item ? (item.icon as typeof Compass) : undefined;
                  return (
                    <A
                      href={item.href}
                      onMouseEnter={() => handleLinkPreload(item.href)}
                      class="jb-tab flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                      activeClass="jb-tab-active"
                    >
                      <Show when={Icon}>
                        <Dynamic component={Icon} class="h-4 w-4" />
                      </Show>
                      {item.name}
                    </A>
                  );
                }}
              </For>
            </div>

            <div class="ml-auto hidden items-center gap-2 md:flex">
              <ThemeSelector />
              <Show
                when={isAuthenticated()}
                fallback={
                  <>
                    <A href="/auth/signin" class="px-3 py-2 text-sm font-semibold text-foreground">
                      Sign in
                    </A>
                    <A href="/auth/signup">
                      <Button class="gap-2 rounded-lg">
                        <Sparkles class="h-4 w-4" />
                        Start exploring
                      </Button>
                    </A>
                  </>
                }
              >
                <div class="relative">
                  <button
                    type="button"
                    onClick={() => setAccountOpen(!accountOpen())}
                    class="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-semibold hover:border-accent"
                    aria-expanded={accountOpen()}
                  >
                    <span class="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs text-secondary-foreground">
                      {initials()}
                    </span>
                    <span class="max-w-28 truncate">
                      {user()?.display_name || user()?.username || "Traveler"}
                    </span>
                    <ChevronDown class="h-4 w-4 text-muted-foreground" />
                  </button>
                  <Show when={accountOpen()}>
                    <div class="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-popover p-2 shadow-xl">
                      <p class="px-3 pb-2 pt-1 font-coord text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Your field kit
                      </p>
                      <For each={accountItems}>
                        {(item) => (
                          <A
                            href={item.href}
                            onClick={() => setAccountOpen(false)}
                            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Dynamic component={item.icon} class="h-4 w-4" />
                            {item.name}
                          </A>
                        )}
                      </For>
                      <div class="my-2 border-t border-border" />
                      <button
                        type="button"
                        onClick={() => void logout()}
                        class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <LogOut class="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>

          <button
            type="button"
            class="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-border md:hidden"
            onClick={() => setMobileOpen(!mobileOpen())}
            aria-label={mobileOpen() ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen() ? <X class="h-5 w-5" /> : <Menu class="h-5 w-5" />}
          </button>
        </div>

        <Show when={mobileOpen()}>
          <div class="border-t border-border bg-background px-4 py-4 md:hidden">
            <div class="grid gap-1">
              <For each={isAuthenticated() ? accountItems : publicItems}>
                {(item) => {
                  const Icon = "icon" in item ? (item.icon as typeof Compass) : undefined;
                  return (
                    <A
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      class="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary"
                    >
                      <Show when={Icon}>
                        <Dynamic component={Icon} class="h-4 w-4" />
                      </Show>
                      {item.name}
                    </A>
                  );
                }}
              </For>
              <div class="mt-3 flex items-center justify-between border-t border-border pt-3">
                <ThemeSelector />
                <Show when={!isAuthenticated()}>
                  <A href="/auth/signup" onClick={() => setMobileOpen(false)}>
                    <Button>Start exploring</Button>
                  </A>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </nav>

      <Show when={isAuthenticated() && !isLoading()}>
        <nav class="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-2xl border border-border bg-background/95 p-1.5 shadow-xl backdrop-blur md:hidden">
          <For each={journeyItems}>
            {(item) => {
              const Icon = item.icon;
              const active = () => location.pathname.startsWith(item.href);
              return (
                <A
                  href={item.href}
                  class={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors ${active() ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                >
                  <Icon class="h-4 w-4" />
                  {item.name === "Ask Loci" ? "Ask" : item.name}
                </A>
              );
            }}
          </For>
        </nav>
      </Show>
    </>
  );
}
