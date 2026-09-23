import { Component } from "solid-js";
import { Menu, Plus } from "lucide-solid";

export interface ChatHeaderProps {
  onNewChat: () => void;
  /** Opens the chat-history drawer on mobile. */
  onToggleSidebar?: () => void;
  /** Agent name under the avatar. */
  name?: string;
  /** Status line under the name. Stage A is always "Ready". */
  status?: string;
}

const MASCOT_SRC = "/images/brand/mascot.webp";
const MASCOT_SRCSET = "/images/brand/mascot-sm.webp 303w, /images/brand/mascot.webp 606w";

/**
 * The Muse chat header (apps/_reviews/muse-chat-contract.md).
 *
 * It floats over the transcript rather than sitting above it: a 56px bar with
 * the conversation-list button and a "New chat" pill, and a 110px avatar that
 * hangs ~55px below the bar, over the top of the transcript. The transcript
 * reserves that space with its own top inset (see routes/chat/index.tsx), and
 * scrolls under a 120px canvas-to-transparent scrim so messages fade out
 * behind the avatar instead of colliding with it. The scrim is plain gradient,
 * not backdrop-blur, so it costs nothing on low-power devices.
 *
 * The overlay ignores pointer events except on its controls, so the part of
 * the transcript under the scrim can still be scrolled and selected.
 */
const ChatHeader: Component<ChatHeaderProps> = (props) => {
  const name = () => props.name ?? "Loci";
  const status = () => props.status ?? "Ready";

  return (
    <header class="pointer-events-none absolute inset-x-0 top-0 z-20" data-testid="muse-header">
      <div
        aria-hidden="true"
        class="absolute inset-x-0 top-0 h-[120px]"
        style={{ background: "linear-gradient(to bottom, var(--muse-canvas), transparent)" }}
      />

      <div class="relative flex h-14 items-center justify-between px-4">
        <button
          type="button"
          onClick={props.onToggleSidebar}
          class="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--muse-pill)] text-[var(--muse-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:invisible"
          title="Chat history"
          aria-label="Open chat history"
        >
          <Menu class="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={props.onNewChat}
          class="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-[var(--muse-pill)] px-4 text-sm font-semibold text-[var(--muse-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Start a new conversation"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          New chat
        </button>
      </div>

      <div class="absolute left-1/2 top-1 flex -translate-x-1/2 flex-col items-center">
        <div class="h-[110px] w-[110px] overflow-hidden rounded-full bg-[var(--muse-pill)] ring-4 ring-[var(--muse-canvas)]">
          <img
            src={MASCOT_SRC}
            srcset={MASCOT_SRCSET}
            sizes="110px"
            alt=""
            width={110}
            height={110}
            class="h-full w-full object-cover object-top"
            data-testid="muse-avatar"
          />
        </div>
        <div
          class="-mt-3 flex flex-col items-center rounded-full bg-[var(--muse-pill)] px-4 py-1.5 ring-4 ring-[var(--muse-canvas)]"
          role="status"
          aria-live="polite"
        >
          <h1 class="font-sans text-[15px] font-semibold leading-5 text-[var(--muse-text)]">
            {name()}
          </h1>
          <p class="text-[13px] leading-4 text-[var(--muse-text-secondary)]">{status()}</p>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
