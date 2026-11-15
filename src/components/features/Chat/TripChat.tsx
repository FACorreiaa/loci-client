import { createMemo, createSignal, type Component } from "solid-js";
import ChatInterface, { type ChatInterfaceMessage } from "~/components/ui/ChatInterface";
import TripActionCard from "~/components/chat/TripActionCard";
import { useChat } from "~/lib/hooks/useChat";
import { sendOnEnter, type FloatingChatProps, type FloatingChatTrip } from "./FloatingChat";

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

export default TripChat;
