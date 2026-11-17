/**
 * IndexedDB-backed offline storage for itinerary payloads.
 *
 * Why IndexedDB over localStorage:
 * - Itinerary payloads can be 100KB+ (city data, POIs, stops, etc.)
 * - localStorage has a 5MB total limit; IndexedDB has effectively none
 * - IndexedDB supports structured cloning — no JSON.stringify round-trips
 */

const DB_NAME = "loci-offline-itineraries";
const DB_VERSION = 1;
const STORE_NAME = "itineraries";
const MAX_ENTRIES = 50;

export interface OfflineItinerary {
  /** Key: sessionId or a synthetic ID */
  id: string;
  cityName: string;
  title: string;
  description?: string;
  /** The full itinerary payload (general_city_data, itinerary_response, etc.) */
  payload: unknown;
  /** Number of stops in the itinerary */
  stopCount: number;
  /** ISO timestamp of when it was saved offline */
  savedAt: string;
  /** The original URL so we can re-open the itinerary */
  sourceUrl: string;
  /**
   * Trip start date chosen in the Trip Kit date picker (yyyy-mm-dd).
   * Persisted so the picker restores its value on reopen.
   */
  tripStartDate?: string;
  /**
   * Ordered stop names. Persisted to survive reorder operations (drag-to-
   * reorder) across sessions. Stops not in the list are appended at the end.
   */
  stopOrder?: string[];
  /**
   * Per-stop notes keyed by stop name. Persisted so inline notes survive
   * navigation and appear in calendar event descriptions and PDF exports.
   */
  stopNotes?: Record<string, string>;
  /** The trip this itinerary is a view of, once the page has found it. */
  tripId?: string;
  /**
   * That trip as it was last read or edited here, so the page opens with the
   * traveller's own order and additions when there is no network. Opaque to
   * this store; the page that wrote it reads it back.
   */
  tripSnapshot?: unknown;
}

// A request can fail without an error object; reject with an Error either way.
const failure = (source: { error: DOMException | null }): Error =>
  source.error ?? new Error("IndexedDB request failed");

/** Resolves with `value()` on the target's `done` event, rejects on its error. */
const settled = <T>(
  target: IDBRequest | IDBTransaction,
  done: "success" | "complete",
  value: () => T,
): Promise<T> =>
  new Promise((resolve, reject) => {
    target.addEventListener(done, () => resolve(value()));
    target.addEventListener("error", () => reject(failure(target)));
  });

/** Resolves when the transaction commits. */
const committed = (tx: IDBTransaction): Promise<void> => settled(tx, "complete", () => {});

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    settled(req, "success", () => req.result).then(resolve, reject);
  });
}

/** Save an itinerary for offline access. Evicts oldest entries beyond MAX. */
export async function saveItineraryOffline(entry: OfflineItinerary): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(entry);

  // Evict oldest beyond MAX_ENTRIES
  const countReq = store.count();
  countReq.onsuccess = () => {
    if (countReq.result > MAX_ENTRIES) {
      const idx = store.index("savedAt");
      const cursor = idx.openCursor();
      let toDelete = countReq.result - MAX_ENTRIES;
      cursor.onsuccess = () => {
        if (cursor.result && toDelete > 0) {
          store.delete(cursor.result.primaryKey);
          toDelete--;
          cursor.result.continue();
        }
      };
    }
  };

  return committed(tx);
}

/** List all offline-saved itineraries (newest first). */
export async function listOfflineItineraries(): Promise<OfflineItinerary[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const req = store.getAll();
  return settled(req, "success", () =>
    (req.result as OfflineItinerary[]).sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    ),
  );
}

/** Get a single offline itinerary by ID. */
export async function getOfflineItinerary(id: string): Promise<OfflineItinerary | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).get(id);
  return settled(req, "success", () => req.result as OfflineItinerary | undefined);
}

/** Delete a single offline itinerary. */
export async function deleteOfflineItinerary(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  return committed(tx);
}

/** Clear all offline itineraries. */
export async function clearOfflineItineraries(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  return committed(tx);
}

/**
 * Update Trip Kit meta fields on an existing offline itinerary without
 * re-saving the full payload. If the record doesn't exist (not yet saved),
 * resolves silently — the caller does not need to check first.
 *
 * No DB_VERSION bump needed: IndexedDB `put` with new fields on an existing
 * record just adds them; the structured clone algorithm handles it.
 */
export async function updateItineraryMeta(
  id: string,
  patch: Partial<
    Pick<OfflineItinerary, "tripStartDate" | "stopOrder" | "stopNotes" | "tripId" | "tripSnapshot">
  >,
): Promise<void> {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as OfflineItinerary | undefined;
      if (!existing) {
        // Not yet saved — resolve silently.
        resolve();
        return;
      }
      store.put({ ...existing, ...patch });
    };
    getReq.addEventListener("error", () => reject(failure(getReq)));
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(failure(tx)));
  });
}
