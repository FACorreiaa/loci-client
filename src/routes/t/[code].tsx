import { Show } from "solid-js";
import { isServer } from "solid-js/web";
import { Title, Meta } from "@solidjs/meta";
import { A, createAsync, useNavigate, useParams } from "@solidjs/router";
import { CopyPlus, Loader2 } from "lucide-solid";
import SharedTripView from "~/components/social/SharedTripView";
import { Button } from "~/ui/button";
import { useAuth } from "~/contexts/AuthContext";
import { useCopyTrip, useSharedTrip } from "~/lib/api/trips";
import { fetchSharedTripMeta } from "~/lib/social/shared-meta";
import { sharedTripPath, sharedTripUrl } from "~/lib/social/visibility";

const API_BASE_URL = import.meta.env.VITE_CONNECT_BASE_URL || "http://localhost:8000";

/**
 * A trip opened by its share link. Works signed out: reading is free, and
 * "Copy to my trips" is the moment we ask someone to sign in.
 */
export default function SharedTripPage() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const tripQuery = useSharedTrip(() => params.code);
  const copy = useCopyTrip();
  // Guarded: `.data` suspends while pending.
  const trip = () => (tripQuery.isSuccess ? tripQuery.data : undefined);

  // Only the server needs this: it fills the <head> link previews read.
  // deferStream holds the first flush until it resolves; otherwise the head
  // is already sent by the time the title is known. The fetch is capped at
  // 2.5s, so a slow API delays the page at most that much.
  const meta = createAsync(
    async () => (isServer ? fetchSharedTripMeta(API_BASE_URL, params.code) : undefined),
    { deferStream: true },
  );

  const title = () => meta()?.title ?? trip()?.title ?? "A shared trip";
  const description = () =>
    meta()?.description ?? "A route planned with Loci. Open it, then make it yours.";

  const copyTrip = () => {
    if (!isAuthenticated()) {
      navigate(`/auth/signin?returnTo=${encodeURIComponent(sharedTripPath(params.code))}`);
      return;
    }
    copy.mutate({ shareCode: params.code }, { onSuccess: (id) => navigate(`/trips/${id}`) });
  };

  return (
    <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Title>{`${title()} · Loci`}</Title>
      <Meta name="description" content={description()} />
      <Meta property="og:title" content={title()} />
      <Meta property="og:description" content={description()} />
      <Meta property="og:url" content={sharedTripUrl(params.code)} />
      <Meta name="twitter:card" content="summary" />
      <Meta name="robots" content="noindex" />

      <Show when={tripQuery.isLoading}>
        <div class="grid place-items-center py-24 text-muted-foreground">
          <Loader2 class="h-6 w-6 animate-spin" aria-label="Loading trip" />
        </div>
      </Show>

      <Show when={tripQuery.isError}>
        <section class="loci-card mx-auto max-w-lg p-8 text-center">
          <h1 class="text-2xl">This trip isn't shared any more</h1>
          <p class="mt-2 text-muted-foreground">
            The link may have been turned off, or the trip made private.
          </p>
          <Button as={A} href="/" class="mt-6">
            Plan your own trip
          </Button>
        </section>
      </Show>

      <Show when={trip()}>
        {(trip) => (
          <SharedTripView
            trip={trip()}
            actions={
              <>
                <Button class="gap-1.5" disabled={copy.isPending} onClick={copyTrip}>
                  <CopyPlus class="h-4 w-4" aria-hidden="true" />
                  {copy.isPending ? "Copying…" : "Copy to my trips"}
                </Button>
                <Show when={copy.isError}>
                  <span class="text-sm text-destructive" role="alert">
                    Couldn't copy it. Try again.
                  </span>
                </Show>
              </>
            }
          />
        )}
      </Show>
    </main>
  );
}
