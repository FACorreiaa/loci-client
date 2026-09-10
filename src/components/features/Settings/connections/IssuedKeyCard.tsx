import { onMount, Show } from "solid-js";
import { Button } from "~/ui/button";
import { CodeBlock } from "~/ui/code-block";
import { BrandIcon } from "~/components/brand/agents";
import { API_KEY_SCOPES, clientKindLabel, type useCreateApiKey } from "~/lib/api/api-keys";
import { SetupBlocks } from "./SetupBlocks";

interface IssuedKeyCardProps {
  create: ReturnType<typeof useCreateApiKey>;
}

/**
 * The key that was just made, at the one moment it exists in plaintext.
 *
 * Rendered from the create mutation's result and gone when that is reset:
 * the server never stores the plaintext, so there is nothing to come back to.
 * The setup below it has the real token already substituted — sending
 * somebody to a separate guide here means copying a secret between two pages.
 */
export function IssuedKeyCard(props: IssuedKeyCardProps) {
  return (
    <Show when={props.create.data}>
      {(issued) => {
        let root: HTMLElement | undefined;
        // The key was made by a card further down the page; bring the reader
        // to it rather than leaving a plaintext secret above the fold unseen.
        onMount(() => root?.scrollIntoView({ behavior: "smooth", block: "start" }));

        const scopeLabels = () =>
          issued()
            .key.scopes.map((s) => API_KEY_SCOPES.find((x) => x.value === s)?.label ?? s)
            .join(", ");

        return (
          <section
            ref={root}
            class="space-y-4 rounded-xl border-2 border-accent bg-card p-5 sm:p-6"
            aria-live="polite"
          >
            <div class="space-y-1">
              <h2 class="flex items-center gap-2 text-base font-semibold text-foreground">
                <BrandIcon name={issued().key.clientKind} class="h-5 w-5 shrink-0" />
                Your key for {clientKindLabel(issued().key.clientKind)} — “{issued().key.name}”
              </h2>
              <p class="text-sm leading-relaxed text-foreground">
                Copy this now. It is not stored, so it cannot be shown again — if you lose it,
                revoke this connection and make another.
              </p>
              {/* Restate the permissions at the one moment the key is in the
                  reader's hands. A tool refusing it later for a missing scope
                  is otherwise a mystery. */}
              <p class="text-xs text-muted-foreground">This key can: {scopeLabels()}</p>
            </div>

            <CodeBlock heading="Key" body={issued().plaintext} />

            <Show when={issued().setup}>{(setup) => <SetupBlocks setup={setup()} />}</Show>

            <div class="flex justify-end">
              <Button variant="outline" onClick={() => props.create.reset()}>
                Done, I've copied it
              </Button>
            </div>
          </section>
        );
      }}
    </Show>
  );
}
