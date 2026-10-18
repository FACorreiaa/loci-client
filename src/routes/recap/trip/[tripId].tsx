import { Show, createEffect, createSignal } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A, useNavigate, useParams } from "@solidjs/router";
import { Download, Link2, Loader2 } from "lucide-solid";
import { ProtectedRoute } from "~/contexts/AuthContext";
import StoryPlayer from "~/components/recap/StoryPlayer";
import { Button } from "~/ui/button";
import {
  RecapStatus,
  markRecapViewed,
  renderRecapCard,
  useShareRecap,
  useTripRecap,
  type Recap,
  type RecapCard,
} from "~/lib/api/recap";
import { shareFiles, shareNative } from "~/lib/share";
import { copyText } from "~/lib/clipboard";
import { showToast } from "~/lib/toast-store";
import { capture } from "~/lib/analytics";

function RecapActions(props: { recap: Recap; card: RecapCard; tripId: string }) {
  const share = useShareRecap();
  const [saving, setSaving] = createSignal(false);

  const saveImage = async () => {
    setSaving(true);
    try {
      const blob = await renderRecapCard(props.recap.id, props.card.id);
      const file = new File(
        [blob],
        `loci-${props.recap.title}-${props.card.id}.png`.replace(/\s+/g, "-"),
        {
          type: "image/png",
        },
      );
      const res = await shareFiles([file], { title: `${props.recap.title} · Loci` });
      if (res === "shared" || res === "downloaded") capture("recap_shared", { kind: "image" });
    } catch {
      showToast({ id: "recap-image", title: "Couldn't make the image. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const shareLink = async () => {
    const res = await share
      .mutateAsync({ recapId: props.recap.id, tripId: props.tripId })
      .catch(() => undefined);
    if (!res) {
      showToast({ id: "recap-link", title: "Couldn't make a link. Try again." });
      return;
    }
    const sent = await shareNative({
      title: `My ${props.recap.title} recap`,
      cityName: props.recap.title,
      url: res.url,
      text: `My ${props.recap.title} recap, made with Loci.`,
    });
    if (sent === "unavailable" || sent === "failed") {
      const ok = await copyText(res.url);
      showToast({ id: "recap-link", title: ok ? "Link copied" : res.url });
    }
  };

  return (
    <>
      <button type="button" class="rc-btn" disabled={saving()} onClick={saveImage}>
        <Download size={14} aria-hidden="true" />
        {saving() ? "Making…" : "Save image"}
      </button>
      <button
        type="button"
        class="rc-btn"
        data-primary
        disabled={share.isPending}
        onClick={shareLink}
      >
        <Link2 size={14} aria-hidden="true" />
        {share.isPending ? "Sharing…" : "Share link"}
      </button>
    </>
  );
}

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
