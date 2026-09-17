import { Component, createSignal, Show, For } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Share2, Copy, Check, MessageCircle, Globe, AtSign, Send } from "lucide-solid";
import {
  shareNative,
  twitterShareUrl,
  facebookShareUrl,
  whatsappShareUrl,
  telegramShareUrl,
  copyShareToClipboard,
  type SharePayload,
} from "~/lib/share";

interface ShareMenuProps {
  payload: SharePayload;
}

/**
 * Share: the native sheet where there is one (it carries the text and the
 * Loci mark), otherwise a menu of web intents plus copy. When the native
 * sheet is missing or fails the menu opens; a deliberate cancel does nothing.
 *
 * Generic lucide glyphs stand in for brand marks lucide does not ship.
 */
export const ShareMenu: Component<ShareMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const handleClick = async () => {
    if (open()) {
      setOpen(false);
      return;
    }
    const result = await shareNative(props.payload);
    if (result === "shared" || result === "cancelled") return;
    setOpen(true);
  };

  const handleCopy = async () => {
    if (await copyShareToClipboard(props.payload)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const socialLinks = () => [
    { name: "X", icon: AtSign, url: twitterShareUrl(props.payload) },
    { name: "WhatsApp", icon: MessageCircle, url: whatsappShareUrl(props.payload) },
    { name: "Telegram", icon: Send, url: telegramShareUrl(props.payload) },
    { name: "Facebook", icon: Globe, url: facebookShareUrl(props.payload) },
  ];

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => void handleClick()}
        class="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Share"
        aria-haspopup="menu"
        aria-expanded={open()}
      >
        <Share2 class="h-4 w-4" />
      </button>

      <Show when={open()}>
        <div class="fixed inset-0 z-40" onClick={() => setOpen(false)} />

        <div
          role="menu"
          class="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-xl"
        >
          <p class="kicker px-3 py-2">share</p>

          <For each={socialLinks()}>
            {(link) => (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary"
                onClick={() => setOpen(false)}
              >
                <Dynamic component={link.icon} class="h-4 w-4 text-muted-foreground" />
                {link.name}
              </a>
            )}
          </For>

          <div class="my-1 border-t border-border" />

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleCopy()}
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <Show when={copied()} fallback={<Copy class="h-4 w-4 text-muted-foreground" />}>
              <Check class="h-4 w-4 text-primary" />
            </Show>
            {copied() ? "Copied" : "Copy text"}
          </button>
        </div>
      </Show>
    </div>
  );
};
