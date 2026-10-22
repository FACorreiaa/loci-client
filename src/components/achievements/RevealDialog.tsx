import { createMemo, createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/dialog";
import { Button } from "~/ui/button";
import Medallion from "./Medallion";
import { isEarned, tierRank, type AchievementList } from "~/lib/api/achievements";
import { useMarkAchievementsSeen } from "~/lib/api/achievements";
import { capture } from "~/lib/analytics";

/**
 * The one-time reveal: what the caller earned before achievements existed,
 * shown once instead of one push at a time. Closing it, either way, marks
 * everything seen, so it never comes back (on any device).
 */
export default function RevealDialog(props: { list?: AchievementList }) {
  const navigate = useNavigate();
  const markSeen = useMarkAchievementsSeen();
  const [closed, setClosed] = createSignal(false);
  const count = () => props.list?.unseenBackfill ?? 0;
  const best = createMemo(() =>
    (props.list?.achievements ?? [])
      .filter((a) => isEarned(a) && a.isNew)
      .sort((a, b) => tierRank(b) - tierRank(a))
      .slice(0, 6),
  );
  const close = (go: boolean) => {
    setClosed(true);
    markSeen.mutate([]);
    capture("achievements_revealed", { count: count(), opened: go });
    if (go) navigate("/achievements");
  };
  return (
    <Dialog open={count() > 0 && !closed()} onOpenChange={(open) => !open && close(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            You've already earned {count()} achievement{count() === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Loci now keeps achievements, and counted everything you did before they existed.
          </DialogDescription>
        </DialogHeader>
        <Show when={best().length}>
          <ul class="flex flex-wrap justify-center gap-3 py-2">
            <For each={best()}>
              {(a) => (
                <Medallion icon={a.icon} kind={a.kind} tier={a.tier} earned label={a.title} />
              )}
            </For>
          </ul>
        </Show>
        <DialogFooter class="gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            Later
          </Button>
          <Button onClick={() => close(true)}>See them</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
