/**
 * Encoding recorded audio as WAV.
 *
 * WAV rather than whatever the browser recorded, because there is no format
 * every browser produces: Chrome gives WebM/Opus, Safari gives MP4/AAC, and
 * the server would have to accept both and hope the model reads them. Every
 * browser can decode its own recording, and every one can be re-encoded to
 * WAV, so the conversion happens here where the format is known.
 *
 * Mono at 16 kHz because it is speech. Stereo doubles the upload for two
 * copies of one voice, and nothing above 8 kHz carries a word.
 */

/** The sample rate recordings are sent at. Speech needs no more. */
export const SAMPLE_RATE = 16_000;

const WAV_HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

/**
 * Decodes a recording and re-encodes it as 16 kHz mono WAV.
 *
 * The resampling is done by an OfflineAudioContext rather than by hand: it is
 * the browser's own resampler, and a naive one turns an "s" into a whistle.
 */
export async function toWav(recording: Blob): Promise<Uint8Array> {
  const bytes = await recording.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error("The recording was empty.");
  }

  // A throwaway context purely to decode. Its own sample rate is irrelevant —
  // decodeAudioData answers at the recording's rate — but Safari refuses to
  // construct one without a rate it likes, so it gets the default.
  const decoder = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(bytes);
  } finally {
    void decoder.close();
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
  const offline = new OfflineAudioContext(CHANNELS, frames, SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const resampled = await offline.startRendering();
  return encodeWav(resampled.getChannelData(0));
}

/** Wraps float samples in a canonical RIFF/WAVE header. */
function encodeWav(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(WAV_HEADER_BYTES + samples.length * 2);
  const view = new DataView(out.buffer);

  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const dataBytes = samples.length * 2;

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");

  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // format 1 is uncompressed PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    // Clamped before scaling: a sample past ±1 wraps around into a loud click
    // rather than clipping quietly.
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(WAV_HEADER_BYTES + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return out;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
