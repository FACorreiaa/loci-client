import { createMemo, createSignal, type Component } from "solid-js";
import ChatInterface, { type ChatInterfaceMessage } from "~/components/ui/ChatInterface";
import TripActionCard from "~/components/chat/TripActionCard";
import HotelComparisonCard from "~/components/chat/HotelComparisonCard";
import { useNavigate } from "@solidjs/router";
import { sendToPlanner } from "~/lib/assistant/open-state";
import { useChat } from "~/lib/hooks/useChat";
import { sendOnEnter, type FloatingChatProps, type FloatingChatTrip } from "./FloatingChat";

/** Follow-ups that propose changes to the trip, each one confirmed on a card. */
const TripChat: Component<FloatingChatProps & { trip: FloatingChatTrip }> = (props) => {
  const chat = useChat({ tripId: () => props.trip.id, embedded: true });
  const [showChat, setShowChat] = createSignal(false);
  const navigate = useNavigate();

  const history = createMemo<ChatInterfaceMessage[]>(() =>
    chat.messages().map((message) => {
      const proposal = message.type === "trip-action" ? message.tripAction : undefined;
      const report = message.type === "hotel-report" ? message.hotelReport : undefined;
      if (report) {
        const stay = message.stayProposal;
        return {
          type: "assistant" as const,
          content: message.content,
          timestamp: message.timestamp,
          card: () => (
            <HotelComparisonCard
              report={report}
              source="trip_chat"
              compact
              proposal={stay}
              tripVersion={stay?.tripId === props.trip.id ? props.trip.version : undefined}
              added={message.stayAdded}
              onConflict={() => props.onTripStale?.()}
              onAdded={(added, trip) => {
                chat.settleHotelReport(message.id, added, trip);
                // Only this page's trip is the page's business.
                if (added.tripId === props.trip.id) props.onTripChanged?.(trip, "chooseStay");
              }}
              // This chat is about one trip; a new one is planned in the planner.
              onPlanTrip={(query, city) => {
                sendToPlanner(query, city);
                navigate("/chat");
              }}
            />
          ),
        };
      }
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
