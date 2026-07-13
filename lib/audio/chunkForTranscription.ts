"use client";

import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

import { getFFmpeg } from "./convertToMp3";

/**
 * chunkForTranscription — split an ALREADY-COMPRESSED mono 16kHz 32k MP3 into
 * time-based segments so each piece fits under the transcription route's ~4.5MB
 * upload limit.
 *
 * Why: even after compression, a long enough episode still exceeds the
 * serverless body limit. Rather than shrink audio quality further, we cut the
 * file into ~10-minute segments, transcribe each through the SAME server route,
 * and let the caller join the text back together.
 *
 * How the split stays fast + low-memory: we use FFmpeg's `segment` muxer with
 * `-c copy`, which COPIES the existing MP3 frames into new files instead of
 * decoding and re-encoding them. No libmp3lame pass, so it's near-instant and
 * uses very little memory regardless of episode length.
 *
 * Runs on the SAME shared FFmpeg-WASM instance the converter/compressor use
 * (see getFFmpeg in convertToMp3.ts), so we never download the WASM core twice
 * and no audio leaves the browser. The input Blob is only READ here.
 */

export type ChunkForTranscriptionInput = {
  /** The compressed MP3 to split. */
  source: Blob | string;
  /** Segment length in seconds. Defaults to 600 (10 minutes). */
  segmentSeconds?: number;
  /** Optional status callback for a progress UI. */
  onProgress?: (message: string) => void;
};

/**
 * Dependencies, injectable so unit tests can supply a mock FFmpeg and a stub
 * fetchFile — no real browser or WASM needed to verify the argument building
 * and the chunk-reading loop.
 */
export type ChunkForTranscriptionDeps = {
  getFFmpeg: (onProgress?: (message: string) => void) => Promise<FFmpeg>;
  fetchFile: (input: Blob | string) => Promise<Uint8Array>;
};

const defaultDeps: ChunkForTranscriptionDeps = {
  getFFmpeg,
  // @ffmpeg/util's fetchFile accepts a Blob/File or a URL string and returns
  // the bytes as a Uint8Array. The cast keeps our narrower Deps type happy.
  fetchFile: fetchFile as ChunkForTranscriptionDeps["fetchFile"],
};

/** Default segment length: 10 minutes. */
export const DEFAULT_SEGMENT_SECONDS = 600;

/** The output filename pattern FFmpeg's segment muxer fills in (%03d = 000, 001…). */
export const CHUNK_PATTERN = "chunk_%03d.mp3";

/**
 * Turn the segment pattern into the concrete filename for index `i`, matching
 * FFmpeg's `%03d` zero-padding (0 -> "chunk_000.mp3").
 */
export function chunkFileName(index: number): string {
  return CHUNK_PATTERN.replace("%03d", String(index).padStart(3, "0"));
}

/**
 * Build the FFmpeg argv that splits `inputName` into `pattern` segments of
 * `segmentSeconds` each. Exported as pure logic so it can be unit-tested.
 *
 * Flags, explained for beginners:
 *   -i <inputName>            Read this file from FFmpeg's in-memory filesystem.
 *   -f segment                Use the "segment" muxer, which writes many output
 *                             files instead of one.
 *   -segment_time <seconds>   Start a new segment roughly every N seconds. Cuts
 *                             land on frame boundaries, so pieces are ~N sec.
 *   -c copy                   COPY streams (no re-encode) — fast and low-memory.
 *   <pattern>                 e.g. "chunk_%03d.mp3" -> chunk_000.mp3, 001, …
 */
export function buildSegmentArgs(
  inputName: string,
  segmentSeconds: number,
  pattern: string
): string[] {
  return [
    "-i",
    inputName,
    "-f",
    "segment",
    "-segment_time",
    String(segmentSeconds),
    "-c",
    "copy",
    pattern,
  ];
}

/**
 * Split the compressed audio into an ordered array of segment Blobs
 * (audio/mpeg). Returns at least one Blob.
 *
 * @param input  The compressed MP3 plus optional segment length + progress cb.
 * @param deps   Injectable FFmpeg + fetchFile (defaults to the real ones).
 */
export async function chunkForTranscription(
  input: ChunkForTranscriptionInput,
  deps: ChunkForTranscriptionDeps = defaultDeps
): Promise<Blob[]> {
  const { source, onProgress } = input;
  const segmentSeconds = input.segmentSeconds ?? DEFAULT_SEGMENT_SECONDS;

  const ffmpeg = await deps.getFFmpeg(onProgress);

  const inputName = "chunk-input.mp3";

  onProgress?.("Splitting audio into parts…");

  // Write the source into FFmpeg's in-memory filesystem.
  await ffmpeg.writeFile(inputName, await deps.fetchFile(source));

  await ffmpeg.exec(buildSegmentArgs(inputName, segmentSeconds, CHUNK_PATTERN));

  // We don't know up front how many segments FFmpeg produced, so probe by
  // reading chunk_000.mp3, chunk_001.mp3, … until a readFile fails (that index
  // doesn't exist), which marks the end.
  const chunks: Blob[] = [];
  const writtenNames: string[] = [];
  for (let i = 0; ; i++) {
    const name = chunkFileName(i);
    let data: Uint8Array;
    try {
      data = (await ffmpeg.readFile(name)) as Uint8Array;
    } catch {
      break; // No more segments.
    }
    writtenNames.push(name);
    const buffer = new Uint8Array(data);
    chunks.push(new Blob([buffer], { type: "audio/mpeg" }));
  }

  // Clean up the in-memory files so repeated runs don't accumulate.
  try {
    await ffmpeg.deleteFile(inputName);
    for (const name of writtenNames) await ffmpeg.deleteFile(name);
  } catch {
    // Non-fatal — the FS is per-session and small.
  }

  return chunks;
}
