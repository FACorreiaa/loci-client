// Chat-platform linking over MessagingService.
//
// Linking is a three-step handshake and the shape of these hooks follows it:
// the client asks for a short code, the user sends that code to the bot, and
// the bot tells the server which chat it came from. Nothing here can link an
// account on its own — the proof that somebody controls the chat is the message
// they send from it.
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import {
  CreateLinkCodeRequestSchema,
  GetLinkRequestSchema,
  MessagingService,
  UnlinkRequestSchema,
  type Link,
} from "@buf/loci_loci-proto.bufbuild_es/loci/messaging/messaging_pb.js";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { create } from "@bufbuild/protobuf";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

const messagingClient = createClient(MessagingService, transport);

/** The only platform wired end to end today. */
export const TELEGRAM = "telegram";

export const messagingLinkQueryKey = (platform: string) => ["messaging-link", platform] as const;

export interface MessagingLinkView {
  platform: string;
  /** The chat's own name for itself — an @handle or a display name. */
  displayName: string;
  linkedAt?: number;
  lastSeenAt?: number;
}

export interface MessagingLinkState {
  /** Null when this account has no link on this platform. */
  link: MessagingLinkView | null;
  /**
   * The bot to send the code to. Empty when the deployment has no bot token,
   * which is the one case where the whole card should stay disabled: a code
   * with nowhere to send it is worse than no code.
   */
  botHandle: string;
}

function tsToMillis(ts?: Timestamp): number | undefined {
  if (!ts) return undefined;
  return Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000);
}

function toLinkView(l: Link): MessagingLinkView {
  return {
    platform: l.platform,
    displayName: l.displayName,
    linkedAt: tsToMillis(l.linkedAt),
    lastSeenAt: tsToMillis(l.lastSeenAt),
  };
}

export function useMessagingLink(platform: string = TELEGRAM) {
  return useAppQuery(() => ({
    queryKey: messagingLinkQueryKey(platform),
    queryFn: async (): Promise<MessagingLinkState> => {
      const resp = await messagingClient.getLink(create(GetLinkRequestSchema, { platform }));
      return {
        link: resp.link ? toLinkView(resp.link) : null,
        botHandle: resp.botHandle,
      };
    },
    staleTime: 30_000,
  }));
}

export interface MessagingLinkCode {
  code: string;
  expiresAt?: number;
  botHandle: string;
  /** Deep link that opens the bot with the code already in the message box. */
  deepLink: string;
}

export function useCreateMessagingLinkCode(platform: string = TELEGRAM) {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (): Promise<MessagingLinkCode> => {
      const resp = await messagingClient.createLinkCode(
        create(CreateLinkCodeRequestSchema, { platform }),
      );
      return {
        code: resp.code,
        expiresAt: tsToMillis(resp.expiresAt),
        botHandle: resp.botHandle,
        deepLink: telegramDeepLink(resp.botHandle, resp.code),
      };
    },
    onSuccess: () => {
      // The link appears once the bot reports the chat, so the card polls this
      // query while a code is outstanding.
      queryClient.invalidateQueries({ queryKey: messagingLinkQueryKey(platform) });
    },
  }));
}

export function useUnlinkMessaging(platform: string = TELEGRAM) {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (): Promise<void> => {
      await messagingClient.unlink(create(UnlinkRequestSchema, { platform }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingLinkQueryKey(platform) });
    },
  }));
}

/**
 * telegramDeepLink builds the `t.me` URL that opens the bot with the start
 * payload filled in, so the user taps once instead of copying a code between
 * two apps.
 *
 * Returns an empty string when there is no bot to open, which is the signal to
 * fall back to showing the code on its own.
 */
export function telegramDeepLink(botHandle: string, code: string): string {
  const handle = botHandle.replace(/^@/, "").trim();
  if (!handle || !code) return "";
  return `https://t.me/${encodeURIComponent(handle)}?start=${encodeURIComponent(code)}`;
}
