import { createSignal, For, Show } from "solid-js";
import { Plus, Copy, Check, Trash2, KeyRound, X, Terminal } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import { Checkbox, CheckboxControl } from "~/ui/checkbox";
import {
  API_KEY_SCOPES,
  CLIENT_KINDS,
  clientKindLabel,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useSetupInstructions,
  type ApiKeyScope,
  type ClientKind,
  type CreatedApiKey,
  type SetupInstructionsView,
} from "~/lib/api/api-keys";
import { MCP_ENDPOINT } from "~/lib/mcp-endpoint";

interface ApiKeysProps {
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
 * A snippet with a copy button.
 *
 * Setup is copied, not read: an agent config is punctuation-exact and retyping
 * it from the screen is how a bad quote or a lost backslash becomes "MCP
 * doesn't work".
 */
function CopyBlock(props: { label: string; lang?: string; value: string; onFail: () => void }) {
  const [copied, setCopied] = createSignal(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      props.onFail();
    }
  };
  return (
    <div class="rounded-lg border border-border bg-muted/40">
      <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <span class="text-xs font-medium text-foreground">
          {props.label}
          <Show when={props.lang}>
            <span class="text-muted-foreground font-normal"> · {props.lang}</span>
          </Show>
        </span>
        <Button variant="ghost" size="sm" class="gap-1 h-7" onClick={copy}>
          <Show when={copied()} fallback={<Copy class="w-3.5 h-3.5" />}>
            <Check class="w-3.5 h-3.5 text-accent" />
          </Show>
          {copied() ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre class="overflow-x-auto p-3 text-xs leading-relaxed text-foreground">
        <code>{props.value}</code>
      </pre>
    </div>
  );
}

/**
 * Setup for one client, rendered by the server.
 *
 * The literal form is not the only one on offer: `.mcp.json` lives in a project
 * root and is routinely committed, so a card that shows only the token-in-file
 * version is how a key reaches a public repository.
 */
function SetupBlocks(props: { setup: SetupInstructionsView; onFail: () => void }) {
  return (
    <div class="space-y-3">
      <Show when={props.setup.config}>
        <CopyBlock
          label={props.setup.configLabel || "Configuration"}
          lang={props.setup.configLang}
          value={props.setup.config}
          onFail={props.onFail}
        />
      </Show>

      <Show when={props.setup.safe}>
        <div class="space-y-2">
          <CopyBlock
            label={props.setup.safeLabel || "Token from the environment"}
            lang={props.setup.safeLang}
            value={props.setup.safe}
            onFail={props.onFail}
          />
          <Show when={props.setup.exportLine}>
            <CopyBlock
              label="Set the variable"
              lang="bash"
              value={props.setup.exportLine}
              onFail={props.onFail}
            />
          </Show>
          <Show when={props.setup.safeNote}>
            <p class="text-xs text-muted-foreground">{props.setup.safeNote}</p>
          </Show>
        </div>
      </Show>

      {/* "It's connected" is otherwise unobservable until something fails. */}
      <Show when={props.setup.prompt}>
        <CopyBlock label="Ask it this first" value={props.setup.prompt} onFail={props.onFail} />
      </Show>
    </div>
  );
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
  // Which agent this key is for. Presentation only — nothing about
  // authentication varies by kind — but it decides which setup snippet is shown
  // and is stored so the list can say what a key was made for.
  const [clientKind, setClientKind] = createSignal<ClientKind>("claude_code");
  const [created, setCreated] = createSignal<CreatedApiKey | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [revokingId, setRevokingId] = createSignal<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = createSignal<{ id: string; name: string } | null>(null);

  // The setup for the selected kind with a placeholder where the token goes, so
  // "what will I have to do?" is answerable without minting a live credential
  // to find out.
  const previewQuery = useSetupInstructions(clientKind);

  const copyFailed = () =>
    props.onNotification("Couldn't copy — select the text and copy it manually.", "error");

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
      const result = await createMutation.mutateAsync({
        name,
        scopes: scopes(),
        clientKind: clientKind(),
      });
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
          <legend class="text-sm font-medium text-foreground">Which client</legend>
          <p class="text-xs text-muted-foreground mt-0.5">
            Only decides which setup instructions you get. A key works in any MCP client.
          </p>
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <For each={CLIENT_KINDS}>
              {(kind) => (
                <button
                  type="button"
                  aria-pressed={clientKind() === kind.value}
                  onClick={() => setClientKind(kind.value)}
                  class={`rounded-lg border p-3 text-left transition-colors ${
                    clientKind() === kind.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span class="block text-sm font-medium text-foreground">{kind.label}</span>
                  <span class="block text-xs text-muted-foreground">{kind.blurb}</span>
                </button>
              )}
            </For>
          </div>
        </fieldset>

        {/* What setup will look like, with a placeholder token. */}
        <Show when={previewQuery.data}>
          {(preview) => (
            <details class="rounded-lg border border-border">
              <summary class="cursor-pointer px-3 py-2 text-sm text-foreground">
                What you'll paste into {clientKindLabel(clientKind())}
              </summary>
              <div class="border-t border-border p-3">
                <p class="text-xs text-muted-foreground mb-3">
                  This is a preview — <code class="text-foreground">{"<your-key>"}</code> is
                  replaced with the real token once you create the key. No credential is issued by
                  looking.
                </p>
                <SetupBlocks setup={preview()} onFail={copyFailed} />
              </div>
            </details>
          )}
        </Show>

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
                        <span>For {clientKindLabel(key.clientKind)}</span>
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

              {/* Setup with the real token already in it, at the one moment
                  the token exists. Sending somebody to a separate guide here
                  means copying a secret between two pages. */}
              <Show when={result().setup}>
                {(setup) => (
                  <div class="mt-4 max-h-[45vh] overflow-y-auto">
                    <div class="text-sm font-medium text-foreground mb-2">
                      Set up {clientKindLabel(setup().clientKind)}
                    </div>
                    <SetupBlocks setup={setup()} onFail={copyFailed} />
                  </div>
                )}
              </Show>

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
