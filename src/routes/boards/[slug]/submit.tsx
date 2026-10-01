import { createSignal, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { TextArea } from "~/ui/textarea";
import { Label } from "~/ui/label";
import AttachmentPicker, { type PickedAttachment } from "~/components/boards/AttachmentPicker";
import { postPath } from "~/components/boards/PostRow";
import SanctionBanner from "~/components/boards/SanctionBanner";
import { useBoardsSession } from "~/components/boards/session";
import { boardsErrorMessage, useBoard, useCreatePost } from "~/lib/api/boards";

const isLink = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim());

/** Post to a board: a title, and any of a link, some text and a Loci item. */
export default function SubmitPostPage() {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const session = useBoardsSession();
  const boardQuery = useBoard(() => params.slug);
  const board = () => (boardQuery.isSuccess ? boardQuery.data : undefined);
  const create = useCreatePost();

  const [title, setTitle] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [body, setBody] = createSignal("");
  const [attachment, setAttachment] = createSignal<PickedAttachment>();
  const [error, setError] = createSignal("");

  const urlOk = () => !url().trim() || isLink(url());
  const valid = () => title().trim().length >= 3 && urlOk();

  const submit = async (e: Event) => {
    e.preventDefault();
    setError("");
    try {
      const a = attachment();
      const post = await create.mutateAsync({
        boardSlug: params.slug,
        title: title().trim(),
        url: url().trim(),
        body: body().trim(),
        attachment: a ? { kind: a.kind, ref: a.ref } : undefined,
      });
      navigate(post ? postPath(post) : `/boards/${encodeURIComponent(params.slug)}`);
    } catch (err) {
      setError(boardsErrorMessage(err));
    }
  };

  return (
    <main class="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Title>{`Post to ${board()?.name ?? params.slug} · Loci`}</Title>
      <A
        href={`/boards/${encodeURIComponent(params.slug)}`}
        class="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {board()?.name ?? params.slug}
      </A>
      <h1 class="mt-2 text-3xl">New post</h1>

      <SanctionBanner sanction={session.sanction()} />

      <Show
        when={session.signedIn()}
        fallback={
          <p class="mt-6">
            <A href="/auth/signin" class="font-medium text-primary underline">
              Sign in
            </A>{" "}
            to post.
          </p>
        }
      >
        <form onSubmit={submit} class="mt-6 space-y-5">
          <TextFieldRoot>
            <Label class="mb-2 block">Title</Label>
            <TextField
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value.slice(0, 200))}
              placeholder="Three days in Porto without a car"
              required
            />
          </TextFieldRoot>

          <TextFieldRoot>
            <Label class="mb-2 block">Link (optional)</Label>
            <TextField
              type="url"
              inputMode="url"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value.slice(0, 2048))}
              placeholder="https://"
            />
            <Show when={!urlOk()}>
              <p class="mt-1 text-xs text-destructive">Use a full http:// or https:// address.</p>
            </Show>
          </TextFieldRoot>

          <TextFieldRoot>
            <Label class="mb-2 block">Text (optional)</Label>
            <TextArea
              value={body()}
              onInput={(e) => setBody(e.currentTarget.value.slice(0, 10000))}
              rows={6}
              placeholder="Markdown works: **bold**, lists, [links](https://…)"
            />
          </TextFieldRoot>

          <div>
            <Label class="mb-2 block">Loci item (optional)</Label>
            <AttachmentPicker value={attachment()} onChange={setAttachment} />
          </div>

          <Show when={error()}>
            <p class="text-sm text-destructive" role="alert">
              {error()}
            </p>
          </Show>

          <Button type="submit" disabled={!valid() || create.isPending || !!session.sanction()}>
            Post
          </Button>
        </form>
      </Show>
    </main>
  );
}
