import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  CalendarService,
  CalendarProvider,
  CalendarEventSource,
  StartCalendarConnectRequestSchema,
  CompleteCalendarConnectRequestSchema,
  ListCalendarConnectionsRequestSchema,
  DisconnectCalendarRequestSchema,
  ListCalendarEventsRequestSchema,
  PushTripToCalendarRequestSchema,
  GetTripCalendarFeedUrlRequestSchema,
  type CalendarConnection,
  type CalendarEvent,
} from "@buf/loci_loci-proto.bufbuild_es/loci/calendar/calendar_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";

export { CalendarProvider, CalendarEventSource };
export type { CalendarConnection, CalendarEvent };

const client = createClient(CalendarService, transport);

export const calendarKeys = {
  connections: () => ["calendar", "connections"] as const,
  events: (from: string, to: string) => ["calendar", "events", from, to] as const,
  feed: () => ["calendar", "feed"] as const,
};

function openOAuthPopup(url: string, title: string): Window | null {
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(url, title, `width=${width},height=${height},left=${left},top=${top},popup=1`);
}

function waitForOAuthCallback(popup: Window | null): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new Error("Failed to open popup window"));
      return;
    }
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth-callback") return;
      window.removeEventListener("message", handleMessage);
      clearInterval(checkClosed);
      popup.close();
      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }
      resolve({ code: event.data.code, state: event.data.state });
    };
    window.addEventListener("message", handleMessage);
  });
}

const callbackPath = (provider: CalendarProvider) =>
  provider === CalendarProvider.CALENDLY ? "calendly" : "google-calendar";

export const useCalendarConnections = () =>
  useAppQuery(() => ({
    queryKey: calendarKeys.connections(),
    queryFn: async () => {
      const res = await client.listCalendarConnections(
        create(ListCalendarConnectionsRequestSchema, {}),
      );
      return res.connections;
    },
  }));

export const useCalendarEvents = (from: () => Date, to: () => Date) =>
  useAppQuery(() => ({
    queryKey: calendarKeys.events(from().toISOString(), to().toISOString()),
    queryFn: async () => {
      const res = await client.listCalendarEvents(
        create(ListCalendarEventsRequestSchema, {
          from: timestampFromDate(from()),
          to: timestampFromDate(to()),
        }),
      );
      return res.events;
    },
  }));

export const useCalendarFeedUrl = () =>
  useAppQuery(() => ({
    queryKey: calendarKeys.feed(),
    queryFn: async () => {
      const res = await client.getTripCalendarFeedUrl(
        create(GetTripCalendarFeedUrlRequestSchema, {}),
      );
      return res.url;
    },
  }));

export const useConnectCalendar = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (provider: CalendarProvider) => {
      const path = callbackPath(provider);
      const redirectUri = `${window.location.origin}/auth/oauth/${path}/callback`;
      const start = await client.startCalendarConnect(
        create(StartCalendarConnectRequestSchema, { provider, redirectUri }),
      );
      const popup = openOAuthPopup(
        start.authUrl,
        provider === CalendarProvider.CALENDLY ? "Connect Calendly" : "Connect Google Calendar",
      );
      const { code, state } = await waitForOAuthCallback(popup);
      return client.completeCalendarConnect(
        create(CompleteCalendarConnectRequestSchema, {
          provider,
          code,
          state: state || start.state,
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  }));
};

export const useDisconnectCalendar = () => {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (connectionId: string) => {
      await client.disconnectCalendar(create(DisconnectCalendarRequestSchema, { connectionId }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  }));
};

export const usePushTripToCalendar = () =>
  useMutation(() => ({
    mutationFn: async (input: { tripId: string; connectionId: string }) => {
      const res = await client.pushTripToCalendar(create(PushTripToCalendarRequestSchema, input));
      return res.eventIds;
    },
  }));

export function eventDateKey(ev: CalendarEvent): string | undefined {
  if (!ev.start) return undefined;
  const d = timestampDate(ev.start);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toWebcal(httpsUrl: string): string {
  if (httpsUrl.startsWith("https://")) return "webcal://" + httpsUrl.slice("https://".length);
  if (httpsUrl.startsWith("http://")) return "webcal://" + httpsUrl.slice("http://".length);
  return httpsUrl;
}
