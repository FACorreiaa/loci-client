import { createSignal, For, Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { Button } from "~/ui/button";
import UserAvatar from "~/components/social/UserAvatar";
import { useBoardsSession } from "~/components/boards/session";
import { boardsErrorMessage, useLiftSanction, useSanctions, type Sanction } from "~/lib/api/boards";
import { profilePath } from "~/lib/api/social";
import { showToast } from "~/lib/toast-store";
import { cn } from "~/lib/utils";

const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString() : "");

const isActive = (s: Sanction, now: number) =>
  !s.liftedAt && (!s.expiresAt || new Date(s.expiresAt).getTime() > now);

/**
 * Admin: everyone muted or banned, and a way to lift it. Muting and banning
 * happen from a post or comment's ⋯ menu. The server refuses non-admins;
 * this page only hides itself from them.
 */
export default function BoardsAdminPage() {
  const session = useBoardsSession();
  const sanctionsQuery = useSanctions(() => session.isAdmin());
  const sanctions = () => (sanctionsQuery.isSuccess ? sanctionsQuery.data : []);
  const lift = useLiftSanction();
  const [showPast, setShowPast] = createSignal(false);
  const now = Date.now();
  const shown = () => sanctions().filter((s) => showPast() || isActive(s, now));

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Title>Moderation · Boards · Loci</Title>
      <Meta name="robots" content="noindex" />
      <A href="/boards" class="text-sm text-muted-foreground hover:text-foreground">
        ← Boards
      </A>
      <h1 class="mt-2 text-3xl">Moderation</h1>

      <Show
        when={session.isAdmin()}
        fallback={<p class="mt-6 text-muted-foreground">This page is for board moderators.</p>}
      >
        <p class="mt-1 text-muted-foreground">
          Mute or ban someone from the ⋯ menu on any post or comment.
        </p>
        <label class="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showPast()}
            onChange={(e) => setShowPast(e.currentTarget.checked)}
          />
          Show lifted and expired
        </label>

        <Show
          when={shown().length}
          fallback={
            <p class="mt-6 text-sm text-muted-foreground">
              {sanctionsQuery.isLoading ? "Loading…" : "Nobody is muted or banned."}
            </p>
          }
        >
          <ul class="loci-card mt-4 divide-y divide-border/60 p-0">
            <For each={shown()}>
              {(s) => (
                <li class="flex items-center gap-3 px-4 py-3">
                  <Show when={s.user}>{(u) => <UserAvatar user={u()} size="sm" />}</Show>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm">
                      <A
                        href={(s.user && profilePath(s.user)) ?? "#"}
                        class="font-medium hover:underline"
                      >
                        {s.user?.displayName || s.user?.id}
                      </A>{" "}
                      <span
                        class={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          s.kind === "ban" ? "bg-destructive/15 text-destructive" : "bg-muted",
                        )}
                      >
                        {s.kind}
                      </span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Since {date(s.createdAt)}
                      {s.liftedAt
                        ? ` · lifted ${date(s.liftedAt)}`
                        : s.expiresAt
                          ? ` · until ${date(s.expiresAt)}`
                          : " · permanent"}
                      {s.reason ? ` · ${s.reason}` : ""}
                    </p>
                  </div>
                  <Show when={isActive(s, now)}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={lift.isPending}
                      onClick={() =>
                        lift.mutate(s.id, {
                          onError: (err) =>
                            showToast({ id: "boards-lift", title: boardsErrorMessage(err) }),
                        })
                      }
                    >
                      Lift
                    </Button>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </main>
  );
}
