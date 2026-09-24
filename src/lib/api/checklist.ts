// Trip checklists (packing + expenses), synced through TripService so iOS and
// web share one list. Writes are optimistic: the cache changes first and rolls
// back if the server refuses.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import {
  TripService,
  ChecklistItemKind,
  ChecklistItemSchema,
  DeleteChecklistItemRequestSchema,
  DismissPackingSuggestionRequestSchema,
  GetTripChecklistRequestSchema,
  UpsertChecklistItemRequestSchema,
  type ChecklistItem,
} from "@buf/loci_loci-proto.bufbuild_es/loci/trip/trip_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { useAuthGate } from "../auth/useAuthGate";
import {
  clearLegacyChecklist,
  planLegacyImport,
  readLegacyChecklist,
  sortEntries,
  type ChecklistEntry,
} from "../trip-checklist/checklist";

const tripClient = createClient(TripService, transport);

export interface TripChecklist {
  items: ChecklistEntry[];
  dismissed: string[];
}

export const checklistKey = (tripId: string) => ["trips", "checklist", tripId] as const;

const fromProto = (i: ChecklistItem): ChecklistEntry => ({
  id: i.id,
  kind: i.kind === ChecklistItemKind.EXPENSE ? "expense" : "packing",
  text: i.text,
  done: i.done,
  amountMinor: Number(i.amountMinor),
  currency: i.currency,
  position: i.position,
});

const toProto = (e: ChecklistEntry) =>
  create(ChecklistItemSchema, {
    id: e.id,
    kind: e.kind === "expense" ? ChecklistItemKind.EXPENSE : ChecklistItemKind.PACKING,
    text: e.text,
    done: e.done,
    amountMinor: BigInt(e.amountMinor),
    currency: e.currency,
    position: e.position,
  });

async function fetchChecklist(tripId: string): Promise<TripChecklist> {
  const res = await tripClient.getTripChecklist(create(GetTripChecklistRequestSchema, { tripId }));
  return {
    items: sortEntries(res.items.map(fromProto)),
    dismissed: [...res.dismissedSuggestions],
  };
}

const upsert = (tripId: string, item: ChecklistEntry) =>
  tripClient.upsertChecklistItem(
    create(UpsertChecklistItemRequestSchema, { tripId, item: toProto(item) }),
  );

const dismiss = (tripId: string, text: string) =>
  tripClient.dismissPackingSuggestion(
    create(DismissPackingSuggestionRequestSchema, { tripId, text }),
  );

/**
 * Move whatever an older build kept in this browser's localStorage onto the
 * server, once. The keys are cleared only after every write succeeds; a partial
 * failure leaves them for the next visit, and `planLegacyImport` skips what
 * already made it, so the retry does not duplicate.
 *
 * Returns true when it uploaded anything (the caller refetches).
 */
export async function importLegacyChecklist(
  tripId: string,
  current: TripChecklist,
  currency: string,
): Promise<boolean> {
  if (typeof localStorage === "undefined") return false;
  const legacy = readLegacyChecklist(localStorage, tripId);
  if (!legacy) return false;
  const plan = planLegacyImport(legacy, current.items, currency, current.dismissed);
  await Promise.all([
    ...plan.items.map((i) => upsert(tripId, i)),
    ...plan.dismissed.map((d) => dismiss(tripId, d)),
  ]);
  clearLegacyChecklist(localStorage, tripId);
  return plan.items.length > 0 || plan.dismissed.length > 0;
}

export const useTripChecklist = (tripId: () => string | undefined) => {
  const gate = useAuthGate();
  return useAppQuery(() => ({
    queryKey: checklistKey(tripId() ?? ""),
    enabled: gate() && !!tripId(),
    queryFn: () => fetchChecklist(tripId()!),
    staleTime: 30 * 1000,
  }));
};

/**
 * One optimistic mutation over the cached checklist. `apply` edits the cached
 * copy; `send` makes the RPC. On failure the snapshot comes back and the list
 * is refetched so the page never keeps a write the server refused.
 */
function useChecklistMutation<TInput>(
  tripId: () => string,
  apply: (current: TripChecklist, input: TInput) => TripChecklist,
  send: (tripId: string, input: TInput) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation(() => ({
    mutationFn: (input: TInput) => send(tripId(), input),
    onMutate: async (input: TInput) => {
      const key = checklistKey(tripId());
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TripChecklist>(key);
      qc.setQueryData<TripChecklist>(key, apply(previous ?? { items: [], dismissed: [] }, input));
      return { previous };
    },
    onError: (_err: unknown, _input: TInput, ctx: { previous?: TripChecklist } | undefined) => {
      if (ctx?.previous) qc.setQueryData(checklistKey(tripId()), ctx.previous);
      void qc.invalidateQueries({ queryKey: checklistKey(tripId()) });
    },
  }));
}

/** Create or update one item (same call: the id is the key). */
export const useUpsertChecklistItem = (tripId: () => string) =>
  useChecklistMutation<ChecklistEntry>(
    tripId,
    (c, item) => ({
      ...c,
      items: sortEntries([...c.items.filter((i) => i.id !== item.id), item]),
    }),
    (t, item) => upsert(t, item),
  );

/** Several creates at once ("Add all" suggestions). */
export const useUpsertChecklistItems = (tripId: () => string) =>
  useChecklistMutation<ChecklistEntry[]>(
    tripId,
    (c, items) => {
      const ids = new Set(items.map((i) => i.id));
      return { ...c, items: sortEntries([...c.items.filter((i) => !ids.has(i.id)), ...items]) };
    },
    (t, items) => Promise.all(items.map((i) => upsert(t, i))),
  );

export const useDeleteChecklistItem = (tripId: () => string) =>
  useChecklistMutation<string>(
    tripId,
    (c, id) => ({ ...c, items: c.items.filter((i) => i.id !== id) }),
    (t, itemId) =>
      tripClient.deleteChecklistItem(
        create(DeleteChecklistItemRequestSchema, { tripId: t, itemId }),
      ),
  );

export const useDismissPackingSuggestion = (tripId: () => string) =>
  useChecklistMutation<string>(
    tripId,
    (c, text) => ({ ...c, dismissed: [...c.dismissed, text] }),
    (t, text) => dismiss(t, text),
  );
