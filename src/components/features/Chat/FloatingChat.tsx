import { Show, Suspense, type Component } from "solid-js";
import ChatInterface from "~/components/ui/ChatInterface";
import { useChatSession } from "~/lib/hooks/useChatSession";
import { lazyChunk } from "~/lib/lazyChunk";
import type { Trip } from "~/lib/api/trips";

/** The trip an itinerary page is a view of, as far as its chat needs it. */
export interface FloatingChatTrip {
  id: string;
  version: bigint;
  /** The trip is someone else's: changes go to its owner as suggestions. */
  suggestOnly?: boolean;
}

export interface FloatingChatProps {
  // Optional initial message or context could be passed here
  initialMessage?: string;
  getStreamingData?: () => any;
  setStreamingData?: (data: any) => void;
  initialSessionId?: string; // Session ID from URL params for continuing sessions
  /**
   * When the page shows a trip, the chat is about that trip: a message becomes
   * a change to confirm, not a second generated itinerary.
   */
  trip?: FloatingChatTrip;
  /** A change was applied; `trip` is the trip as it now is, when the server sent it. */
  onTripChanged?: (trip: Trip | undefined, kind: string) => void;
  /** The trip moved on since a change was proposed: the page should reread it. */
  onTripStale?: () => void;
}

// Only a page that shows a trip pays for the trip chat (the chat hook and the
// change card); everything else keeps the light session chat.
const TripChat = lazyChunk(() => import("./TripChat"));

export const sendOnEnter = (send: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
};

/** Follow-ups that regenerate the itinerary in its chat session. */
const SessionChat: Component<FloatingChatProps> = (props) => {
  const {
    showChat,
    setShowChat,
    chatMessage,
    setChatMessage,
    chatHistory,
    isLoading,
    sendChatMessage,
  } = useChatSession({
    getStreamingData: props.getStreamingData,
    setStreamingData: props.setStreamingData,
    initialSessionId: props.initialSessionId,
  });

  return (
    <ChatInterface
      showChat={showChat()}
      setShowChat={setShowChat}
      chatMessage={chatMessage()}
      setChatMessage={setChatMessage}
      chatHistory={chatHistory()}
      isLoading={isLoading()}
      sendChatMessage={sendChatMessage}
      handleKeyPress={sendOnEnter(sendChatMessage)}
      title="Ask Loci"
      placeholder="Ask about places, routes, or your trip…"
    />
  );
};

export const FloatingChat: Component<FloatingChatProps> = (props) => (
  <Show when={props.trip} fallback={<SessionChat {...props} />}>
    {(trip) => (
      // The trip chat is a lazy chunk and reads the traveller's profiles; its
      // own boundary keeps either wait from blanking the page around it.
      <Suspense>
        <TripChat {...props} trip={trip()} />
      </Suspense>
    )}
  </Show>
);

export default FloatingChat;
