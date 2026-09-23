import { Show } from "solid-js";
import { Bell } from "lucide-solid";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  type NotificationSettings as Settings,
} from "~/lib/api/notifications";
import { usePushDeviceState } from "~/lib/push/use-push-device";
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
 * "Search finished" is the first one that sends something: a web push, once
 * this device has granted permission and registered. Recommendations and
 * trip reminders still only record a preference — no push or email is sent
 * for either of them yet, and the copy says so.
 */
export default function NotificationSettings(props: {
  onNotification: (message: string, type: "success" | "error") => void;
}) {
  const settingsQuery = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const pushDevice = usePushDeviceState();

  // isSuccess before .data: reading .data on a pending solid-query suspends the
  // app-wide boundary and blanks the whole settings route.
  const settings = (): Settings =>
    settingsQuery.isSuccess
      ? settingsQuery.data
      : { recommendations: false, tripReminders: false, searchFinished: false };

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

  const toggleSearchFinished = (value: boolean) => {
    pushDevice.onToggle(value);
    void toggle("searchFinished", value);
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
        These follow your account, not this browser. Recommendations and trip reminders don't send
        anything yet — we're recording what you'd want when they start.
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

          <div class="flex items-start gap-3">
            <Checkbox
              checked={settings().searchFinished}
              onChange={(value: boolean) => toggleSearchFinished(value)}
              disabled={updateSettings.isPending}
            >
              <CheckboxControl />
            </Checkbox>
            <div class="min-w-0">
              <Label class="font-medium text-foreground">Search finished</Label>
              <p class="text-sm text-muted-foreground">
                A notification when a search you left finishes or fails.
              </p>
              <Show when={pushDevice.deviceNotice(settings().searchFinished)}>
                {(notice) => (
                  <Show
                    when={notice().kind === "action"}
                    fallback={<p class="text-sm text-muted-foreground mt-1">{notice().text}</p>}
                  >
                    <button
                      type="button"
                      class="text-sm text-primary underline-offset-4 hover:underline mt-1"
                      onClick={() => pushDevice.enableOnThisDevice()}
                    >
                      {notice().text}
                    </button>
                  </Show>
                )}
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
