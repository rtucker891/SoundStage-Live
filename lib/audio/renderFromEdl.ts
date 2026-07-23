/**
 * renderFromEdl.ts — turn an EDL (kept ranges) + source audio into a NEW
 * trimmed audio Blob, without ever mutating the original.
 *
 * The browser-only entry point (`renderBlobFromEdl`) decodes the source with
 * the Web Audio API, copies only the kept sample ranges into a fresh buffer,
 * and encodes the result as a 16-bit PCM WAV (reusing encodeWav from
 * trimSilence.ts, the same encoder the waveform editor's exports use).
 *
 * The sample-copying math is split out into pure functions
 * (`sliceChannelsByRanges`, `keptFrameCount`) so it can be unit-tested with
 * plain Float32Arrays — no AudioContext required.
 */
import type { TimeRange } from "./edl";
import { normalizeRanges } from "./edl";
import { encodeWav } from "./trimSilence";

/** Total number of output frames for the given kept ranges at `sampleRate`. */
export function keptFrameCount(
  ranges: TimeRange[],
  sampleRate: number,
  totalFrames: number
): number {
  let frames = 0;
  for (const r of normalizeRanges(ranges)) {
    const startFrame = Math.max(0, Math.floor(r.start * sampleRate));
    const endFrame = Math.min(totalFrames, Math.ceil(r.end * sampleRate));
    if (endFrame > startFrame) frames += endFrame - startFrame;
  }
  return frames;
}

/**
 * Copy the kept sample ranges out of each channel into new Float32Arrays.
 * Ranges are converted to sample indices, clamped to the buffer, and
 * concatenated in order.
 */
export function sliceChannelsByRanges(
  channels: Float32Array[],
  sampleRate: number,
  ranges: TimeRange[]
): Float32Array[] {
  const totalFrames = channels[0]?.length ?? 0;
  const normalized = normalizeRanges(ranges);
  const outFrames = keptFrameCount(normalized, sampleRate, totalFrames);

  return channels.map((channel) => {
    const out = new Float32Array(outFrames);
    let cursor = 0;
    for (const r of normalized) {
      const startFrame = Math.max(0, Math.floor(r.start * sampleRate));
      const endFrame = Math.min(totalFrames, Math.ceil(r.end * sampleRate));
      if (endFrame > startFrame) {
        out.set(channel.subarray(startFrame, endFrame), cursor);
        cursor += endFrame - startFrame;
      }
    }
    return out;
  });
}

/**
 * Decode `source`, keep only `ranges`, and return a new WAV Blob. Browser-only
 * (needs the Web Audio API). Returns null if decoding is unavailable or the
 * result would be empty, so callers can fall back to the original audio.
 */
export async function renderBlobFromEdl(
  source: Blob,
  ranges: TimeRange[]
): Promise<Blob | null> {
  const AudioCtx =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await source.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    const sliced = sliceChannelsByRanges(channels, sampleRate, ranges);
    if ((sliced[0]?.length ?? 0) === 0) return null;

    return encodeWav(sliced, sampleRate);
  } catch {
    return null;
  } finally {
    try {
      await ctx.close();
    } catch {
      // Non-fatal.
    }
  }
}
