import { For, Show } from "solid-js";
import Medallion from "./Medallion";
import { achievementLabel, type AchievementSummary } from "~/lib/api/achievements";

/** A profile's best achievements, as a row of medallions with their names. */
export default function Showcase(props: { items: AchievementSummary[]; title?: string }) {
  return (
    <Show when={props.items.length}>
      <section aria-label={props.title ?? "Achievements"}>
        <ul class="flex flex-wrap gap-3">
          <For each={props.items}>
            {(a) => (
              <li class="flex w-20 flex-col items-center gap-1 text-center" title={a.description}>
                <Medallion icon={a.icon} kind={a.kind} tier={a.tier} earned />
                <span class="line-clamp-2 text-xs leading-tight">{achievementLabel(a)}</span>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
