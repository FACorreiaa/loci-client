import { createEffect } from "solid-js";
import { checkedInToday, useDailyCheckIn } from "~/lib/api/gamification";
import { useAuthGate } from "~/lib/auth/useAuthGate";
import { capture } from "~/lib/analytics";

/**
 * Checks the signed-in traveller in once per local day (points + streak).
 * Renders nothing; mounted once in the Nav.
 */
export default function DailyCheckIn() {
  const gate = useAuthGate();
  const checkIn = useDailyCheckIn();
  createEffect(() => {
    if (!gate() || checkedInToday() || checkIn.isPending || checkIn.isSuccess) return;
    checkIn.mutate(undefined, {
      onSuccess: (points) => {
        if (points > 0) capture("points_awarded", { kind: "check_in", points });
      },
    });
  });
  return null;
}
