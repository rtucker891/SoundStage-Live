/**
 * lib/audio/trimSilence.ts — client-side, NON-DESTRUCTIVE auto-trim of dead air
 * at the start and end of a recording.
 *
 * The math (finding where real audio begins/ends) is a set of PURE functions
 * with no browser dependency, so it can be unit-tested directly. The Web Audio
 * decode + WAV re-encode wrapper (`trimSilenceFromBlob`) is browser-only and is
 * the piece the Studio UI calls.
 *
 * IMPORTANT: this NEVER mutates the source. It returns a brand-new WAV Blob; the
 * caller uploads it as a *new* recording/asset, leaving the original intact.
 */

export type SilenceBounds = {
  /** Index of the first sample to KEEP (inclusive). */
  startSample: number;
  /** Index one past the last sample to KEEP (exclusive). */
  endSample: number;
};

export type DetectOptions = {
  /**
   * Amplitude at/below which a sample counts as "silent", 0..1. Default 0.01
   * (~-40 dBFS) — quiet room tone without clipping soft speech.
   */
  threshold?: number;
  /**
   * Seconds of audio to keep BEFORE the first / AFTER the last detected sound,
   * so speech isn't clipped abruptly. Default 0.15s.
   */
  padSeconds?: number;
};

const DEFAULT_THRESHOLD = 0.01;
const DEFAULT_PAD_SECONDS = 0.15;

/**
 * Find the range of samples to keep by trimming leading and trailing silence.
 *
 * Scans inward from both ends until it finds a sample whose absolute amplitude
 * exceeds `threshold`, then applies `padSeconds` of breathing room. If the whole
 * clip is below threshold (pure silence), returns an empty range [0, 0).
 *
 * Pure: depends only on its inputs. `samples` is mono PCM in the range [-1, 1].
 */
export function detectSilenceBounds(
  samples: Float32Array | number[],
  sampleRate: number,
  options: DetectOptions = {}
): SilenceBounds {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const padSeconds = options.padSeconds ?? DEFAULT_PAD_SECONDS;
  const len = samples.length;

  if (len === 0 || sampleRate <= 0) return { startSample: 0, endSample: 0 };

  let first = -1;
  for (let i = 0; i < len; i++) {
    if (Math.abs(samples[i]) > threshold) {
      first = i;
      break;
    }
  }

  // Entire clip is silent — nothing to keep.
  if (first === -1) return { startSample: 0, endSample: 0 };

  let last = first;
  for (let i = len - 1; i >= first; i--) {
    if (Math.abs(samples[i]) > threshold) {
      last = i;
      break;
    }
  }

  const pad = Math.max(0, Math.round(padSeconds * sampleRate));
  const startSample = Math.max(0, first - pad);
  const endSample = Math.min(len, last + 1 + pad);

  return { startSample, endSample };
}

/** How many seconds `bounds` would remove from a clip of `totalSamples`. */
export function trimmedSecondsRemoved(
  bounds: SilenceBounds,
  totalSamples: number,
  sampleRate: number
): number {
  if (sampleRate <= 0) return 0;
  const kept = Math.max(0, bounds.endSample - bounds.startSample);
  const removed = Math.max(0, totalSamples - kept);
  return removed / sampleRate;
}

/**
 * Encode interleaved PCM channels as a 16-bit PCM WAV Blob.
 * `channels` is an array of equal-length Float32Arrays (one per channel).
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number
): Blob {
  const numChannels = Math.max(1, channels.length);
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export type TrimResult = {
  /** The trimmed audio as a new WAV Blob (original is untouched). */
  blob: Blob;
  originalSeconds: number;
  trimmedSeconds: number;
  secondsRemoved: number;
};

/**
 * Decode an audio Blob, trim leading/trailing silence, and return a NEW WAV
 * Blob. Browser-only (needs Web Audio API). Silence detection uses a mono
 * mixdown; the trim is applied to every channel so stereo is preserved.
 *
 * Returns null if decoding fails or there is nothing worth trimming, so the
 * caller can simply fall back to the original recording.
 */
export async function trimSilenceFromBlob(
  input: Blob,
  options: DetectOptions = {}
): Promise<TrimResult | null> {
  const AudioCtx =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await input.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const numFrames = audioBuffer.length;

    // Mono mixdown for detection.
    const mono = new Float32Array(numFrames);
    for (let ch = 0; ch < numChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < numFrames; i++) mono[i] += data[i] / numChannels;
    }

    const bounds = detectSilenceBounds(mono, sampleRate, options);
    const keptLen = bounds.endSample - bounds.startSample;
    if (keptLen <= 0) return null;

    const secondsRemoved = trimmedSecondsRemoved(bounds, numFrames, sampleRate);
    // Not worth a new asset for a sliver of silence.
    if (secondsRemoved < 0.5) return null;

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(
        audioBuffer.getChannelData(ch).slice(bounds.startSample, bounds.endSample)
      );
    }

    return {
      blob: encodeWav(channels, sampleRate),
      originalSeconds: numFrames / sampleRate,
      trimmedSeconds: keptLen / sampleRate,
      secondsRemoved,
    };
  } catch {
    return null;
  } finally {
    try {
      await ctx.close();
    } catch {
      // ignore
    }
  }
}
