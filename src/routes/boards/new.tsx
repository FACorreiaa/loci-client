import { createSignal, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { TextArea } from "~/ui/textarea";
import { Label } from "~/ui/label";
import SanctionBanner from "~/components/boards/SanctionBanner";
import { useBoardsSession } from "~/components/boards/session";
import { boardsErrorMessage, slugify, SLUG_RE, useCreateBoard } from "~/lib/api/boards";

/** Open a board. The address follows the name until someone edits it. */
export default function NewBoardPage() {
  const session = useBoardsSession();
  const navigate = useNavigate();
  const create = useCreateBoard();
  const [name, setName] = createSignal("");
  const [slug, setSlug] = createSignal("");
  const [slugEdited, setSlugEdited] = createSignal(false);
  const [description, setDescription] = createSignal("");
  const [error, setError] = createSignal("");

  const address = () => (slugEdited() ? slug() : slugify(name()));
  const valid = () => name().trim().length >= 3 && SLUG_RE.test(address());

  const submit = async (e: Event) => {
    e.preventDefault();
    setError("");
    try {
      const board = await create.mutateAsync({
        slug: address(),
        name: name().trim(),
        description: description().trim(),
      });
      navigate(`/boards/${encodeURIComponent(board?.slug ?? address())}`);
    } catch (err) {
      setError(boardsErrorMessage(err));
    }
  };

  return (
    <main class="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Title>New board · Loci</Title>
      <A href="/boards" class="text-sm text-muted-foreground hover:text-foreground">
        ← Boards
      </A>
      <h1 class="mt-2 text-3xl">Open a board</h1>
      <p class="mt-1 text-muted-foreground">
        One topic travellers on Loci will want to talk about: a city, a kind of trip, a way of
        travelling.
      </p>

      <SanctionBanner sanction={session.sanction()} />

      <Show
        when={session.signedIn()}
        fallback={
          <p class="mt-6">
            <A href="/auth/signin" class="font-medium text-primary underline">
              Sign in
            </A>{" "}
            to open a board.
          </p>
        }
      >
        <form onSubmit={submit} class="mt-6 space-y-5">
          <TextFieldRoot>
            <Label class="mb-2 block">Name</Label>
            <TextField
              value={name()}
              onInput={(e) => setName(e.currentTarget.value.slice(0, 60))}
              placeholder="Lisbon on a budget"
              required
            />
          </TextFieldRoot>

          <TextFieldRoot>
            <Label class="mb-2 block">Address</Label>
            <div class="flex items-center gap-1 text-sm">
              <span class="text-muted-foreground">/boards/</span>
              <TextField
                value={address()}
                onInput={(e) => {
                  setSlugEdited(true);
                  setSlug(e.currentTarget.value.toLowerCase().slice(0, 32));
                }}
                placeholder="lisbon-on-a-budget"
              />
            </div>
            <Show when={address() && !SLUG_RE.test(address())}>
              <p class="mt-1 text-xs text-destructive">
                3–32 lowercase letters, numbers or dashes.
              </p>
            </Show>
          </TextFieldRoot>

          <TextFieldRoot>
            <Label class="mb-2 block">What it's for (optional)</Label>
            <TextArea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value.slice(0, 500))}
              rows={3}
            />
          </TextFieldRoot>

          <Show when={error()}>
            <p class="text-sm text-destructive" role="alert">
              {error()}
            </p>
          </Show>

          <Button type="submit" disabled={!valid() || create.isPending || !!session.sanction()}>
            Open board
          </Button>
        </form>
      </Show>
    </main>
  );
}
