import { Show } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { ArrowUpRight, Loader2 } from "lucide-solid";
import { useSharedContent } from "~/lib/api/share";
import { describeSharedContent, sharedContentPage } from "~/lib/share/shared-content";

/**
 * A share link opened in a browser (web: the API's OG page sends people here;
 * iOS opens the same link in the app). A summary card, then the real page.
 */
export default function SharedContentPage() {
  const params = useParams<{ code: string }>();
  const query = useSharedContent(() => params.code);
  const content = () => (query.isSuccess ? query.data : undefined);
  const words = () => (content() ? describeSharedContent(content()!) : undefined);
  const page = () => (content() ? sharedContentPage(content()!) : null);

  return (
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Title>{`${words()?.title ?? "Shared with you"} · Loci`}</Title>
      <Meta name="robots" content="noindex" />

      <Show when={query.isLoading}>
        <div class="grid place-items-center py-24 text-muted-foreground">
          <Loader2 class="h-6 w-6 animate-spin" aria-label="Loading" />
        </div>
      </Show>

      <Show when={query.isError}>
        <section class="loci-card mx-auto max-w-lg p-8 text-center">
          <h1 class="text-2xl">This link has expired</h1>
          <p class="mt-2 text-muted-foreground">Ask whoever sent it for a fresh one.</p>
          <A href="/discover" class="mt-6 inline-block text-sm underline">
            Discover places instead
          </A>
        </section>
      </Show>

      <Show when={words()}>
        {(w) => (
          <section class="loci-card p-6">
            <p class="font-coord text-[10px] uppercase tracking-wider text-muted-foreground">
              {w().kicker}
            </p>
            <h1 class="mt-1 text-2xl">{w().title}</h1>
            <Show when={w().detail}>
              <p class="mt-2 text-sm text-muted-foreground">{w().detail}</p>
            </Show>
            <Show when={w().summary}>
              <p class="mt-2 font-coord text-[10px] uppercase tracking-wider text-muted-foreground">
                {w().summary}
              </p>
            </Show>
            <Show when={page()}>
              {(href) => (
                <A
                  href={href()}
                  class="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Open it <ArrowUpRight class="h-4 w-4" aria-hidden="true" />
                </A>
              )}
            </Show>
          </section>
        )}
      </Show>
    </main>
  );
}
