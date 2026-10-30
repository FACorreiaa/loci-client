import { Component, Show } from "solid-js";
import { MessageCircle, X } from "lucide-solid";
import { Portal } from "solid-js/web";

interface ChatFabProps {
  onClick: () => void;
  isOpen?: boolean;
}

export const ChatFab: Component<ChatFabProps> = (props) => {
  return (
    <Portal>
      <button
        onClick={props.onClick}
        class={`
            fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95
            ${props.isOpen ? "bg-secondary text-secondary-foreground rotate-90" : "bg-primary text-primary-foreground hover:bg-primary/90"}
        `}
        aria-label={props.isOpen ? "Close chat" : "Open chat"}
      >
        <Show when={props.isOpen} fallback={<MessageCircle class="h-6 w-6" />}>
          <X class="h-6 w-6" />
        </Show>
      </button>
    </Portal>
  );
};
