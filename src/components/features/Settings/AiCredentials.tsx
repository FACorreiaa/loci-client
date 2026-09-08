import { createMemo, createSignal, For, Show } from "solid-js";
import { AlertTriangle, Check, Sparkles, Trash2, X } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import {
  useAiCredential,
  useAiProviders,
  useDeleteAiCredential,
  useSaveAiCredential,
  useVerifyAiCredential,
  type AiProviderView,
} from "~/lib/api/ai-credentials";

interface AiCredentialsProps {
  onNotification: (message: string, type: "success" | "error") => void;
}

function formatDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Bring your own model key.
 *
 * The card is built around a fact about the server: a stored key is never
 * readable again. So the key field is always empty and always optional —
 * leaving it blank keeps the key that is already stored, which is how the model
 * or base URL can be changed without retyping a secret nothing can read back.
 */
export default function AiCredentials(props: AiCredentialsProps) {
  const providersQuery = useAiProviders();
  const credentialQuery = useAiCredential();
  const saveMutation = useSaveAiCredential();
  const deleteMutation = useDeleteAiCredential();
  const verifyMutation = useVerifyAiCredential();

  const credential = () => credentialQuery.data?.credential ?? null;
  const providers = () => providersQuery.data?.providers ?? [];

  // The server answers whether a key can be held at all: storing one needs
  // ENCRYPTION_KEY, and a deployment without it must not offer a form that
  // cannot work.
  const storageEnabled = () =>
    (providersQuery.data?.enabled ?? true) && (credentialQuery.data?.enabled ?? true);

  const [provider, setProvider] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [model, setModel] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal("");
  const [confirmRemove, setConfirmRemove] = createSignal(false);
  const [touched, setTouched] = createSignal(false);

  // Until somebody picks a provider, the form shows the stored one.
  const selectedProvider = createMemo(() => provider() || credential()?.provider || "");

  const selectedMeta = createMemo<AiProviderView | undefined>(() =>
    providers().find((p) => p.name === selectedProvider()),
  );

  const isStoredProvider = () =>
    Boolean(credential()) && selectedProvider() === credential()?.provider;

  const effectiveModel = () => (touched() ? model() : (credential()?.model ?? ""));
  const effectiveBaseUrl = () => (touched() ? baseUrl() : (credential()?.baseUrl ?? ""));

  // A key is required for a provider that has none stored, and optional for one
  // that does.
  const keyRequired = () => !isStoredProvider();

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const name = selectedProvider();
    if (!name) {
      props.onNotification("Pick a provider first.", "error");
      return;
    }
    if (keyRequired() && !apiKey().trim()) {
      props.onNotification("Paste the provider's API key to store it.", "error");
      return;
    }
    if (selectedMeta()?.requiresBaseUrl && !effectiveBaseUrl().trim()) {
      props.onNotification(
        `${selectedMeta()?.label} routes through a gateway, so it needs a base URL.`,
        "error",
      );
      return;
    }
    try {
      await saveMutation.mutateAsync({
        provider: name,
        apiKey: apiKey().trim() || undefined,
        model: effectiveModel().trim(),
        baseUrl: effectiveBaseUrl().trim(),
      });
      // Never keep the plaintext around after it has been sent.
      setApiKey("");
      setTouched(false);
      props.onNotification("Your key is stored. Loci will use it for generation.", "success");
    } catch (err) {
      props.onNotification(err instanceof Error ? err.message : "Couldn't store the key.", "error");
    }
  };

  const handleVerify = async () => {
    try {
      const result = await verifyMutation.mutateAsync();
      if (!result.checked) {
        props.onNotification(
          "This provider has no cheap check, so the key is only proven by a real request.",
          "success",
        );
        return;
      }
      if (result.ok) {
        props.onNotification("The provider accepted the key.", "success");
      } else {
        props.onNotification(result.error || "The provider rejected the key.", "error");
      }
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't reach the provider.",
        "error",
      );
    }
  };

  const handleRemove = async () => {
    try {
      await deleteMutation.mutateAsync();
      setConfirmRemove(false);
      setApiKey("");
      setProvider("");
      setTouched(false);
      props.onNotification("Key removed. Generation goes back to Loci's provider.", "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't remove the key.",
        "error",
      );
    }
  };

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles class="w-5 h-5 text-primary" />
          Your own model key
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          Bring a key from your own provider and Loci generates with it instead of its own, which
          keeps generation off your daily quota. Loci stores it encrypted and never shows it again.
        </p>
      </div>

      <Show
        when={storageEnabled()}
        fallback={
          <div class="rounded-lg border border-border bg-muted/40 p-4">
            <div class="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle class="w-4 h-4" />
              Not available on this deployment
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              Storing a key needs an encryption key on the server, and this one has none. Nothing
              here would be able to keep your key safely, so the form is off rather than failing on
              save.
            </p>
          </div>
        }
      >
        {/* What is stored right now */}
        <Show when={credential()}>
          {(stored) => (
            <div class="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="text-sm text-foreground">
                  <span class="font-medium">
                    {providers().find((p) => p.name === stored().provider)?.label ??
                      stored().provider}
                  </span>{" "}
                  — a key ending <code class="font-mono text-xs">{stored().keyHint || "????"}</code>{" "}
                  is stored
                  <Show when={stored().model}>
                    <span class="text-muted-foreground">, model {stored().model}</span>
                  </Show>
                </div>
                <div class="flex items-center gap-2">
                  <Show when={selectedMeta()?.supportsVerification ?? true}>
                    <Button
                      variant="outline"
                      size="sm"
                      class="gap-1"
                      disabled={verifyMutation.isPending}
                      onClick={handleVerify}
                    >
                      <Check class="w-4 h-4" />
                      {verifyMutation.isPending ? "Checking…" : "Test key"}
                    </Button>
                  </Show>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:text-destructive gap-1"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 class="w-4 h-4" />
                    Remove
                  </Button>
                </div>
              </div>

              {/*
                A failing key is shown rather than swallowed. Without this the
                account quietly falls back to Loci's provider while still
                reporting the user's key as in use.
              */}
              <Show when={stored().lastError}>
                <div class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2">
                  <AlertTriangle class="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div class="text-xs text-destructive">
                    <div class="font-medium">Last call with this key failed</div>
                    <div class="mt-0.5 break-words">{stored().lastError}</div>
                    <div class="mt-0.5 opacity-80">{formatDate(stored().lastErrorAt)}</div>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </Show>

        <form onSubmit={handleSave} class="space-y-4">
          <div>
            <Label for="ai-provider" class="text-sm">
              Provider
            </Label>
            <select
              id="ai-provider"
              value={selectedProvider()}
              onChange={(e) => {
                setProvider(e.currentTarget.value);
                // A different provider's stored model and URL do not apply.
                setTouched(true);
                setModel("");
                setBaseUrl("");
              }}
              disabled={providersQuery.isLoading}
              class="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="">
                {providersQuery.isLoading ? "Loading providers…" : "Choose a provider"}
              </option>
              <For each={providers()}>{(p) => <option value={p.name}>{p.label}</option>}</For>
            </select>
            <Show when={selectedMeta()?.note}>
              <p class="text-xs text-muted-foreground mt-1">{selectedMeta()!.note}</p>
            </Show>
          </div>

          <div>
            <Label for="ai-key" class="text-sm">
              API key{" "}
              <Show when={!keyRequired()}>
                <span class="text-muted-foreground font-normal">
                  — leave blank to keep the stored one
                </span>
              </Show>
            </Label>
            <TextFieldRoot class="mt-1">
              <TextField
                id="ai-key"
                type="password"
                autocomplete="off"
                placeholder={selectedMeta()?.keyHint || "sk-…"}
                value={apiKey()}
                onInput={(e) => setApiKey(e.currentTarget.value)}
                maxLength={1024}
              />
            </TextFieldRoot>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label for="ai-model" class="text-sm">
                Model{" "}
                <span class="text-muted-foreground font-normal">
                  — blank uses {selectedMeta()?.defaultModel || "the provider default"}
                </span>
              </Label>
              <TextFieldRoot class="mt-1">
                <TextField
                  id="ai-model"
                  placeholder={selectedMeta()?.defaultModel || ""}
                  value={effectiveModel()}
                  onInput={(e) => {
                    setTouched(true);
                    setModel(e.currentTarget.value);
                  }}
                  maxLength={500}
                />
              </TextFieldRoot>
            </div>

            {/* Only gateway providers take one, and for them it is required. */}
            <Show when={selectedMeta()?.requiresBaseUrl}>
              <div>
                <Label for="ai-base-url" class="text-sm">
                  Base URL
                </Label>
                <TextFieldRoot class="mt-1">
                  <TextField
                    id="ai-base-url"
                    placeholder="https://gateway.example.com/v1"
                    value={effectiveBaseUrl()}
                    onInput={(e) => {
                      setTouched(true);
                      setBaseUrl(e.currentTarget.value);
                    }}
                    maxLength={500}
                  />
                </TextFieldRoot>
              </div>
            </Show>
          </div>

          <div class="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : isStoredProvider() ? "Update" : "Store key"}
            </Button>
          </div>
        </form>
      </Show>

      {/* Removing a key changes where generation runs, so it is confirmed. */}
      <Show when={confirmRemove()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div class="flex items-start justify-between">
              <h3 class="text-lg font-semibold text-foreground">Remove your key?</h3>
              <button
                onClick={() => setConfirmRemove(false)}
                class="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
            <p class="text-sm text-muted-foreground mt-2">
              Loci deletes the stored key and goes back to generating with its own provider, which
              counts against your daily quota again. You can store a new key any time.
            </p>
            <div class="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmRemove(false)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={handleRemove}
              >
                {deleteMutation.isPending ? "Removing…" : "Remove key"}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
