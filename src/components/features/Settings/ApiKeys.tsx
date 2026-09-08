import { createSignal, For, Show } from "solid-js";
import { Plus, Copy, Check, Trash2, KeyRound, X, Terminal } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import { Checkbox, CheckboxControl } from "~/ui/checkbox";
import {
  API_KEY_SCOPES,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  type ApiKeyScope,
  type CreatedApiKey,
} from "~/lib/api/api-keys";

interface ApiKeysProps {
  onNotification: (message: string, type: "success" | "error") => void;
}

const MCP_ENDPOINT = `${import.meta.env.VITE_CONNECT_BASE_URL ?? "http://localhost:8000"}/mcp`;

function formatDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ApiKeys(props: ApiKeysProps) {
  const keysQuery = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();

  const [newName, setNewName] = createSignal("");
  // Read is preselected because it is the safe default and what most agents
  // need. Nothing was selectable before: the form called the name-only
  // overload, so every key the product could mint held read alone — which made
  // plan_itinerary unreachable however good your plan was.
  const [scopes, setScopes] = createSignal<ApiKeyScope[]>(["read"]);
  const [created, setCreated] = createSignal<CreatedApiKey | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [revokingId, setRevokingId] = createSignal<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = createSignal<{ id: string; name: string } | null>(null);

  const toggleScope = (scope: ApiKeyScope, on: boolean) =>
    setScopes((current) =>
      on ? [...current.filter((s) => s !== scope), scope] : current.filter((s) => s !== scope),
    );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    const name = newName().trim();
    if (!name) {
      props.onNotification("Give the key a name so you can recognize it later.", "error");
      return;
    }
    // No scope means the server applies its default, which is read. Saying so
    // is better than minting something the caller did not intend.
    if (scopes().length === 0) {
      props.onNotification("Choose at least one thing this key may do.", "error");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({ name, scopes: scopes() });
      setCreated(result);
      setNewName("");
      setScopes(["read"]);
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Failed to create API key.",
        "error",
      );
    }
  };

  const handleRevoke = async (id: string) => {
    setConfirmRevoke(null);
    setRevokingId(id);
    try {
      await revokeMutation.mutateAsync(id);
      props.onNotification("API key revoked.", "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Failed to revoke API key.",
        "error",
      );
    } finally {
      setRevokingId(null);
    }
  };

  const copyPlaintext = async () => {
    const key = created()?.plaintext;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      props.onNotification("Couldn't copy — select and copy the key manually.", "error");
    }
  };

  const activeKeys = () => (keysQuery.data ?? []).filter((k) => !k.revokedAt);

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-xl font-semibold text-foreground flex items-center gap-2">
          <KeyRound class="w-5 h-5 text-primary" />
          API Keys
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          Connect Claude, Codex, Gemini, and other AI agents to Loci over MCP. Each key
          authenticates as you and counts against your daily plan.
        </p>
      </div>

      {/* MCP connection hint */}
      <div class="rounded-lg border border-border bg-muted/40 p-4">
        <div class="flex items-center gap-2 text-sm font-medium text-foreground">
          <Terminal class="w-4 h-4" />
          Your MCP endpoint
        </div>
        <code class="mt-2 block text-xs sm:text-sm text-muted-foreground break-all">
          {MCP_ENDPOINT}
        </code>
        <p class="text-xs text-muted-foreground mt-2">
          Add this URL to your AI client with the header{" "}
          <code class="text-foreground">Authorization: Bearer &lt;your-key&gt;</code>. See the{" "}
          <a href="/mcp" class="text-primary underline underline-offset-2">
            setup guide
          </a>
          .
        </p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} class="space-y-4 rounded-lg border border-border p-4">
        <div>
          <Label for="new-key-name" class="text-sm">
            New key name
          </Label>
          <TextFieldRoot class="mt-1">
            <TextField
              id="new-key-name"
              placeholder="e.g. Claude Desktop"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              maxLength={100}
            />
          </TextFieldRoot>
        </div>

        <fieldset>
          <legend class="text-sm font-medium text-foreground">What this key may do</legend>
          <p class="text-xs text-muted-foreground mt-0.5">
            Chosen once. A key's permissions cannot be changed afterwards — to widen them, create a
            new key and revoke this one.
          </p>
          <div class="mt-3 space-y-2.5">
            <For each={API_KEY_SCOPES}>
              {(scope) => (
                <Checkbox
                  checked={scopes().includes(scope.value)}
                  onChange={(on) => toggleScope(scope.value, on)}
                  class="flex items-start gap-2.5"
                >
                  <CheckboxControl class="mt-0.5" />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-foreground">{scope.label}</span>
                    <span class="block text-xs text-muted-foreground">{scope.description}</span>
                  </span>
                </Checkbox>
              )}
            </For>
          </div>
        </fieldset>

        <Button type="submit" disabled={createMutation.isPending} class="gap-2">
          <Plus class="w-4 h-4" />
          {createMutation.isPending ? "Creating…" : "Create key"}
        </Button>
      </form>

      {/* Keys list */}
      <div class="space-y-2">
        <Show
          when={!keysQuery.isLoading}
          fallback={<p class="text-sm text-muted-foreground">Loading keys…</p>}
        >
          <Show when={keysQuery.isError}>
            <div class="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <span class="text-sm text-destructive">Couldn't load your keys.</span>
              <Button variant="outline" size="sm" onClick={() => keysQuery.refetch()}>
                Retry
              </Button>
            </div>
          </Show>

          <Show
            when={activeKeys().length > 0}
            fallback={
              <Show when={!keysQuery.isError}>
                <p class="text-sm text-muted-foreground py-4 text-center">
                  No API keys yet. Create one above to connect an AI agent.
                </p>
              </Show>
            }
          >
            <div class="divide-y divide-border rounded-lg border border-border">
              <For each={activeKeys()}>
                {(key) => (
                  <div class="flex items-center justify-between gap-4 p-3">
                    <div class="min-w-0">
                      <div class="font-medium text-foreground truncate">{key.name}</div>
                      <div class="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span class="font-mono">{key.keyPrefix}…</span>
                        <span>Created {formatDate(key.createdAt)}</span>
                        <span>
                          Last used {key.lastUsedAt ? formatDate(key.lastUsedAt) : "never"}
                        </span>
                      </div>
                      {/* Without this, a tool refusing a key for lacking a
                          scope could not be diagnosed from the product at
                          all — the holder had no way to see what it holds. */}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-destructive hover:text-destructive gap-1 shrink-0"
                      disabled={revokingId() === key.id}
                      onClick={() => setConfirmRevoke({ id: key.id, name: key.name })}
                    >
                      <Trash2 class="w-4 h-4" />
                      {revokingId() === key.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Revoking is immediate and irreversible: anything using the key stops
          working the moment this completes. That deserves a sentence and a
          second click, not a single button in a list. */}
      <Show when={confirmRevoke()}>
        {(target) => (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
              <h3 class="text-lg font-semibold text-foreground">Revoke “{target().name}”?</h3>
              <p class="mt-2 text-sm text-muted-foreground">
                Any agent using this key stops working immediately, and the key cannot be restored.
                You will need to create a new one and paste it into that client again.
              </p>
              <div class="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmRevoke(null)}>
                  Keep it
                </Button>
                <Button
                  class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => handleRevoke(target().id)}
                >
                  Revoke key
                </Button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Show-once secret overlay */}
      <Show when={created()}>
        {(result) => (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div class="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-foreground">Copy your API key now</h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    This is the only time it will be shown. Store it somewhere safe.
                  </p>
                  {/* Restate the permissions at the one moment the key is in
                      the reader's hands. A tool refusing it later for a
                      missing scope is otherwise a mystery. */}
                  <p class="text-xs text-muted-foreground mt-2">
                    This key can:{" "}
                    {result()
                      .key.scopes.map(
                        (scope) => API_KEY_SCOPES.find((s) => s.value === scope)?.label ?? scope,
                      )
                      .join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => setCreated(null)}
                  class="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <code class="flex-1 text-xs sm:text-sm text-foreground break-all font-mono">
                  {result().plaintext}
                </code>
                <Button variant="outline" size="sm" class="gap-1 shrink-0" onClick={copyPlaintext}>
                  <Show when={copied()} fallback={<Copy class="w-4 h-4" />}>
                    <Check class="w-4 h-4 text-accent" />
                  </Show>
                  {copied() ? "Copied" : "Copy"}
                </Button>
              </div>

              <div class="mt-6 flex justify-end">
                <Button onClick={() => setCreated(null)}>Done</Button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
