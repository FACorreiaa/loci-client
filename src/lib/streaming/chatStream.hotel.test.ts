// The hotel comparison payload, and the capability that asks for it.
import { describe, expect, it, vi } from "vitest";

const { streamChat } = vi.hoisted(() => ({ streamChat: vi.fn() }));

vi.mock("@/lib/api", () => ({ chatService: { streamChat } }));
vi.mock("@/lib/connect-transport", () => ({
  refreshSession: vi.fn(async () => false),
  transport: {},
}));
vi.mock("~/lib/analytics", () => ({ capture: vi.fn() }));

import { create } from "@bufbuild/protobuf";
import {
  ClientCapability,
  StreamEventSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { buildRequest, mapProtoEvent, streamChatEvents } from "./chatStream";

const reportEvent = create(StreamEventSchema, {
  eventId: "e2",
  payload: {
    case: "hotelComparison",
    value: {
      report: {
        id: "r1",
        cityName: "Barcelona",
        verdict: "Verdi 254 is the better base.",
        recommendedIndex: 0,
        stayProposalId: "p1",
        hotels: [
          { identified: true, stay: { cityName: "Barcelona", name: "Verdi 254" } },
          { identified: false, stay: { cityName: "Barcelona", name: "Barcelona City North" } },
        ],
        rows: [{ label: "You said", values: ["385 euros with breakfast", "349 without"] }],
      },
    },
  },
});

describe("hotel comparison on the chat stream", () => {
  it("maps the payload to a hotel_comparison event carrying the report", () => {
    const e = mapProtoEvent(reportEvent);
    expect(e?.kind).toBe("hotel_comparison");
    if (e?.kind !== "hotel_comparison") throw new Error("wrong kind");
    expect(e.report.id).toBe("r1");
    expect(e.report.hotels.map((h) => h.stay?.name)).toEqual(["Verdi 254", "Barcelona City North"]);
    expect(e.report.recommendedIndex).toBe(0);
    expect(e.report.stayProposalId).toBe("p1");
  });

  it("ignores a payload with no report in it", () => {
    const empty = create(StreamEventSchema, {
      payload: { case: "hotelComparison", value: {} },
    });
    expect(mapProtoEvent(empty)).toBeNull();
  });

  it("a request lists the capability only when its surface opts in", () => {
    expect(buildRequest({ message: "hi", rendersHotelComparison: true }).capabilities).toEqual([
      ClientCapability.HOTEL_COMPARISON,
    ]);
    expect(buildRequest({ message: "hi" }).capabilities).toEqual([]);
    expect(
      buildRequest({ message: "more", sessionId: "s", resumeToken: "e1", tripId: "t" })
        .capabilities,
    ).toEqual([]);
    expect(buildRequest({ message: "hi", rendersHotelComparison: false }).capabilities).toEqual([]);
  });

  it("the request that reaches StreamChat carries the capability, and the report is yielded", async () => {
    streamChat.mockReturnValue(
      (async function* () {
        yield reportEvent;
        yield create(StreamEventSchema, {
          eventId: "e3",
          payload: { case: "complete", value: { sessionId: "s1" } },
        });
      })(),
    );
    const kinds: string[] = [];
    for await (const e of streamChatEvents({
      message: "which hotel?",
      rendersHotelComparison: true,
    }))
      kinds.push(e.kind);
    expect(kinds).toEqual(["hotel_comparison", "complete"]);
    expect(streamChat.mock.calls[0][0].capabilities).toEqual([ClientCapability.HOTEL_COMPARISON]);
  });
});
