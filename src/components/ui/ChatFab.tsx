import { Component } from "solid-js";
import { MessageSquareText } from "lucide-solid";

interface ChatFabProps {
  onClick?: () => void;
}

export const ChatFab: Component<ChatFabProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      class="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-primary text-primary-foreground shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 group flex items-center justify-center border-2 border-white/20"
      title="Continue Session"
    >
      <MessageSquareText class="w-6 h-6 group-hover:rotate-12 transition-transform" />
      <span class="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 ease-in-out whitespace-nowrap font-medium">
        Chat Assistant
      </span>

      {/* Pulse effect */}
      <span class="absolute inset-0 rounded-full bg-primary opacity-20 group-hover:animate-ping -z-10" />
    </button>
  );
};
