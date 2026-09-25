import { createSignal, For, Show } from "solid-js";
import { Laptop, LogOut } from "lucide-solid";
import {
  useSessions,
  useRevokeSession,
  useRevokeOtherSessions,
  type DeviceSession,
} from "~/lib/api/sessions";
import { Button } from "~/ui/button";
import { describeUserAgent } from "~/lib/user-agent";

/**
 * Where the account is signed in, and how to end a session.
 *
 * user_sessions has recorded the user agent, IP and start time since the table
 * was created, and nothing ever read them back — so there was no way to see
 * this, and the change-password card had to apologise for not signing out
 * other sessions.
 */
export default function SignedInDevices(props: {
  onNotification: (message: string, type: "success" | "error") => void;
}) {
  const sessionsQuery = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const [confirmingAll, setConfirmingAll] = createSignal(false);

  // isSuccess before .data: reading .data on a pending solid-query suspends the
  // app-wide boundary and blanks the whole settings route.
  const sessions = (): DeviceSession[] => (sessionsQuery.isSuccess ? sessionsQuery.data : []);
  const otherCount = () => sessions().filter((s) => !s.current).length;

  const endSession = async (session: DeviceSession) => {
    try {
      const result = await revokeSession.mutateAsync(session.id);
      props.onNotification(result.message || "Signed out of that device.", "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Could not end that session.",
        "error",
      );
    }
  };

  const endOthers = async () => {
    setConfirmingAll(false);
    try {
      const result = await revokeOthers.mutateAsync();
      props.onNotification(result.message || "Signed out of your other devices.", "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Could not sign out your other devices.",
        "error",
      );
    }
  };

  return (
    <div>
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Laptop class="w-5 h-5 text-primary" />
        </div>
        <h3 class="text-lg font-semibold text-foreground">Signed-in devices</h3>
      </div>

      <p class="text-sm text-muted-foreground mb-6">
        Ending a session stops that device signing itself back in. Anything it is already doing can
        continue for a few more minutes before its access lapses.
      </p>

      <Show
        when={sessionsQuery.isSuccess}
        fallback={<p class="text-sm text-muted-foreground">Loading your sessions…</p>}
      >
        <ul class="space-y-3">
          <For each={sessions()}>
            {(session) => (
              <li class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div class="min-w-0">
                  {/*
                    The raw header used to be rendered here, so two different
                    browsers read as the same wall of text and the screen could
                    not answer "which of these is me?". The full string stays as
                    the title, so nothing is lost.
                  */}
                  <p class="font-medium text-foreground" title={session.userAgent}>
                    {describeUserAgent(session.userAgent)}
                    <Show when={session.current}>
                      <span class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        This device
                      </span>
                    </Show>
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {session.clientIp || "unknown address"}
                    <Show when={session.createdAt}>
                      {" · since "}
                      {session.createdAt!.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Show>
                  </p>
                </div>

                {/* No revoke button on your own session: use sign out for that,
                    where the app can clear its tokens and send you somewhere
                    sensible instead of leaving a dead page. */}
                <Show when={!session.current}>
                  <Button
                    variant="outline"
                    onClick={() => void endSession(session)}
                    disabled={revokeSession.isPending}
                  >
                    <LogOut class="w-4 h-4 mr-1.5" />
                    End session
                  </Button>
                </Show>
              </li>
            )}
          </For>
        </ul>

        <Show when={otherCount() > 0}>
          <div class="mt-6 border-t border-border pt-6">
            <Show
              when={confirmingAll()}
              fallback={
                <Button variant="outline" onClick={() => setConfirmingAll(true)}>
                  Sign out my other devices
                </Button>
              }
            >
              <p class="text-sm text-foreground mb-3">
                This ends {otherCount()} other {otherCount() === 1 ? "session" : "sessions"}. You
                stay signed in here.
              </p>
              <div class="flex gap-2">
                <Button onClick={() => void endOthers()} disabled={revokeOthers.isPending}>
                  {revokeOthers.isPending ? "Signing out…" : "Yes, sign them out"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmingAll(false)}>
                  Cancel
                </Button>
              </div>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
