import { createResource, createSignal, Show } from "solid-js";
import QRCode from "qrcode";
import { Copy, MessageSquare, Share2 } from "lucide-solid";
import { Button } from "~/ui/button";
import { useMyInvite } from "~/lib/api/social";
import { useAuthGate } from "~/lib/auth/useAuthGate";
import {
  copyInviteLink,
  facebookInviteHref,
  shareInvite,
  smsInviteHref,
  type ShareableInvite,
} from "~/lib/invite";
import { capture } from "~/lib/analytics";

const hasShareSheet = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * Your invite link. Opening it is consent on both sides — the inviter made
 * the link, the invitee chose to open it — so it befriends in one step.
 *
 * Invite opens the system share sheet. Without one (most desktops), or when
 * it fails, the link can be copied, texted through the person's own phone,
 * or posted with Facebook's public sharer.
 */
export default function InviteCard() {
  const gate = useAuthGate();
  const inviteQuery = useMyInvite(() => gate());
  const invite = () => (inviteQuery.isSuccess ? inviteQuery.data : undefined);
  const [copied, setCopied] = createSignal(false);
  const [sheetFailed, setSheetFailed] = createSignal(false);
  const showFallbacks = () => !hasShareSheet() || sheetFailed();

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

  const copy = async (inv: ShareableInvite) => {
    if (await copyInviteLink(inv)) {
      capture("invite_shared", { via: "copy" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  const share = async (inv: ShareableInvite) => {
    const result = await shareInvite(inv);
    if (result === "shared") capture("invite_shared", { via: "sheet" });
    if (result === "unavailable" || result === "failed") setSheetFailed(true);
  };

  return (
    <section class="loci-card p-5" aria-labelledby="invite-title">
      <h2 id="invite-title" class="text-lg font-medium">
        Invite a friend
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Anyone who opens your link becomes your friend on Loci. Show the code in person, or send the
        link from your own phone.
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
                <Show when={hasShareSheet()}>
                  <Button size="sm" class="gap-1.5" onClick={() => void share(inv())}>
                    <Share2 class="h-3.5 w-3.5" aria-hidden="true" />
                    Invite
                  </Button>
                </Show>
                <Button
                  size="sm"
                  variant={hasShareSheet() ? "outline" : "default"}
                  class="gap-1.5"
                  onClick={() => void copy(inv())}
                >
                  <Copy class="h-3.5 w-3.5" aria-hidden="true" />
                  {copied() ? "Copied" : "Copy link"}
                </Button>
                <Show when={showFallbacks()}>
                  <Button
                    as="a"
                    href={smsInviteHref(inv())}
                    size="sm"
                    variant="outline"
                    class="gap-1.5"
                    onClick={() => capture("invite_shared", { via: "sms" })}
                  >
                    <MessageSquare class="h-3.5 w-3.5" aria-hidden="true" />
                    Text message
                  </Button>
                  <Button
                    as="a"
                    href={facebookInviteHref(inv())}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="outline"
                    onClick={() => capture("invite_shared", { via: "facebook" })}
                  >
                    Facebook
                  </Button>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>
    </section>
  );
}
