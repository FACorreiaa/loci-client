import { createSignal, For, onCleanup, Show } from "solid-js";
import { Trash2 } from "lucide-solid";
import { Button } from "~/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/dialog";
import { BrandIcon } from "~/components/brand/agents";
import {
  API_KEY_SCOPES,
  clientKindLabel,
  useApiKeys,
  useRevokeApiKey,
  type ApiKeyView,
} from "~/lib/api/api-keys";
import { SectionCard } from "./SectionCard";
import { anyWaitingForFirstUse, firstUseState, formatDate } from "./state";
import type { Notify } from "./ConnectionsPage";

interface ConnectedAgentsCardProps {
  onNotification: Notify;
}

/**
 * Every agent with a live key, and whether it has called in yet.
 *
 * A key made in the last ten minutes with no use is "waiting": somebody who
 * has just pasted the config is looking here for the confirmation that it
 * worked, so the list polls every five seconds while any key is in that
 * state and stops the moment none is. After that, silence is a fact.
 */
export function ConnectedAgentsCard(props: ConnectedAgentsCardProps) {
  const keysQuery = useApiKeys({
    refetchInterval: (keys) => (anyWaitingForFirstUse(keys, Date.now()) ? 5_000 : false),
  });
  const revoke = useRevokeApiKey();

  // The "waiting" window is a function of wall-clock time, so the display
  // needs a clock that ticks even when no refetch changes the data.
  const [now, setNow] = createSignal(Date.now());
  const clock = setInterval(() => setNow(Date.now()), 5_000);
  onCleanup(() => clearInterval(clock));

  const [confirm, setConfirm] = createSignal<ApiKeyView | null>(null);
  const [revokingId, setRevokingId] = createSignal<string | null>(null);

  const keys = () => (keysQuery.isSuccess ? keysQuery.data : []).filter((k) => !k.revokedAt);

  const handleRevoke = async (key: ApiKeyView) => {
    setConfirm(null);
    setRevokingId(key.id);
    try {
      await revoke.mutateAsync(key.id);
      props.onNotification(`“${key.name}” revoked.`, "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't revoke the key.",
        "error",
      );
    } finally {
      setRevokingId(null);
    }
  };

  const status = (key: ApiKeyView) => {
    switch (firstUseState(key, now())) {
      case "connected":
        return `connected · last used ${formatDate(key.lastUsedAt)}`;
      case "waiting":
        return "waiting for first use…";
      default:
        return "not used yet";
    }
  };

  return (
    <Show when={keysQuery.isError || keys().length > 0}>
      <SectionCard title="Connected agents">
        <Show when={keysQuery.isError}>
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <span class="text-sm text-destructive">Couldn't load your connections.</span>
            <Button variant="outline" size="sm" onClick={() => void keysQuery.refetch()}>
              Retry
            </Button>
          </div>
        </Show>

        <Show when={keys().length > 0}>
          <ul class="divide-y divide-border rounded-lg border border-border">
            <For each={keys()}>
              {(key) => {
                const state = () => firstUseState(key, now());
                return (
                  <li class="flex items-center justify-between gap-4 p-3">
                    <div class="flex min-w-0 items-start gap-3">
                      <BrandIcon
                        name={key.clientKind}
                        class="mt-0.5 h-5 w-5 shrink-0 text-foreground"
                        label={clientKindLabel(key.clientKind)}
                      />
                      <div class="min-w-0">
                        <div class="truncate font-medium text-foreground">{key.name}</div>
                        <div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{clientKindLabel(key.clientKind)}</span>
                          <span class="font-mono">{key.keyPrefix}…</span>
                          <span>Created {formatDate(key.createdAt)}</span>
                        </div>
                        <div
                          class="mt-1 flex items-center gap-1.5 text-xs"
                          classList={{
                            "text-foreground": state() === "connected",
                            "text-muted-foreground": state() !== "connected",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            class="inline-block h-1.5 w-1.5 rounded-full"
                            classList={{
                              "bg-accent": state() === "connected",
                              "bg-accent/60 animate-pulse": state() === "waiting",
                              "bg-border": state() === "not_used",
                            }}
                          />
                          {status(key)}
                        </div>
                        {/* Without this, a tool refusing a key for lacking a
                            scope could not be diagnosed from the product. */}
                        <div class="mt-1.5 flex flex-wrap gap-1">
                          <For each={key.scopes}>
                            {(scope) => (
                              <span class="rounded-full border border-border px-2 py-0.5 text-[0.68rem] text-muted-foreground">
                                {API_KEY_SCOPES.find((s) => s.value === scope)?.label ?? scope}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="shrink-0 gap-1 text-destructive hover:text-destructive"
                      disabled={revokingId() === key.id}
                      onClick={() => setConfirm(key)}
                    >
                      <Trash2 class="h-4 w-4" aria-hidden="true" />
                      {revokingId() === key.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>

        {/* Revoking is immediate and irreversible: anything using the key
            stops working the moment this completes. That deserves a sentence
            and a second click, not a single button in a list. */}
        <Dialog open={confirm() !== null} onOpenChange={(open) => !open && setConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke “{confirm()?.name}”?</DialogTitle>
              <DialogDescription>
                {clientKindLabel(confirm()?.clientKind ?? "other")} stops working with this key
                immediately, and the key cannot be restored. You will need to make a new one and
                paste it into that agent again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const target = confirm();
                  if (target) void handleRevoke(target);
                }}
              >
                Revoke key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SectionCard>
    </Show>
  );
}
