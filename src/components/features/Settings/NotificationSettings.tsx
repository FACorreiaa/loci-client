import { Show } from "solid-js";
import { Bell } from "lucide-solid";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  type NotificationSettings as Settings,
} from "~/lib/api/notifications";
import { Checkbox, CheckboxControl } from "~/ui/checkbox";
import { Label } from "~/ui/label";

/**
 * Notification switches, stored against the account.
 *
 * These were reachable only through the dashboard's quick-settings modal, and
 * before that they lived in localStorage keyed by user id — so they did not
 * follow anyone to a second browser or a phone, and nothing server-side could
 * read them.
 *
 * They record a preference and nothing more. No push or email is sent for
 * either of them yet, and the copy says so rather than letting a switch imply
 * something will arrive.
 */
export default function NotificationSettings(props: {
  onNotification: (message: string, type: "success" | "error") => void;
}) {
  const settingsQuery = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();

  // isSuccess before .data: reading .data on a pending solid-query suspends the
  // app-wide boundary and blanks the whole settings route.
  const settings = (): Settings =>
    settingsQuery.isSuccess ? settingsQuery.data : { recommendations: false, tripReminders: false };

  const toggle = async (key: keyof Settings, value: boolean) => {
    try {
      // Only the switch that moved. Omitting the other means "leave it as it
      // is", which the server treats differently from switching it off.
      await updateSettings.mutateAsync({ [key]: value });
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Could not save that preference.",
        "error",
      );
    }
  };

  return (
    <div class="loci-card rounded-3xl p-6 sm:p-8">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell class="w-5 h-5 text-primary" />
        </div>
        <h3 class="text-lg font-semibold text-foreground">Notifications</h3>
      </div>

      <p class="text-sm text-muted-foreground mb-6">
        These follow your account, not this browser. Nothing is sent for either of them yet — we're
        recording what you'd want when they start.
      </p>

      <Show
        when={settingsQuery.isSuccess}
        fallback={<p class="text-sm text-muted-foreground">Loading your preferences…</p>}
      >
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <Checkbox
              checked={settings().recommendations}
              onChange={(value: boolean) => void toggle("recommendations", value)}
              disabled={updateSettings.isPending}
            >
              <CheckboxControl />
            </Checkbox>
            <div class="min-w-0">
              <Label class="font-medium text-foreground">Recommendations</Label>
              <p class="text-sm text-muted-foreground">
                Places Loci thinks you'd like, based on what you've saved and rated.
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <Checkbox
              checked={settings().tripReminders}
              onChange={(value: boolean) => void toggle("tripReminders", value)}
              disabled={updateSettings.isPending}
            >
              <CheckboxControl />
            </Checkbox>
            <div class="min-w-0">
              <Label class="font-medium text-foreground">Trip reminders</Label>
              <p class="text-sm text-muted-foreground">
                Nudges about a trip you're planning as the dates get close.
              </p>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
