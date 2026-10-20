import { Show, createEffect } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { Loader2 } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import RecapActions from "~/components/recap/RecapActions";
import StoryPlayer from "~/components/recap/StoryPlayer";
import { Button } from "~/ui/button";
import { RecapStatus, markRecapViewed, useTripRecap } from "~/lib/api/recap";
import { capture } from "~/lib/analytics";

function TripRecapPage() {
  const params = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const query = useTripRecap(() => params.tripId);
  // Guarded: `.data` suspends while pending.
  const recap = () => (query.isSuccess ? query.data : undefined);
  const ready = () => {
    const r = recap();
    return r && r.status === RecapStatus.READY ? r : undefined;
  };

  let marked = false;
  createEffect(() => {
    const r = ready();
    if (r && !marked) {
      marked = true;
      markRecapViewed(r.id);
      capture("recap_opened", { kind: "owner" });
    }
  });

  const back = () => navigate(`/trips/${params.tripId}`);

  return (
    <main class="min-h-[70vh]">
      <Title>{`${recap()?.title ?? "Trip"} recap · Loci`}</Title>
      <Meta name="robots" content="noindex" />

      <Show when={query.isLoading}>
        <div class="grid place-items-center py-24 text-muted-foreground">
          <Loader2 class="h-6 w-6 animate-spin" aria-label="Building your recap" />
          <p class="mt-3 text-sm">Putting your trip together…</p>
        </div>
      </Show>

      <Show when={query.isError}>
        <section class="loci-card mx-auto mt-12 max-w-lg p-8 text-center">
          <h1 class="text-2xl">No recap for this trip</h1>
          <p class="mt-2 text-muted-foreground">It may have been deleted, or it isn't yours.</p>
          <Button as={A} href="/trips" class="mt-6">
            Your trips
          </Button>
        </section>
      </Show>

      <Show when={recap() && !ready()}>
        <section class="loci-card mx-auto mt-12 max-w-lg p-8 text-center">
          <h1 class="text-2xl">Your recap isn't ready yet</h1>
          <p class="mt-2 text-muted-foreground">
            {recap()?.ineligibleReason || "Come back once the trip is over."}
          </p>
          <Button as={A} href={`/trips/${params.tripId}`} class="mt-6">
            Back to the trip
          </Button>
        </section>
      </Show>

      <Show when={ready()} keyed>
        {(r) => (
          <StoryPlayer
            recap={r}
            onClose={back}
            actions={(card) => <RecapActions recap={r} card={card} tripId={params.tripId} />}
          />
        )}
      </Show>
    </main>
  );
}

export default function TripRecapRoute() {
  return (
    <ProtectedRoute>
      <TripRecapPage />
    </ProtectedRoute>
  );
}
