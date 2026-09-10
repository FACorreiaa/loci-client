import { Show } from "solid-js";
import { CodeBlock } from "~/ui/code-block";
import type { SetupInstructionsView } from "~/lib/api/api-keys";

/**
 * The setup for one client, as the server rendered it.
 *
 * Shared by the preview (placeholder token) and the issued card (real token)
 * so the two never drift: what somebody saw before creating the key is what
 * they get after, with one substitution.
 *
 * The literal form is not the only one on offer: `.mcp.json` lives in a
 * project root and is routinely committed, so a card that shows only the
 * token-in-file version is how a key reaches a public repository.
 */
export function SetupBlocks(props: { setup: SetupInstructionsView }) {
  return (
    <div class="space-y-4">
      <Show when={props.setup.config}>
        <CodeBlock
          heading={props.setup.configLabel || "Configuration"}
          lang={props.setup.configLang}
          body={props.setup.config}
        />
      </Show>

      <Show when={props.setup.safe}>
        <div class="space-y-2">
          <CodeBlock
            heading={props.setup.safeLabel || "Token from the environment"}
            lang={props.setup.safeLang}
            body={props.setup.safe}
          />
          <Show when={props.setup.exportLine}>
            <CodeBlock heading="Set the variable" lang="bash" body={props.setup.exportLine} />
          </Show>
          <Show when={props.setup.safeNote}>
            <p class="text-xs leading-relaxed text-muted-foreground">{props.setup.safeNote}</p>
          </Show>
        </div>
      </Show>

      {/* "It's connected" is otherwise unobservable until something fails. */}
      <Show when={props.setup.prompt}>
        <div class="space-y-2">
          <CodeBlock heading="Setup prompt" body={props.setup.prompt} />
          <p class="text-xs leading-relaxed text-muted-foreground">
            Paste this into the agent as its first message. It sends the key to whichever model that
            agent runs on, so use it with an agent you trust with the key.
          </p>
        </div>
      </Show>
    </div>
  );
}
