import { createSignal, For, Show } from "solid-js";
import { Plus } from "lucide-solid";
import { Button } from "~/ui/button";
import { Checkbox, CheckboxControl } from "~/ui/checkbox";
import { Skeleton } from "~/ui/skeleton";
import { TextField, TextFieldDescription, TextFieldLabel, TextFieldRoot } from "~/ui/textfield";
import { InlineCopy } from "~/ui/code-block";
import {
  API_KEY_SCOPES,
  useSetupInstructions,
  type ApiKeyScope,
  type ClientKind,
  type useCreateApiKey,
} from "~/lib/api/api-keys";
import { MCP_ENDPOINT } from "~/lib/mcp-endpoint";
import { SetupBlocks } from "./SetupBlocks";
import type { Notify } from "./ConnectionsPage";

interface AgentPanelProps {
  kind: ClientKind;
  label: string;
  create: ReturnType<typeof useCreateApiKey>;
  onNotification: Notify;
}

/**
 * Setup for one agent, then the form that mints its key.
 *
 * The preview comes from the server with a placeholder where the token goes,
 * so "what will I have to do?" is answerable without issuing a credential.
 * Creating the key returns the same setup with the real token substituted;
 * that is shown by IssuedKeyCard at the top of the page.
 */
export function AgentPanel(props: AgentPanelProps) {
  const q = useSetupInstructions(() => props.kind);
  // Never read `.data` unguarded: the getter suspends while pending, and a
  // suspend here on a tab switch is exactly what blanked the old page.
  const setup = () => (q.isSuccess ? q.data : undefined);

  const [name, setName] = createSignal("");
  // Read is preselected because it is the safe default and what most agents
  // need; Generate is opt-in because it spends quota.
  const [scopes, setScopes] = createSignal<ApiKeyScope[]>(["read"]);

  const toggleScope = (scope: ApiKeyScope, on: boolean) =>
    setScopes((current) =>
      on ? [...current.filter((s) => s !== scope), scope] : current.filter((s) => s !== scope),
    );

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) {
      props.onNotification("Name the connection so you can tell which one to revoke.", "error");
      return;
    }
    if (scopes().length === 0) {
      props.onNotification("Choose at least one thing this key may do.", "error");
      return;
    }
    try {
      await props.create.mutateAsync({ name: trimmed, scopes: scopes(), clientKind: props.kind });
      setName("");
      setScopes(["read"]);
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't create the key.",
        "error",
      );
    }
  };

  return (
    <div class="space-y-6">
      <Show
        when={!q.isPending}
        fallback={
          <div class="space-y-3" aria-busy="true">
            <Skeleton class="h-4 w-48" />
            <Skeleton class="h-28 w-full" />
          </div>
        }
      >
        <Show
          when={setup()}
          fallback={
            <div class="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
              <p class="text-sm text-foreground">
                <Show
                  when={q.isError}
                  fallback={<>This server has no written setup for {props.label} yet.</>}
                >
                  Couldn't load the setup for {props.label}.
                </Show>
              </p>
              <p class="text-xs text-muted-foreground">
                Point it at this endpoint with the header{" "}
                <code class="text-foreground">Authorization: Bearer &lt;your key&gt;</code>.
              </p>
              <InlineCopy value={MCP_ENDPOINT} what="endpoint" />
              <Show when={q.isError}>
                <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
                  Retry
                </Button>
              </Show>
            </div>
          }
        >
          {(preview) => (
            <div class="space-y-3">
              <p class="text-xs leading-relaxed text-muted-foreground">
                A preview: the placeholder is replaced with the real key once you create one below.
                Looking issues nothing.
              </p>
              <SetupBlocks setup={preview()} />
            </div>
          )}
        </Show>
      </Show>

      <form onSubmit={handleCreate} class="space-y-5 border-t border-border pt-5">
        <TextFieldRoot value={name()} onChange={setName}>
          <TextFieldLabel>Name this connection</TextFieldLabel>
          <TextField placeholder="Laptop" maxLength={100} autocomplete="off" />
          <TextFieldDescription>
            Name it after the machine it will live on, so you know which one to revoke later.
          </TextFieldDescription>
        </TextFieldRoot>

        <fieldset>
          <legend class="text-sm font-medium text-foreground">What this key may do</legend>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Chosen once. To widen a key's permissions later, make a new one and revoke this one.
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

        <Button type="submit" disabled={props.create.isPending} class="gap-2">
          <Plus class="h-4 w-4" aria-hidden="true" />
          {props.create.isPending ? "Creating…" : `Create a key for ${props.label}`}
        </Button>
      </form>
    </div>
  );
}
