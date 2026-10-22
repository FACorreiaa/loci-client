import { For, Match, Show, Switch } from "solid-js";
import { A } from "@solidjs/router";
import { PartyPopper } from "lucide-solid";
import UserAvatar from "./UserAvatar";
import { friendTripPath } from "./FriendTripCard";
import Medallion from "~/components/achievements/Medallion";
import { achievementLabel } from "~/lib/api/achievements";
import { profilePath, useCheer, type FeedItem } from "~/lib/api/social";
import { capture } from "~/lib/analytics";

/** "3h ago", "2d ago", or a date past a week. */
export const ago = (iso: string, now = Date.now()): string => {
  const ms = now - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** "Ana and Rui cheered", "Ana, Rui and 3 others cheered". */
export const cheersLine = (item: Pick<FeedItem, "cheers" | "cheerers">): string => {
  const names = item.cheerers.map((u) => u.displayName).slice(0, 2);
  const others = item.cheers - names.length;
  if (!names.length) return item.cheers ? `${item.cheers} cheered` : "";
  if (others <= 0) return `${names.join(" and ")} cheered`;
  return `${names.join(", ")} and ${others} other${others === 1 ? "" : "s"} cheered`;
};

function CheerButton(props: { item: FeedItem }) {
  const cheer = useCheer();
  const on = () => props.item.cheeredByMe;
  return (
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors"
      classList={{
        "border-primary bg-primary/10 text-primary": on(),
        "border-border text-muted-foreground hover:text-foreground": !on(),
      }}
      aria-pressed={on()}
      aria-label={on() ? "Take back your cheer" : "Cheer"}
      onClick={() => {
        const next = !on();
        cheer.mutate({ item: props.item, on: next });
        if (next) capture("cheer", { kind: props.item.detail.kind });
      }}
    >
      <PartyPopper class="h-4 w-4" aria-hidden="true" />
      <span>{on() ? "Cheered" : "Cheer"}</span>
      <Show when={props.item.cheers}>
        <span class="tabular-nums">· {props.item.cheers}</span>
      </Show>
    </button>
  );
}

/** One thing someone you follow did, and its cheers. */
export default function FeedItemCard(props: { item: FeedItem }) {
  const actor = () => props.item.actor;
  const href = () => profilePath(actor());
  const achievement = () => {
    const d = props.item.detail;
    return d.kind === "achievement" ? d.achievement : undefined;
  };
  const city = () => {
    const d = props.item.detail;
    return d.kind === "city" ? d : undefined;
  };
  const trip = () => {
    const d = props.item.detail;
    return d.kind === "trip" ? d : undefined;
  };
  return (
    <li class="loci-card flex gap-3 p-4">
      <UserAvatar user={actor()} />
      <div class="min-w-0 flex-1">
        <p class="text-sm">
          <Show when={href()} fallback={<span class="font-medium">{actor().displayName}</span>}>
            {(h) => (
              <A href={h()} class="font-medium hover:underline">
                {actor().displayName}
              </A>
            )}
          </Show>{" "}
          <Switch>
            <Match when={achievement()}>
              {(a) => (
                <>
                  earned <span class="font-medium">{achievementLabel(a())}</span>
                </>
              )}
            </Match>
            <Match when={city()}>
              {(c) => (
                <>
                  explored a new city:{" "}
                  <span class="font-medium">
                    {c().cityName}
                    <Show when={c().country}>, {c().country}</Show>
                  </span>
                </>
              )}
            </Match>
            <Match when={trip()}>
              {(t) => (
                <>
                  {t().finished ? "finished a trip:" : "shared a trip:"}{" "}
                  <A href={friendTripPath(t().tripId)} class="font-medium hover:underline">
                    {t().title || t().cityName || "Untitled trip"}
                  </A>
                </>
              )}
            </Match>
          </Switch>
        </p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {ago(props.item.createdAt)}
          <Show when={trip()?.days ? trip() : undefined}>
            {(t) => (
              <>
                {" "}
                · {t().cityName ? `${t().cityName}, ` : ""}
                {t().days} day{t().days === 1 ? "" : "s"}
              </>
            )}
          </Show>
        </p>
        <Show when={achievement()}>
          {(a) => (
            <div class="mt-3 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Medallion icon={a().icon} kind={a().kind} tier={a().tier} earned />
              <p class="text-sm text-muted-foreground">{a().description}</p>
            </div>
          )}
        </Show>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <CheerButton item={props.item} />
          <Show when={cheersLine(props.item)}>
            {(line) => (
              <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="flex -space-x-2">
                  <For each={props.item.cheerers}>
                    {(u) => <UserAvatar user={u} size="sm" class="h-6 w-6 ring-2 ring-card" />}
                  </For>
                </span>
                {line()}
              </span>
            )}
          </Show>
        </div>
      </div>
    </li>
  );
}
