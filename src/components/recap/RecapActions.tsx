import { createSignal } from "solid-js";
import { Download, Link2 } from "lucide-solid";
import { renderRecapCard, useShareRecap, type Recap, type RecapCard } from "~/lib/api/recap";
import { recapName } from "~/lib/recap/recap";
import { shareFiles, shareNative } from "~/lib/share";
import { copyText } from "~/lib/clipboard";
import { showToast } from "~/lib/toast-store";
import { capture } from "~/lib/analytics";

/** The owner's buttons under a card: save it as an image, share the recap's link. */
export default function RecapActions(props: {
  recap: Recap;
  card: RecapCard;
  tripId?: string;
  year?: number;
}) {
  const share = useShareRecap();
  const [saving, setSaving] = createSignal(false);
  const name = () => recapName(props.recap);

  const saveImage = async () => {
    setSaving(true);
    try {
      const blob = await renderRecapCard(props.recap.id, props.card.id);
      const file = new File([blob], `loci-${name()}-${props.card.id}.png`.replace(/\s+/g, "-"), {
        type: "image/png",
      });
      const res = await shareFiles([file], { title: `${name()} · Loci` });
      if (res === "shared" || res === "downloaded") capture("recap_shared", { kind: "image" });
    } catch {
      showToast({ id: "recap-image", title: "Couldn't make the image. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const shareLink = async () => {
    const res = await share
      .mutateAsync({ recapId: props.recap.id, tripId: props.tripId, year: props.year })
      .catch(() => undefined);
    if (!res) {
      showToast({ id: "recap-link", title: "Couldn't make a link. Try again." });
      return;
    }
    const sent = await shareNative({
      title: `My ${name()}`,
      cityName: props.recap.title,
      url: res.url,
      text: `My ${name()}, made with Loci.`,
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
