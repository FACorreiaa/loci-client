import { Show, createEffect } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { Loader2 } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import RecapActions from "~/components/recap/RecapActions";
import StoryPlayer from "~/components/recap/StoryPlayer";
import { Button } from "~/ui/button";
import { RecapStatus, markRecapViewed, useYearInReview } from "~/lib/api/recap";
import { capture } from "~/lib/analytics";

/** A year the server can answer for: 2024 up to next year. */
const parseYear = (raw: string | undefined): number | undefined => {
  const y = Number(raw);
  return Number.isInteger(y) && y >= 2024 && y <= new Date().getFullYear() + 1 ? y : undefined;
};

function YearRecapPage() {
  const params = useParams<{ year: string }>();
  const navigate = useNavigate();
  const year = () => parseYear(params.year);
  const query = useYearInReview(year);
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
      capture("recap_opened", { kind: "owner_year" });
    }
  });

  return (
    <main class="min-h-[70vh]">
      <Title>{`${year() ?? "Your year"} in Loci`}</Title>
      <Meta name="robots" content="noindex" />

      <Show when={!year()}>
        <section class="loci-card mx-auto mt-12 max-w-lg p-8 text-center">
          <h1 class="text-2xl">No year in review here</h1>
          <p class="mt-2 text-muted-foreground">That isn't a year Loci has a story for.</p>
          <Button as={A} href="/trips" class="mt-6">
            Your trips
          </Button>
        </section>
      </Show>

      <Show when={query.isLoading}>
        <div class="grid place-items-center py-24 text-muted-foreground">
          <Loader2 class="h-6 w-6 animate-spin" aria-label="Building your year" />
          <p class="mt-3 text-sm">Putting your year together…</p>
        </div>
      </Show>

      <Show when={query.isError}>
        <section class="loci-card mx-auto mt-12 max-w-lg p-8 text-center">
          <h1 class="text-2xl">Couldn't load your year</h1>
          <p class="mt-2 text-muted-foreground">Try again in a moment.</p>
          <Button as={A} href="/trips" class="mt-6">
            Your trips
          </Button>
        </section>
      </Show>

      <Show when={recap() && !ready()}>
        <section class="loci-card mx-auto mt-12 max-w-lg p-8 text-center">
          <p class="text-xs uppercase tracking-widest text-muted-foreground">{year()} in Loci</p>
          <h1 class="mt-2 text-2xl">Not quite yet</h1>
          <p class="mt-2 text-muted-foreground">
            {recap()?.ineligibleReason || "Your year in review opens on 1 December."}
          </p>
          <Button as={A} href="/trips" class="mt-6">
            Plan a trip
          </Button>
        </section>
      </Show>

      <Show when={ready()} keyed>
        {(r) => (
          <StoryPlayer
            recap={r}
            onClose={() => navigate("/trips")}
            actions={(card) => <RecapActions recap={r} card={card} year={year()} />}
          />
        )}
      </Show>
    </main>
  );
}

export default function YearRecapRoute() {
  return (
    <ProtectedRoute>
      <YearRecapPage />
    </ProtectedRoute>
  );
}
