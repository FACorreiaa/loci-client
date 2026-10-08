import { createEffect } from "solid-js";
import { reportedTimezoneToday, useReportTimezone } from "~/lib/api/gamification";
import { useAuthGate } from "~/lib/auth/useAuthGate";

/**
 * Tells the server the browser's timezone once per local day, so the field
 * score's weeks start on Monday where the traveller is. Awards nothing and
 * renders nothing; mounted once in the Nav.
 */
export default function ReportTimezone() {
  const gate = useAuthGate();
  const report = useReportTimezone();
  createEffect(() => {
    if (!gate() || reportedTimezoneToday() || report.isPending || report.isSuccess) return;
    report.mutate();
  });
  return null;
}
