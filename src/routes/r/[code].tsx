import { Show, createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import { Title, Meta } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { Loader2 } from "lucide-solid";
import StoryPlayer from "~/components/recap/StoryPlayer";
import { Button } from "~/ui/button";
import { useSharedRecap } from "~/lib/api/recap";
import { fetchSharedRecapMeta, recapImageUrl, recapSharePath } from "~/lib/recap/recap";
import { SHARE_HOME_URL } from "~/lib/share";
import { capture } from "~/lib/analytics";

const API_BASE_URL = import.meta.env.VITE_CONNECT_BASE_URL || "http://localhost:8000";

/**
 * A trip recap opened from its share link. Works signed out, and shows only
 * the public view: cities and counts, no places, dates or friends.
 */
export default function SharedRecapPage() {
  const params = useParams<{ code: string }>();
  const query = useSharedRecap(() => params.code);
  const recap = () => (query.isSuccess ? query.data : undefined);

  // Only the server needs this: link previews read the server-rendered head.
  // deferStream holds the first flush until it resolves (capped at 2.5s).
  const meta = createAsync(
    async () => (isServer ? fetchSharedRecapMeta(API_BASE_URL, params.code) : undefined),
    { deferStream: true },
  );

  let opened = false;
  createEffect(() => {
    if (recap() && !opened) {
      opened = true;
      capture("recap_opened", { kind: "shared" });
    }
  });

  const title = () => meta()?.title ?? (recap() ? `${recap()!.title} recap` : "A trip recap");
  const description = () =>
    meta()?.description ?? "A trip, told in cards. Plan your own with Loci.";
  const image = () => meta()?.image ?? recapImageUrl(API_BASE_URL, params.code, "og");

  return (
    <main class="min-h-[70vh]">
      <Title>{`${title()} · Loci`}</Title>
      <Meta name="description" content={description()} />
      <Meta property="og:title" content={title()} />
      <Meta property="og:description" content={description()} />
      <Meta property="og:url" content={`${SHARE_HOME_URL}${recapSharePath(params.code)}`} />
      <Meta property="og:image" content={image()} />
      <Meta property="og:image:width" content="1200" />
      <Meta property="og:image:height" content="630" />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:image" content={image()} />
      <Meta name="robots" content="noindex" />

      <Show when={query.isLoading}>
        <div class="grid place-items-center py-24 text-muted-foreground">
          <Loader2 class="h-6 w-6 animate-spin" aria-label="Loading recap" />
        </div>
      </Show>

      <Show when={query.isError}>
        <section class="loci-card mx-auto mt-12 max-w-lg p-8 text-center">
          <h1 class="text-2xl">This recap isn't shared any more</h1>
          <p class="mt-2 text-muted-foreground">The link may have been turned off.</p>
          <Button as={A} href="/" class="mt-6">
            Plan your own trip
          </Button>
        </section>
      </Show>

      <Show when={recap()} keyed>
        {(r) => (
          <StoryPlayer
            recap={r}
            outroFooter={
              <A href="/" class="rc-btn" data-primary style={{ "justify-self": "start" }}>
                Plan your own trip
              </A>
            }
          />
        )}
      </Show>
    </main>
  );
}
