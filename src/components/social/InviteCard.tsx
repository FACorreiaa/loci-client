import { createResource, createSignal, Show } from "solid-js";
import QRCode from "qrcode";
import { Copy, RefreshCw, Share2 } from "lucide-solid";
import { Button } from "~/ui/button";
import { useMyInvite, useRotateInvite } from "~/lib/api/social";
import { useAuthGate } from "~/lib/auth/useAuthGate";
import { copyShareLink } from "~/lib/api/share";

/**
 * Your invite link. Opening it is consent on both sides — the inviter made
 * the link, the invitee chose to open it — so it befriends in one step.
 */
export default function InviteCard() {
  const gate = useAuthGate();
  const inviteQuery = useMyInvite(() => gate());
  const rotate = useRotateInvite();
  const invite = () => (inviteQuery.isSuccess ? inviteQuery.data : undefined);
  const [copied, setCopied] = createSignal(false);

  // Rendered locally; the link is a credential, so no third-party QR service.
  const [qr] = createResource(
    () => invite()?.url,
    async (url) => {
      try {
        return await QRCode.toDataURL(url, { width: 180, margin: 1 });
      } catch {
        return null;
      }
    },
  );

  const copy = async () => {
    const url = invite()?.url;
    if (url && (await copyShareLink(url))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  const share = async () => {
    const url = invite()?.url;
    if (!url) return;
    try {
      await navigator.share({ title: "Travel with me on Loci", url });
    } catch {
      /* dismissed */
    }
  };

  const canShare = () => typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section class="loci-card p-5" aria-labelledby="invite-title">
      <h2 id="invite-title" class="text-lg font-medium">
        Invite a friend
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Anyone who opens your link becomes your friend on Loci. Show the code in person, or send the
        link.
      </p>
      <Show
        when={invite()}
        fallback={<p class="mt-4 text-sm text-muted-foreground">Making your link…</p>}
      >
        {(inv) => (
          <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Show when={qr()}>
              {(src) => (
                <img
                  src={src()}
                  alt="QR code for your invite link"
                  width="148"
                  height="148"
                  class="h-[148px] w-[148px] rounded-lg bg-white p-1"
                />
              )}
            </Show>
            <div class="min-w-0 flex-1 space-y-3">
              <input
                readOnly
                value={inv().url}
                aria-label="Invite link"
                class="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div class="flex flex-wrap gap-2">
                <Button size="sm" class="gap-1.5" onClick={() => void copy()}>
                  <Copy class="h-3.5 w-3.5" aria-hidden="true" />
                  {copied() ? "Copied" : "Copy link"}
                </Button>
                <Show when={canShare()}>
                  <Button size="sm" variant="outline" class="gap-1.5" onClick={() => void share()}>
                    <Share2 class="h-3.5 w-3.5" aria-hidden="true" />
                    Share
                  </Button>
                </Show>
                <Button
                  size="sm"
                  variant="ghost"
                  class="gap-1.5"
                  disabled={rotate.isPending}
                  onClick={() => rotate.mutate(undefined)}
                  title="The old link stops working"
                >
                  <RefreshCw class="h-3.5 w-3.5" aria-hidden="true" />
                  New link
                </Button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </section>
  );
}
