import { createMemo, createSignal, For, Show } from "solid-js";
import { AlertTriangle, Plug, TestTube2, Trash2, X } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import { Badge } from "~/ui/badge";
import {
  INTEGRATION_PROVIDERS,
  useConnections,
  useConnectIntegration,
  useDisconnectIntegration,
  useTestConnection,
} from "~/lib/api/integrations";

interface OutboundConnectionsProps {
  onNotification: (message: string, type: "success" | "error") => void;
}

function formatDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * MCP servers Loci calls, as opposed to the API keys that let agents call Loci.
 *
 * Worth keeping the direction visible in the copy: somebody who has just minted
 * an API key will otherwise read this card as the same thing twice.
 */
export default function OutboundConnections(props: OutboundConnectionsProps) {
  const connectionsQuery = useConnections();
  const connectMutation = useConnectIntegration();
  const disconnectMutation = useDisconnectIntegration();
  const testMutation = useTestConnection();

  const [provider, setProvider] = createSignal(INTEGRATION_PROVIDERS[0]?.name ?? "");
  const [endpoint, setEndpoint] = createSignal("");
  const [token, setToken] = createSignal("");
  const [confirmProvider, setConfirmProvider] = createSignal<string | null>(null);
  const [testing, setTesting] = createSignal<string | null>(null);
  const [tools, setTools] = createSignal<Record<string, string[]>>({});

  const connections = () => connectionsQuery.data?.connections ?? [];
  // False when the server has no encryption key, so no token could be stored.
  const enabled = () => connectionsQuery.data?.enabled ?? true;

  const selectedMeta = createMemo(() => INTEGRATION_PROVIDERS.find((p) => p.name === provider()));

  const providerLabel = (name: string) =>
    INTEGRATION_PROVIDERS.find((p) => p.name === name)?.label ?? name;

  const handleConnect = async (e: Event) => {
    e.preventDefault();
    if (!provider()) {
      props.onNotification("Pick what you're connecting.", "error");
      return;
    }
    const url = endpoint().trim();
    if (!url) {
      props.onNotification("Give the server's MCP endpoint.", "error");
      return;
    }
    try {
      await connectMutation.mutateAsync({
        provider: provider(),
        endpoint: url,
        accessToken: token().trim() || undefined,
      });
      setEndpoint("");
      setToken("");
      props.onNotification(`${providerLabel(provider())} connected.`, "success");
    } catch (err) {
      props.onNotification(err instanceof Error ? err.message : "Couldn't connect.", "error");
    }
  };

  const handleTest = async (name: string) => {
    setTesting(name);
    try {
      const result = await testMutation.mutateAsync(name);
      if (result.ok) {
        // The tool list is the only real proof this is the right endpoint.
        setTools((prev) => ({ ...prev, [name]: result.toolNames }));
        props.onNotification(
          `${providerLabel(name)} answered with ${result.toolNames.length} tool${
            result.toolNames.length === 1 ? "" : "s"
          }.`,
          "success",
        );
      } else {
        props.onNotification(result.error || "The server did not answer.", "error");
      }
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't reach the server.",
        "error",
      );
    } finally {
      setTesting(null);
    }
  };

  const handleDisconnect = async (name: string) => {
    try {
      await disconnectMutation.mutateAsync(name);
      setConfirmProvider(null);
      setTools((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      props.onNotification(`${providerLabel(name)} disconnected.`, "success");
    } catch (err) {
      props.onNotification(err instanceof Error ? err.message : "Couldn't disconnect.", "error");
    }
  };

  return (
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
          <Plug class="w-5 h-5 text-primary" />
          Servers Loci can call
        </h3>
        <p class="text-sm text-muted-foreground mt-1">
          The other direction from an API key: these are MCP servers of your own that Loci reaches
          out to while planning — a Hermes instance, a calendar it can read so a plan avoids the
          days you are busy.
        </p>
      </div>

      <Show
        when={enabled()}
        fallback={
          <div class="rounded-lg border border-border bg-muted/40 p-4">
            <div class="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle class="w-4 h-4" />
              Not available on this deployment
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              A connection's token is stored encrypted, and this server has no encryption key to do
              it with.
            </p>
          </div>
        }
      >
        {/* What is connected */}
        <Show when={connections().length > 0}>
          <div class="divide-y divide-border rounded-lg border border-border">
            <For each={connections()}>
              {(conn) => (
                <div class="p-3 space-y-2">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <div class="font-medium text-foreground">{providerLabel(conn.provider)}</div>
                      <div class="text-xs text-muted-foreground break-all mt-0.5">
                        {conn.endpoint}
                      </div>
                      <div class="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                        <span>Added {formatDate(conn.createdAt)}</span>
                        <span>
                          Last used {conn.lastSeenAt ? formatDate(conn.lastSeenAt) : "never"}
                        </span>
                        <span>{conn.hasToken ? "Token stored" : "No token"}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        class="gap-1"
                        disabled={testing() === conn.provider}
                        onClick={() => handleTest(conn.provider)}
                      >
                        <TestTube2 class="w-4 h-4" />
                        {testing() === conn.provider ? "Testing…" : "Test"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="text-destructive hover:text-destructive gap-1"
                        onClick={() => setConfirmProvider(conn.provider)}
                      >
                        <Trash2 class="w-4 h-4" />
                        Disconnect
                      </Button>
                    </div>
                  </div>

                  <Show when={tools()[conn.provider]?.length}>
                    <div class="flex flex-wrap gap-1">
                      <For each={tools()[conn.provider]}>
                        {(tool) => (
                          <Badge variant="secondary" class="text-xs font-mono">
                            {tool}
                          </Badge>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={conn.lastError}>
                    <div class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2">
                      <AlertTriangle class="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div class="text-xs text-destructive break-words">{conn.lastError}</div>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        <form onSubmit={handleConnect} class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-4">
            <div>
              <Label for="conn-provider" class="text-sm">
                What
              </Label>
              <select
                id="conn-provider"
                value={provider()}
                onChange={(e) => setProvider(e.currentTarget.value)}
                class="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                <For each={INTEGRATION_PROVIDERS}>
                  {(p) => <option value={p.name}>{p.label}</option>}
                </For>
              </select>
            </div>
            <div>
              <Label for="conn-endpoint" class="text-sm">
                MCP endpoint
              </Label>
              <TextFieldRoot class="mt-1">
                <TextField
                  id="conn-endpoint"
                  placeholder={selectedMeta()?.endpointPlaceholder ?? "https://…/mcp"}
                  value={endpoint()}
                  onInput={(e) => setEndpoint(e.currentTarget.value)}
                  maxLength={500}
                />
              </TextFieldRoot>
            </div>
          </div>

          <Show when={selectedMeta()?.note}>
            <p class="text-xs text-muted-foreground">{selectedMeta()!.note}</p>
          </Show>

          <div>
            <Label for="conn-token" class="text-sm">
              Access token{" "}
              <span class="text-muted-foreground font-normal">
                — optional; a server on your own network may need none
              </span>
            </Label>
            <TextFieldRoot class="mt-1">
              <TextField
                id="conn-token"
                type="password"
                autocomplete="off"
                placeholder="Bearer token, if the server wants one"
                value={token()}
                onInput={(e) => setToken(e.currentTarget.value)}
                maxLength={4096}
              />
            </TextFieldRoot>
          </div>

          <div class="flex justify-end">
            <Button type="submit" disabled={connectMutation.isPending} class="gap-2">
              <Plug class="w-4 h-4" />
              {connectMutation.isPending ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </form>
      </Show>

      {/* Naming what stops working, rather than "are you sure?". */}
      <Show when={confirmProvider()}>
        {(name) => (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
              <div class="flex items-start justify-between">
                <h3 class="text-lg font-semibold text-foreground">
                  Disconnect {providerLabel(name())}?
                </h3>
                <button
                  onClick={() => setConfirmProvider(null)}
                  class="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
              <p class="text-sm text-muted-foreground mt-2">
                Loci stops calling it, and its stored token is deleted. Anything a plan was getting
                from it — your events, your own tools — stops arriving. You will need the endpoint
                and token again to reconnect.
              </p>
              <div class="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmProvider(null)}>
                  Keep it
                </Button>
                <Button
                  variant="destructive"
                  disabled={disconnectMutation.isPending}
                  onClick={() => handleDisconnect(name())}
                >
                  {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
