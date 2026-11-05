// The assistant you can ask from anywhere (AssistantService). The server does the
// looking up; this sends a question and carries out the cards the person accepts.
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import {
  AskAssistantRequestSchema,
  AssistantService,
  ConfirmActionRequestSchema,
  DismissActionRequestSchema,
  InputMode,
  Surface,
  type AssistantEvent,
} from "@buf/loci_loci-proto.bufbuild_es/loci/assistant/assistant_pb.js";
import type { TripDraft } from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { transport } from "../connect-transport";
import type { ScreenContext } from "../assistant/context";

const client = createClient(AssistantService, transport);

export interface AskParams {
  conversationId?: string;
  text: string;
  voice: boolean;
  screen: ScreenContext;
  latitude?: number;
  longitude?: number;
}

/** Components take this so tests can fake it. */
export interface AssistantApi {
  ask(params: AskParams, signal: AbortSignal): AsyncIterable<AssistantEvent>;
  confirm(
    proposalId: string,
    optionIndex?: number,
  ): Promise<{ confirmation: string; trip?: TripDraft }>;
  dismiss(proposalId: string): Promise<void>;
}

export const assistantApi: AssistantApi = {
  ask(params, signal) {
    return client.askAssistant(
      create(AskAssistantRequestSchema, {
        conversationId: params.conversationId,
        text: params.text,
        inputMode: params.voice ? InputMode.VOICE : InputMode.TYPED,
        context: {
          surface: Surface.WEB,
          screen: params.screen.screen,
          entities: params.screen.entities,
          // No default location: a guessed one reads as a confident answer about
          // the wrong city.
          latitude: params.latitude,
          longitude: params.longitude,
          locale: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
      { signal },
    );
  },
  async confirm(proposalId, optionIndex) {
    const res = await client.confirmAction(
      create(ConfirmActionRequestSchema, { proposalId, optionIndex }),
    );
    return { confirmation: res.confirmation, trip: res.trip };
  },
  async dismiss(proposalId) {
    await client.dismissAction(create(DismissActionRequestSchema, { proposalId }));
  },
};
