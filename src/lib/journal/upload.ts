// One journal photo upload: the server signs a PUT, the browser sends the
// bytes straight to storage, and the server checks them before showing the
// photo. Pure over its dependencies so the order and the cleanup are tested.

/** What the server accepts; mirrors CreatePhotoUploadRequest's validation. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/heic"] as const;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export interface PhotoTarget {
  tripId: string;
  dayId?: string;
  stopId?: string;
}

export interface JournalPhotoView {
  id: string;
  url: string;
  caption: string;
  dayId?: string;
  stopId?: string;
}

export interface UploadDeps {
  create: (input: {
    tripId: string;
    dayId?: string;
    stopId?: string;
    contentType: string;
    sizeBytes: number;
  }) => Promise<{ photoId: string; uploadUrl: string; headers: Record<string, string> }>;
  put: (
    url: string,
    body: Blob,
    headers: Record<string, string>,
  ) => Promise<{ ok: boolean; status: number }>;
  confirm: (photoId: string, caption: string) => Promise<JournalPhotoView>;
  remove: (photoId: string) => Promise<void>;
}

export class PhotoRejected extends Error {}

// The browser sets these itself and refuses them from script; the signature
// still covers Content-Length because the browser sends the blob's size.
const BROWSER_HEADERS = new Set(["content-length", "host"]);

export const putHeaders = (headers: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).filter(([name]) => !BROWSER_HEADERS.has(name.toLowerCase())),
  );

/** Uploads one photo. Any failure after the server signed it removes the pending photo. */
export async function uploadPhoto(
  deps: UploadDeps,
  target: PhotoTarget,
  blob: Blob,
  caption = "",
): Promise<JournalPhotoView> {
  const contentType = blob.type || "image/jpeg";
  if (!(PHOTO_TYPES as readonly string[]).includes(contentType)) {
    throw new PhotoRejected("Photos must be JPEG, PNG or HEIC.");
  }
  if (blob.size < 1 || blob.size > MAX_PHOTO_BYTES) {
    throw new PhotoRejected("Photos must be at most 8 MB.");
  }
  const signed = await deps.create({
    tripId: target.tripId,
    dayId: target.dayId,
    stopId: target.stopId,
    contentType,
    sizeBytes: blob.size,
  });
  try {
    const res = await deps.put(signed.uploadUrl, blob, putHeaders(signed.headers));
    if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
    return await deps.confirm(signed.photoId, caption);
  } catch (err) {
    await deps.remove(signed.photoId).catch(() => undefined);
    throw err;
  }
}
