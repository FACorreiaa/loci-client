import type { JSX } from "solid-js";
import { ErrorBoundary, Suspense } from "solid-js";
import { Button } from "~/ui/button";
import { useCreateApiKey } from "~/lib/api/api-keys";
import { CardSkeleton } from "./CardSkeleton";
import { ConnectAgentCard } from "./ConnectAgentCard";
import { ConnectedAgentsCard } from "./ConnectedAgentsCard";
import { IssuedKeyCard } from "./IssuedKeyCard";
import { ModelProviderCard } from "./ModelProviderCard";
import OutboundConnections from "./OutboundConnections";
import { TelegramCard } from "./TelegramCard";

export type Notify = (message: string, type: "success" | "error") => void;

interface ConnectionsPageProps {
  onNotification: Notify;
}

/**
 * A card that cannot take the page down with it.
 *
 * Every card reads its own RPC. The ErrorBoundary keeps a thrown one inside
 * the card, and the Suspense keeps a pending one from reaching the route-level
 * boundary in app.tsx — which is the one that used to swap the whole settings
 * page for a spinner when a single query rekeyed.
 */
function Island(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      fallback={(err: unknown, reset) => (
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p class="text-sm text-destructive">
            Couldn't load this section.{" "}
            <span class="text-destructive/80">
              {err instanceof Error ? err.message : String(err)}
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={reset}>
            Retry
          </Button>
        </div>
      )}
    >
      <Suspense fallback={<CardSkeleton />}>{props.children}</Suspense>
    </ErrorBoundary>
  );
}

/**
 * Settings → Agent connections.
 *
 * One page for everything that talks to something outside Loci on your
 * behalf. Reading order follows what somebody is most likely here to do: the
 * key they just made (only while it exists), what is already connected, then
 * connecting another agent, then the less frequent Telegram and model-provider
 * choices, and finally the servers Loci itself calls.
 */
export function ConnectionsPage(props: ConnectionsPageProps) {
  // Owned here rather than in the agent panel: the issued key is shown at the
  // top of the page, by a different card than the one that made it.
  const create = useCreateApiKey();

  return (
    <div class="mx-auto w-full max-w-2xl space-y-6">
      <header class="space-y-2">
        <p class="font-coord text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Agent connections</h1>
        <p class="text-sm leading-relaxed text-muted-foreground">
          Let an agent you already use — Claude Code, Codex, Cursor, Hermes — plan with your Loci
          data. Each connection gets its own key, so you can turn one off without touching the
          others.
        </p>
      </header>

      <Island>
        <IssuedKeyCard create={create} />
      </Island>
      <Island>
        <ConnectedAgentsCard onNotification={props.onNotification} />
      </Island>
      <Island>
        <ConnectAgentCard create={create} onNotification={props.onNotification} />
      </Island>
      <Island>
        <TelegramCard onNotification={props.onNotification} />
      </Island>
      <Island>
        <ModelProviderCard onNotification={props.onNotification} />
      </Island>
      <Island>
        <div class="rounded-xl border border-border bg-card p-5 sm:p-6">
          <OutboundConnections onNotification={props.onNotification} />
        </div>
      </Island>
    </div>
  );
}

export default ConnectionsPage;
