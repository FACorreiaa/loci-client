import { Show, Suspense, createMemo, createSignal, type Component } from "solid-js";
import ChatInterface, { type ChatInterfaceMessage } from "~/components/ui/ChatInterface";
import TripActionCard from "~/components/chat/TripActionCard";
import { useChatSession } from "~/lib/hooks/useChatSession";
import { useChat } from "~/lib/hooks/useChat";
import type { Trip } from "~/lib/api/trips";

/** The trip an itinerary page is a view of, as far as its chat needs it. */
export interface FloatingChatTrip {
  id: string;
  version: bigint;
  /** The trip is someone else's: changes go to its owner as suggestions. */
  suggestOnly?: boolean;
}

interface FloatingChatProps {
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

const sendOnEnter = (send: () => void) => (e: KeyboardEvent) => {
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

/** Follow-ups that propose changes to the trip, each one confirmed on a card. */
const TripChat: Component<FloatingChatProps & { trip: FloatingChatTrip }> = (props) => {
  const chat = useChat({ tripId: () => props.trip.id, embedded: true });
  const [showChat, setShowChat] = createSignal(false);

  const history = createMemo<ChatInterfaceMessage[]>(() =>
    chat.messages().map((message) => {
      const proposal = message.type === "trip-action" ? message.tripAction : undefined;
      return {
        type: message.type === "user" || message.type === "error" ? message.type : "assistant",
        content: message.content,
        timestamp: message.timestamp,
        card: proposal
          ? () => (
              <TripActionCard
                proposal={proposal}
                baseVersion={props.trip.version}
                suggestion={props.trip.suggestOnly}
                onConflict={() => props.onTripStale?.()}
                onApplied={(trip, confirmation) => {
                  chat.applyTripAction(message.id, trip, confirmation);
                  props.onTripChanged?.(trip, proposal.action?.kind.case ?? "unknown");
                }}
                onDismissed={() => chat.dismissTripAction(message.id)}
              />
            )
          : undefined,
      };
    }),
  );

  return (
    <ChatInterface
      showChat={showChat()}
      setShowChat={setShowChat}
      chatMessage={chat.currentMessage()}
      setChatMessage={chat.setCurrentMessage}
      chatHistory={history()}
      isLoading={chat.isLoading()}
      sendChatMessage={() => void chat.sendMessage()}
      handleKeyPress={sendOnEnter(() => void chat.sendMessage())}
      title="Ask Loci"
      placeholder="Add a coffee stop on day 2, swap two stops…"
      emptyStateTitle="Change this trip in words"
      emptyStateSubtitle="Say what to add, move or drop. Nothing changes until you confirm."
      loadingMessage={chat.streamProgress() || "Thinking…"}
    />
  );
};

export const FloatingChat: Component<FloatingChatProps> = (props) => (
  <Show when={props.trip} fallback={<SessionChat {...props} />}>
    {(trip) => (
      // The trip chat reads the traveller's profiles; its own boundary keeps
      // that wait from blanking the page around it.
      <Suspense>
        <TripChat {...props} trip={trip()} />
      </Suspense>
    )}
  </Show>
);

export default FloatingChat;
