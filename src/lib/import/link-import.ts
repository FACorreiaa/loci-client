import { Code, ConnectError } from "@connectrpc/connect";
import {
  ImportSource,
  type ImportPlacesResponse,
} from "@buf/loci_loci-proto.bufbuild_es/loci/place/place_intelligence_pb.js";

/** One place a shared link mentions. Without a poiId it can be shown, not saved. */
export interface ImportedPlaceView {
  key: string;
  name: string;
  city: string;
  note: string;
  poiId?: string;
  /** The Loci place's own name; it can differ from what the link called it. */
  poiName?: string;
  address?: string;
  category?: string;
}

export interface ImportView {
  source: string;
  title: string;
  city: string;
  places: ImportedPlaceView[];
}

const SOURCES: Record<ImportSource, string> = {
  [ImportSource.UNSPECIFIED]: "Link",
  [ImportSource.GOOGLE_MAPS]: "Google Maps",
  [ImportSource.TIKTOK]: "TikTok",
  [ImportSource.INSTAGRAM]: "Instagram",
  [ImportSource.YOUTUBE]: "YouTube",
  [ImportSource.WEB]: "Web page",
};

export function toImportView(res: ImportPlacesResponse): ImportView {
  return {
    source: SOURCES[res.source] ?? "Link",
    title: res.sourceTitle,
    city: res.cityName,
    places: res.places.map((p, i) => ({
      // Names can repeat across cities; the position keeps keys unique.
      key: `${i}:${p.poiId ?? p.name}`,
      name: p.name,
      city: p.cityName,
      note: p.note,
      poiId: p.poiId || undefined,
      poiName: p.poiName || undefined,
      address: p.address || undefined,
      category: p.category || undefined,
    })),
  };
}

/**
 * The Loci place a row will save, when that is not simply the name the link
 * gave: the person should see what they are about to keep.
 */
export function savedAs(p: ImportedPlaceView): string | undefined {
  if (!p.poiId || !p.poiName) return undefined;
  const same =
    p.poiName.trim().localeCompare(p.name.trim(), undefined, { sensitivity: "base" }) === 0;
  return same ? undefined : p.poiName;
}

/** Every place that can be saved starts picked. */
export function defaultSelection(places: ImportedPlaceView[]): Set<string> {
  return new Set(places.filter((p) => p.poiId).map((p) => p.key));
}

const MAX_LIST_NAME = 60;

/** A new list is named after the video or post, else its city. */
export function defaultListName(view: ImportView): string {
  const title = view.title.trim();
  if (title) return [...title].slice(0, MAX_LIST_NAME).join("").trim();
  if (view.city) return `Places in ${view.city}`;
  return "Imported places";
}

export interface SaveDeps {
  createList: (name: string) => Promise<string>;
  addItem: (listId: string, poiId: string) => Promise<void>;
}

export type SaveTarget = { listId: string } | { newListName: string };

export interface SaveOutcome {
  listId: string;
  /** Set when this save created the list. */
  created?: { id: string; name: string };
  added: number;
  /** Already in the list: AddListItem answers AlreadyExists. */
  already: number;
  failed: number;
  /** Keys of the places that didn't save, for a retry. */
  failedKeys: string[];
}

/**
 * Saves picked places into a list, creating it first when asked. One place
 * failing never stops the rest; a place without a Loci id is never sent.
 */
export async function saveImported(
  deps: SaveDeps,
  target: SaveTarget,
  places: ImportedPlaceView[],
): Promise<SaveOutcome> {
  const listId = "listId" in target ? target.listId : await deps.createList(target.newListName);
  const out: SaveOutcome = { listId, added: 0, already: 0, failed: 0, failedKeys: [] };
  if ("newListName" in target) out.created = { id: listId, name: target.newListName };
  for (const p of places) {
    if (!p.poiId) continue;
    try {
      await deps.addItem(listId, p.poiId);
      out.added++;
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.AlreadyExists) out.already++;
      else {
        out.failed++;
        out.failedKeys.push(p.key);
      }
    }
  }
  return out;
}

/**
 * What the form holds after a save: the list it saved into (so a retry never
 * creates a second list) and only the places still to save.
 */
export function retryAfterSave(o: SaveOutcome): { listChoice: string; picked: Set<string> } {
  return { listChoice: o.listId, picked: new Set(o.failedKeys) };
}

export function importErrorMessage(err: unknown): string {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.InvalidArgument:
        return "That link can't be opened. Paste a public link to a post, video, map pin or article.";
      case Code.FailedPrecondition: {
        const msg = err.rawMessage.trim();
        return msg ? `${msg[0].toUpperCase()}${msg.slice(1)}.` : "Couldn't read that link.";
      }
      case Code.Unavailable:
      case Code.ResourceExhausted:
        return "Couldn't read the places right now. Try again in a minute.";
    }
  }
  return "Couldn't import that link. Try again.";
}
