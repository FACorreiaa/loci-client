import { createMemo, createSignal, For, Show } from "solid-js";
import { AlertTriangle, Check, Trash2 } from "lucide-solid";
import { Button } from "~/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemControl,
  RadioGroupItemInput,
  RadioGroupItemLabel,
  RadioGroupLabel,
} from "~/ui/radio-group";
import { Skeleton } from "~/ui/skeleton";
import { TextField, TextFieldDescription, TextFieldLabel, TextFieldRoot } from "~/ui/textfield";
import { BrandIcon } from "~/components/brand/agents";
import {
  useAiCredential,
  useAiProviders,
  useDeleteAiCredential,
  useSaveAiCredential,
  useVerifyAiCredential,
  type AiProviderView,
} from "~/lib/api/ai-credentials";
import { SectionCard } from "./SectionCard";
import { formatDateTime } from "./state";
import type { Notify } from "./ConnectionsPage";

interface ModelProviderCardProps {
  onNotification: Notify;
}

type Mode = "loci" | "own";

const HERMES_PLACEHOLDER = "https://hermes-vps-2.tail562587.ts.net";

/**
 * Which model answers when Loci itself generates.
 *
 * Built around a fact about the server: a stored key is never readable
 * again. So the key field is always empty and, once a key is stored, always
 * optional — leaving it blank keeps the key already there, which is how the
 * model or gateway URL can be changed without retyping a secret nothing can
 * read back.
 */
export function ModelProviderCard(props: ModelProviderCardProps) {
  const providersQuery = useAiProviders();
  const credentialQuery = useAiCredential();
  const save = useSaveAiCredential();
  const remove = useDeleteAiCredential();
  const verify = useVerifyAiCredential();

  const providers = () => (providersQuery.isSuccess ? providersQuery.data.providers : []);
  const credential = () => (credentialQuery.isSuccess ? credentialQuery.data.credential : null);
  // The server answers whether a key can be held at all: storing one needs
  // ENCRYPTION_KEY, and a deployment without it must not offer a form that
  // cannot work.
  const enabled = () =>
    (providersQuery.isSuccess ? providersQuery.data.enabled : true) &&
    (credentialQuery.isSuccess ? credentialQuery.data.enabled : true);
  const loading = () => providersQuery.isPending || credentialQuery.isPending;

  // Until somebody chooses, the mode follows whether a key is stored.
  const [chosenMode, setChosenMode] = createSignal<Mode | null>(null);
  const mode = (): Mode => chosenMode() ?? (credential() ? "own" : "loci");

  const [provider, setProvider] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [model, setModel] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal("");
  const [touched, setTouched] = createSignal(false);
  const [confirmRemove, setConfirmRemove] = createSignal(false);

  // Until somebody picks a provider, the form shows the stored one.
  const selectedProvider = createMemo(
    () => provider() || credential()?.provider || providers()[0]?.name || "",
  );
  const selectedMeta = createMemo<AiProviderView | undefined>(() =>
    providers().find((p) => p.name === selectedProvider()),
  );
  const providerLabel = (name: string) => providers().find((p) => p.name === name)?.label ?? name;

  const isStoredProvider = () =>
    Boolean(credential()) && selectedProvider() === credential()?.provider;
  const effectiveModel = () => (touched() ? model() : (credential()?.model ?? ""));
  const effectiveBaseUrl = () => (touched() ? baseUrl() : (credential()?.baseUrl ?? ""));
  // A key is required for a provider that has none stored, optional otherwise.
  const keyRequired = () => !isStoredProvider();

  const pickProvider = (name: string) => {
    setProvider(name);
    // A different provider's stored model and URL do not apply.
    setTouched(true);
    setModel("");
    setBaseUrl("");
  };

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
        `${selectedMeta()?.label ?? name} runs as your own gateway, so it needs its URL.`,
        "error",
      );
      return;
    }
    try {
      await save.mutateAsync({
        provider: name,
        apiKey: apiKey().trim() || undefined,
        model: effectiveModel().trim(),
        baseUrl: effectiveBaseUrl().trim(),
      });
      // Never keep the plaintext around after it has been sent.
      setApiKey("");
      setTouched(false);
      props.onNotification(
        `Saved. Loci answers with ${providerLabel(name)} from now on.`,
        "success",
      );
    } catch (err) {
      props.onNotification(err instanceof Error ? err.message : "Couldn't save the key.", "error");
    }
  };

  const handleVerify = async () => {
    try {
      const result = await verify.mutateAsync();
      if (!result.checked) {
        props.onNotification(
          result.error || "This provider has no cheap check; the key is proven by a real request.",
          "success",
        );
      } else if (result.ok) {
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
      await remove.mutateAsync();
      setConfirmRemove(false);
      setApiKey("");
      setProvider("");
      setTouched(false);
      setChosenMode("loci");
      props.onNotification("Key removed. Loci's own model answers again.", "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't remove the key.",
        "error",
      );
    }
  };

  return (
    <SectionCard
      title="Model provider"
      description="Who does the thinking when Loci itself writes a plan — in chat, on Telegram, in the app."
    >
      {/* The one thing people most often want here is the one thing that
          cannot work, so say it before the form rather than after a failure. */}
      <div class="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
        <span class="font-medium text-foreground">Have a Claude or ChatGPT subscription?</span> A
        subscription only works inside the app you pay for; Loci's server can't sign in with it.
        Connect that agent above over MCP and it calls Loci for you. To have Loci itself answer with
        your model, paste a pay-as-you-go API key here.
      </div>

      <Show
        when={!loading()}
        fallback={
          <div class="space-y-3" aria-busy="true">
            <Skeleton class="h-5 w-56" />
            <Skeleton class="h-20 w-full" />
          </div>
        }
      >
        <Show when={providersQuery.isError || credentialQuery.isError}>
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <span class="text-sm text-destructive">Couldn't load your provider settings.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void providersQuery.refetch();
                void credentialQuery.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        </Show>

        <Show
          when={enabled()}
          fallback={
            <div class="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4">
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p class="text-sm text-muted-foreground">
                Not available on this server — it has no encryption key configured, and Loci will
                not store a provider key it cannot encrypt.
              </p>
            </div>
          }
        >
          <RadioGroup value={mode()} onChange={(v) => setChosenMode(v as Mode)} class="space-y-2">
            <RadioGroupLabel class="sr-only">Who answers</RadioGroupLabel>
            <RadioGroupItem value="loci" class="flex items-start gap-3">
              <RadioGroupItemInput />
              <RadioGroupItemControl class="mt-0.5" />
              <RadioGroupItemLabel class="cursor-pointer">
                <span class="block text-sm font-medium text-foreground">Use Loci's AI</span>
                <span class="block text-xs text-muted-foreground">
                  Nothing to set up. Counts against your plan's daily quota.
                </span>
              </RadioGroupItemLabel>
            </RadioGroupItem>
            <RadioGroupItem value="own" class="flex items-start gap-3">
              <RadioGroupItemInput />
              <RadioGroupItemControl class="mt-0.5" />
              <RadioGroupItemLabel class="cursor-pointer">
                <span class="block text-sm font-medium text-foreground">Use my own API key</span>
                <span class="block text-xs text-muted-foreground">
                  Your provider bills you directly, and generation stays off your quota. Stored
                  encrypted; never shown again.
                </span>
              </RadioGroupItemLabel>
            </RadioGroupItem>
          </RadioGroup>

          {/* Choosing Loci's AI while a key is stored does nothing on its own;
              the key keeps routing until it is removed, and saying so beats a
              radio that looks like it switched something. */}
          <Show when={mode() === "loci" && credential()}>
            {(stored) => (
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <p class="text-sm text-muted-foreground">
                  Your {providerLabel(stored().provider)} key is still stored and still answering.
                  Remove it to go back to Loci's model.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  class="gap-1 text-destructive"
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                  Remove key
                </Button>
              </div>
            )}
          </Show>

          <Show when={mode() === "own"}>
            <form onSubmit={handleSave} class="space-y-5 border-t border-border pt-5">
              <Show when={credential()?.lastError}>
                <div class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  <div class="text-xs text-destructive">
                    <p class="font-medium">
                      The last call with your key failed
                      <Show when={credential()?.lastErrorAt}>
                        {" "}
                        ({formatDateTime(credential()?.lastErrorAt)})
                      </Show>
                      . Loci's own model is answering in the meantime.
                    </p>
                    <p class="mt-0.5 break-words">{credential()?.lastError}</p>
                  </div>
                </div>
              </Show>

              <RadioGroup
                value={selectedProvider()}
                onChange={pickProvider}
                class="space-y-2"
                aria-label="Provider"
              >
                <RadioGroupLabel class="text-sm font-medium text-foreground">
                  Provider
                </RadioGroupLabel>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <For each={providers()}>
                    {(p) => (
                      <RadioGroupItem
                        value={p.name}
                        class="relative flex h-full flex-col gap-1.5 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring data-[checked]:border-primary data-[checked]:bg-primary/5"
                      >
                        <RadioGroupItemInput />
                        <RadioGroupItemLabel class="flex cursor-pointer flex-col gap-1.5 after:absolute after:inset-0 after:content-['']">
                          <span class="flex items-center gap-2">
                            <BrandIcon name={p.name} class="h-5 w-5 shrink-0" />
                            <span class="text-sm font-medium text-foreground">{p.label}</span>
                            <Show when={credential()?.provider === p.name}>
                              <Check class="ml-auto h-4 w-4 text-primary" aria-label="Stored" />
                            </Show>
                          </span>
                          <Show when={p.note}>
                            <span class="text-xs leading-relaxed text-muted-foreground">
                              {p.note}
                            </span>
                          </Show>
                        </RadioGroupItemLabel>
                      </RadioGroupItem>
                    )}
                  </For>
                </div>
              </RadioGroup>

              <Show when={selectedMeta()?.requiresBaseUrl}>
                <TextFieldRoot
                  value={effectiveBaseUrl()}
                  onChange={(v) => {
                    setTouched(true);
                    setBaseUrl(v);
                  }}
                >
                  <TextFieldLabel>Gateway URL</TextFieldLabel>
                  <TextField
                    type="url"
                    inputmode="url"
                    placeholder={HERMES_PLACEHOLDER}
                    maxLength={500}
                    autocomplete="off"
                  />
                  <TextFieldDescription>
                    Each account runs its own instance — tailnet, LAN, or public HTTPS.
                  </TextFieldDescription>
                </TextFieldRoot>
              </Show>

              <TextFieldRoot value={apiKey()} onChange={setApiKey}>
                <TextFieldLabel>API key</TextFieldLabel>
                <TextField
                  type="password"
                  autocomplete="off"
                  placeholder={selectedMeta()?.keyHint || "sk-…"}
                  maxLength={1024}
                />
                <Show when={isStoredProvider() ? credential() : null}>
                  {(stored) => (
                    <TextFieldDescription>
                      A key ending <code class="font-mono">{stored().keyHint || "????"}</code> is
                      stored. Leave this blank to keep it.
                    </TextFieldDescription>
                  )}
                </Show>
              </TextFieldRoot>

              <TextFieldRoot
                value={effectiveModel()}
                onChange={(v) => {
                  setTouched(true);
                  setModel(v);
                }}
              >
                <TextFieldLabel>Model</TextFieldLabel>
                <TextField
                  placeholder={selectedMeta()?.defaultModel || ""}
                  maxLength={500}
                  autocomplete="off"
                />
                <TextFieldDescription>
                  Leave blank for this provider's default.
                </TextFieldDescription>
              </TextFieldRoot>

              <div class="flex flex-wrap items-center justify-end gap-2">
                <Show when={isStoredProvider()}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="mr-auto gap-1 text-destructive hover:text-destructive"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 class="h-4 w-4" aria-hidden="true" />
                    Remove
                  </Button>
                  <Show when={selectedMeta()?.supportsVerification}>
                    <Button
                      type="button"
                      variant="outline"
                      class="gap-1"
                      disabled={verify.isPending}
                      onClick={handleVerify}
                    >
                      <Check class="h-4 w-4" aria-hidden="true" />
                      {verify.isPending ? "Checking…" : "Verify"}
                    </Button>
                  </Show>
                </Show>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Show>
        </Show>
      </Show>

      {/* Removing a key changes where generation runs, so it is confirmed. */}
      <Dialog open={confirmRemove()} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove your key?</DialogTitle>
            <DialogDescription>
              Loci deletes the stored key and goes back to answering with its own model, which
              counts against your daily quota again. You can store a new key any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter class="gap-2">
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={handleRemove}>
              {remove.isPending ? "Removing…" : "Remove key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
