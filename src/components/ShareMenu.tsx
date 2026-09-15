import { Component, createSignal, Show, For } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Share2, Copy, Check, MessageCircle, Globe, AtSign } from "lucide-solid";
import {
  shareNative,
  twitterShareUrl,
  facebookShareUrl,
  whatsappShareUrl,
  copyShareToClipboard,
  type SharePayload,
} from "~/lib/share";

interface ShareMenuProps {
  payload: SharePayload;
}

/**
 * A share dropdown that shows social media options on desktop and
 * the native share sheet on mobile.
 *
 * Uses generic lucide icons since lucide doesn't ship brand icons.
 * AtSign → Twitter/X, Globe → Facebook, MessageCircle → WhatsApp.
 */
export const ShareMenu: Component<ShareMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const handleNativeShare = async () => {
    const shared = await shareNative(props.payload);
    if (shared) setOpen(false);
  };

  const handleCopy = async () => {
    const ok = await copyShareToClipboard(props.payload);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const socialLinks = () => [
    { name: "Twitter / X", icon: AtSign, url: twitterShareUrl(props.payload) },
    { name: "Facebook", icon: Globe, url: facebookShareUrl(props.payload) },
    { name: "WhatsApp", icon: MessageCircle, url: whatsappShareUrl(props.payload) },
  ];

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => {
          // On mobile, prefer native share
          if (typeof navigator.share === "function") {
            void handleNativeShare();
          } else {
            setOpen(!open());
          }
        }}
        class="p-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
        title="Share"
      >
        <Share2 class="w-4 h-4" />
      </button>

      <Show when={open()}>
        {/* Backdrop */}
        <div class="fixed inset-0 z-40" onClick={() => setOpen(false)} />

        {/* Dropdown */}
        <div class="absolute right-0 top-full mt-2 w-56 z-50 rounded-xl border border-border bg-popover p-2 shadow-xl">
          <p class="px-3 py-2 font-coord text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Share itinerary
          </p>

          <For each={socialLinks()}>
            {(link) => (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                onClick={() => setOpen(false)}
              >
                <Dynamic component={link.icon} class="w-4 h-4 text-muted-foreground" />
                {link.name}
              </a>
            )}
          </For>

          <div class="my-1 border-t border-border" />

          <button
            type="button"
            onClick={handleCopy}
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <Show when={copied()} fallback={<Copy class="w-4 h-4 text-muted-foreground" />}>
              <Check class="w-4 h-4 text-green-500" />
            </Show>
            {copied() ? "Copied!" : "Copy link"}
          </button>
        </div>
      </Show>
    </div>
  );
};
