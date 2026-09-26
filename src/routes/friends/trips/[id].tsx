import { Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { CopyPlus, Loader2 } from "lucide-solid";
import SharedTripView from "~/components/social/SharedTripView";
import { Button } from "~/ui/button";
import { useAuth } from "~/contexts/AuthContext";
import { useCopyTrip, useFriendTrip } from "~/lib/api/trips";

/** A friend's (or a public) trip, opened from the feed or a profile. */
export default function FriendTripPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const tripQuery = useFriendTrip(() => params.id);
  const copy = useCopyTrip();
  const trip = () => (tripQuery.isSuccess ? tripQuery.data : undefined);

  const copyTrip = () => {
    if (!isAuthenticated()) {
      navigate(`/auth/signin?returnTo=${encodeURIComponent(`/friends/trips/${params.id}`)}`);
      return;
    }
    copy.mutate({ tripId: params.id }, { onSuccess: (id) => navigate(`/trips/${id}`) });
  };

  return (
    <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Title>{`${trip()?.title ?? "A friend's trip"} · Loci`}</Title>
      <Show when={tripQuery.isLoading}>
        <div class="grid place-items-center py-24 text-muted-foreground">
          <Loader2 class="h-6 w-6 animate-spin" aria-label="Loading trip" />
        </div>
      </Show>
      <Show when={tripQuery.isError}>
        <section class="loci-card mx-auto max-w-lg p-8 text-center">
          <h1 class="text-2xl">You can't see this trip</h1>
          <p class="mt-2 text-muted-foreground">
            It may be private now, or you're no longer friends with its owner.
          </p>
          <Button as={A} href="/friends" class="mt-6">
            Back to friends
          </Button>
        </section>
      </Show>
      <Show when={trip()}>
        {(t) => (
          <SharedTripView
            trip={t()}
            actions={
              <Button class="gap-1.5" disabled={copy.isPending} onClick={copyTrip}>
                <CopyPlus class="h-4 w-4" aria-hidden="true" />
                {copy.isPending ? "Copying…" : "Copy to my trips"}
              </Button>
            }
          />
        )}
      </Show>
    </main>
  );
}
