import { For, Show, createSignal } from "solid-js";
import { CalendarDays } from "lucide-solid";
import {
  CalendarProvider,
  toWebcal,
  useCalendarConnections,
  useCalendarFeedUrl,
  useConnectCalendar,
  useDisconnectCalendar,
} from "~/lib/api/calendar";
import { Button } from "~/ui/button";

const label = (p: CalendarProvider) => {
  if (p === CalendarProvider.GOOGLE) return "Google Calendar";
  if (p === CalendarProvider.CALENDLY) return "Calendly";
  return "Calendar";
};

export default function ConnectedCalendars() {
  const connections = useCalendarConnections();
  const feed = useCalendarFeedUrl();
  const connect = useConnectCalendar();
  const disconnect = useDisconnectCalendar();
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const has = (p: CalendarProvider) => (connections.data ?? []).some((c) => c.provider === p);

  const onConnect = async (p: CalendarProvider) => {
    setError(null);
    try {
      await connect.mutateAsync(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect that calendar.");
    }
  };

  const copyFeed = async () => {
    const url = feed.data;
    if (!url) return;
    await navigator.clipboard.writeText(toWebcal(url));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section class="loci-card rounded-3xl p-6 sm:p-8">
      <div class="mb-4 flex items-start gap-3">
        <CalendarDays class="mt-1 h-5 w-5 text-accent" />
        <div>
          <h3 class="text-lg font-semibold sm:text-xl">Calendars</h3>
          <p class="text-sm text-muted-foreground">
            Overlay Google and Calendly on your trip calendar. Apple Calendar on the web subscribes
            to a live feed of your dated trips.
          </p>
        </div>
      </div>

      <Show when={error()}>
        <p class="mb-3 text-sm text-destructive">{error()}</p>
      </Show>

      <ul class="space-y-3">
        <For
          each={[
            { provider: CalendarProvider.GOOGLE, hint: "Read your events and add Loci trips." },
            {
              provider: CalendarProvider.CALENDLY,
              hint: "Show booked meetings next to trip days.",
            },
          ]}
        >
          {(row) => {
            const existing = () =>
              (connections.data ?? []).find((c) => c.provider === row.provider);
            return (
              <li class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <div>
                  <p class="font-semibold">{label(row.provider)}</p>
                  <p class="text-xs text-muted-foreground">
                    {existing()?.accountLabel || row.hint}
                  </p>
                </div>
                <Show
                  when={has(row.provider)}
                  fallback={
                    <Button
                      size="sm"
                      onClick={() => onConnect(row.provider)}
                      disabled={connect.isPending}
                    >
                      Connect
                    </Button>
                  }
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => existing() && disconnect.mutate(existing()!.id)}
                    disabled={disconnect.isPending}
                  >
                    Disconnect
                  </Button>
                </Show>
              </li>
            );
          }}
        </For>
        <li class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <div>
            <p class="font-semibold">Apple Calendar</p>
            <p class="text-xs text-muted-foreground">
              Subscribe on Mac or iPhone via a live .ics feed.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={copyFeed} disabled={!feed.data}>
            {copied() ? "Copied" : "Copy subscribe link"}
          </Button>
        </li>
      </ul>
    </section>
  );
}
