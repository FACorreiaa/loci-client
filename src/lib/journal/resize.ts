// Journal photos are shrunk in the browser before upload: a phone photo is
// 3–6 MB at 4032 px, and the journal never shows one larger than a screen.
// Re-encoding also drops the EXIF block, GPS position included.

/** The long edge a journal photo is kept at. */
export const MAX_EDGE = 2048;
const QUALITY = 0.8;

/** The size that fits w×h within max on its long edge, never scaled up. */
export const fitWithin = (
  w: number,
  h: number,
  max = MAX_EDGE,
): { width: number; height: number } => {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
};

/**
 * A JPEG of the photo at most MAX_EDGE on its long edge. A file the browser
 * cannot decode (HEIC outside Safari) is returned as it is; the server takes
 * HEIC up to its size limit.
 */
export const downscale = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
      return await canvas.convertToBlob({ type: "image/jpeg", quality: QUALITY });
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    return blob ?? file;
  } finally {
    bitmap.close();
  }
};
