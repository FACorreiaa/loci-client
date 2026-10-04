import { createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "~/ui/button";
import { TextArea } from "~/ui/textarea";
import { TextFieldRoot } from "~/ui/textfield";
import { boardsErrorMessage, useCreateComment } from "~/lib/api/boards";
import { showToast } from "~/lib/toast-store";
import type { BoardsSession } from "./session";

const MAX = 5000;

/** Write a comment, or a reply when parentId is set. */
export default function CommentComposer(props: {
  postId: string;
  parentId?: string;
  session: BoardsSession;
  autofocus?: boolean;
  onDone?: () => void;
}) {
  const [body, setBody] = createSignal("");
  const create = useCreateComment();

  const submit = async (e: Event) => {
    e.preventDefault();
    const text = body().trim();
    if (!text) return;
    try {
      await create.mutateAsync({ postId: props.postId, parentId: props.parentId, body: text });
      setBody("");
      props.onDone?.();
    } catch (err) {
      showToast({ id: "boards-comment", title: boardsErrorMessage(err) });
    }
  };

  return (
    <Show
      when={props.session.signedIn()}
      fallback={
        <p class="text-sm text-muted-foreground">
          <A href="/auth/signin" class="font-medium text-primary underline">
            Sign in
          </A>{" "}
          to join the conversation.
        </p>
      }
    >
      <Show
        when={!props.session.sanction()}
        fallback={<p class="text-sm text-muted-foreground">You can't comment right now.</p>}
      >
        <form onSubmit={submit} class="space-y-2">
          <TextFieldRoot>
            <TextArea
              value={body()}
              onInput={(e) => setBody(e.currentTarget.value.slice(0, MAX))}
              placeholder={props.parentId ? "Write a reply" : "Add a comment"}
              rows={props.parentId ? 2 : 3}
              autofocus={props.autofocus}
              aria-label={props.parentId ? "Reply" : "Comment"}
            />
          </TextFieldRoot>
          <div class="flex justify-end gap-2">
            <Show when={props.onDone && props.parentId}>
              <Button type="button" variant="ghost" size="sm" onClick={() => props.onDone?.()}>
                Cancel
              </Button>
            </Show>
            <Button type="submit" size="sm" disabled={!body().trim() || create.isPending}>
              {props.parentId ? "Reply" : "Comment"}
            </Button>
          </div>
        </form>
      </Show>
    </Show>
  );
}
