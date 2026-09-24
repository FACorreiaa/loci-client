// Standing tasks ("watches") — WatchService in loci/chat/chat.proto.
//
// ProposeWatch reads a schedule and a task out of a chat message and stores
// nothing; CreateWatch stores it and posts the agent's confirmation into the
// thread (origin PROACTIVE, label "Standing task"), which it also returns so
// the open chat can show it without refetching the session.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import {
  CreateWatchRequestSchema,
  DeleteWatchRequestSchema,
  ListWatchesRequestSchema,
  MessageOrigin,
  MessageRole,
  ProposeWatchRequestSchema,
  WatchService,
  type ConversationMessage,
  type Watch,
  type WatchProposal,
} from "@buf/loci_loci-proto.bufbuild_es/loci/chat/chat_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import type { ChatMessage } from "~/lib/hooks/useChat";

export type { Watch, WatchProposal };

const watchClient = createClient(WatchService, transport);

/** The four calls the chat makes. Components take this so tests can fake it. */
export interface WatchApi {
  propose(text: string, timezone: string): Promise<WatchProposal>;
  create(
    sessionId: string,
    proposal: WatchProposal,
  ): Promise<{ watch?: Watch; confirmation?: ConversationMessage }>;
  list(sessionId?: string): Promise<Watch[]>;
  remove(id: string): Promise<void>;
}

export const watchApi: WatchApi = {
  async propose(text, timezone) {
    const res = await watchClient.proposeWatch(
      create(ProposeWatchRequestSchema, { text, timezone }),
    );
    if (!res.proposal) throw new ConnectError("no proposal returned", Code.Internal);
    return res.proposal;
  },
  async create(sessionId, proposal) {
    const res = await watchClient.createWatch(
      create(CreateWatchRequestSchema, { sessionId, proposal }),
    );
    return { watch: res.watch, confirmation: res.confirmation };
  },
  async list(sessionId) {
    const res = await watchClient.listWatches(
      create(ListWatchesRequestSchema, { sessionId: sessionId ?? "" }),
    );
    return res.watches;
  },
  async remove(id) {
    await watchClient.deleteWatch(create(DeleteWatchRequestSchema, { id }));
  },
};

/** The browser's IANA zone, so "every morning" means the user's morning. */
export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** UNSPECIFIED (every message stored before the field existed) reads as a reply. */
export const originOf = (origin: MessageOrigin | undefined): "reply" | "proactive" =>
  origin === MessageOrigin.PROACTIVE ? "proactive" : "reply";

const tsToDate = (ts?: { seconds: bigint; nanos: number }): Date =>
  ts ? new Date(Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000)) : new Date();

/** A server ConversationMessage (e.g. CreateWatch's confirmation) as a chat bubble. */
export const toChatMessage = (msg: ConversationMessage): ChatMessage => ({
  id: msg.id || `proactive-${Date.now()}`,
  type: msg.role === MessageRole.USER ? "user" : "assistant",
  content: msg.content,
  timestamp: tsToDate(msg.timestamp),
  origin: originOf(msg.origin),
  sourceLabel: msg.sourceLabel || undefined,
});

type WatchAction = "create" | "delete" | "list";

/** Friendly copy per WatchService error code. */
export function watchErrorMessage(err: unknown, action: WatchAction): string {
  const code = ConnectError.from(err).code;
  switch (code) {
    case Code.Unauthenticated:
      return "Sign in again to manage standing tasks.";
    case Code.ResourceExhausted:
      return "You already have 10 standing tasks. Remove one under Standing tasks, then try again.";
    case Code.NotFound:
      return action === "delete"
        ? "That standing task was already removed."
        : "This conversation isn't saved yet. Send one more message, then confirm again.";
    case Code.InvalidArgument:
      return action === "create"
        ? "I couldn't set that up as written. Try saying what to watch and how often."
        : "That request didn't look right. Try again.";
    default:
      return action === "list"
        ? "Standing tasks aren't available right now."
        : "Standing tasks aren't available right now. Try again in a moment.";
  }
}

const watchesKey = ["watches"] as const;

export const useWatches = () =>
  useAppQuery(() => ({
    queryKey: watchesKey,
    queryFn: () => watchApi.list(),
    staleTime: 30 * 1000,
    retry: false,
  }));

export const useDeleteWatch = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: (id: string) => watchApi.remove(id),
    // NotFound means it is already gone; refetch either way.
    onSettled: () => queryClient.invalidateQueries({ queryKey: watchesKey }),
  }));
};

/** After CreateWatch, so the sidebar list picks the new task up. */
export const invalidateWatches = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: watchesKey });
