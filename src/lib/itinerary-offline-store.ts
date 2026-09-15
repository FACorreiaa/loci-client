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
}

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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** List all offline-saved itineraries (newest first). */
export async function listOfflineItineraries(): Promise<OfflineItinerary[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as OfflineItinerary[]).sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      );
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get a single offline itinerary by ID. */
export async function getOfflineItinerary(id: string): Promise<OfflineItinerary | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as OfflineItinerary | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a single offline itinerary. */
export async function deleteOfflineItinerary(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Clear all offline itineraries. */
export async function clearOfflineItineraries(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
