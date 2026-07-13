"use client";

import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

import { getFFmpeg } from "./convertToMp3";

/**
 * compressForTranscription — shrink an episode recording in the browser into a
 * small, speech-optimized MP3 that fits inside the transcription route's upload
 * limit.
 *
 * Why: Vercel serverless routes reject request bodies larger than ~4.5 MB with a
 * plain-text "Request Entity Too Large" response. Full podcast recordings easily
 * exceed that. Speech-to-text does NOT need CD-quality stereo audio, so we
 * downmix to mono and drop the sample rate + bitrate. This typically shrinks the
 * file ~10-20x with no measurable loss in transcription accuracy.
 *
 * Runs entirely on the SAME shared FFmpeg-WASM instance the MP3 converter uses
 * (see getFFmpeg in convertToMp3.ts), so we never download the ~25MB WASM core
 * twice and no audio ever leaves the browser during compression. The source is
 * only READ here — the original recording is never modified.
 */

export type CompressForTranscriptionInput = {
  /** The episode audio, either a Blob/File or a URL string to fetch. */
  source: Blob | string;
  /** Optional status callback for a progress UI. */
  onProgress?: (message: string) => void;
};

/**
 * Dependencies, injectable so unit tests can supply a mock FFmpeg and a stub
 * fetchFile — no real browser or WASM needed to verify the argument building.
 */
export type CompressForTranscriptionDeps = {
  getFFmpeg: (onProgress?: (message: string) => void) => Promise<FFmpeg>;
  fetchFile: (input: Blob | string) => Promise<Uint8Array>;
};

const defaultDeps: CompressForTranscriptionDeps = {
  getFFmpeg,
  // @ffmpeg/util's fetchFile accepts a Blob/File or a URL string and returns
  // the bytes as a Uint8Array. The cast keeps our narrower Deps type happy.
  fetchFile: fetchFile as CompressForTranscriptionDeps["fetchFile"],
};

/**
 * Build the FFmpeg argv that re-encodes `inputName` into a speech-optimized MP3
 * at `outputName`. Exported as pure logic so it can be unit-tested directly.
 *
 * Flags, explained for beginners:
 *   -i <inputName>      Read this file from FFmpeg's in-memory filesystem.
 *   -vn                 Drop any video/album-art stream — we only want audio.
 *   -ac 1               Downmix to MONO (1 audio channel). Speech is fine in
 *                       mono, and it halves the data vs. stereo.
 *   -ar 16000           Resample to 16,000 Hz. Whisper-style speech models are
 *                       trained at 16 kHz; higher rates just add size, not
 *                       accuracy.
 *   -c:a libmp3lame     Encode with the LAME MP3 encoder.
 *   -b:a 32k            Target 32 kbit/s. Very low, but plenty for intelligible
 *                       mono speech — this is where most of the shrink happens.
 */
export function buildCompressionArgs(
  inputName: string,
  outputName: string
): string[] {
  return [
    "-i",
    inputName,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "32k",
    outputName,
  ];
}

/**
 * Compress the given audio into a small mono 16kHz 32kbps MP3 Blob
 * (audio/mpeg), suitable for POSTing to the transcription route.
 *
 * @param input  The source audio plus an optional progress callback.
 * @param deps   Injectable FFmpeg + fetchFile (defaults to the real ones).
 */
export async function compressForTranscription(
  input: CompressForTranscriptionInput,
  deps: CompressForTranscriptionDeps = defaultDeps
): Promise<Blob> {
  const { source, onProgress } = input;

  const ffmpeg = await deps.getFFmpeg(onProgress);

  const inputName = "transcribe-input";
  const outputName = "transcribe-output.mp3";

  onProgress?.("Compressing audio…");

  // Write the source into FFmpeg's in-memory filesystem. FFmpeg detects the
  // format from the file contents, so no extension is needed on the name.
  await ffmpeg.writeFile(inputName, await deps.fetchFile(source));

  await ffmpeg.exec(buildCompressionArgs(inputName, outputName));

  const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

  // Clean up the in-memory files so repeated runs don't accumulate.
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch {
    // Non-fatal — the FS is per-session and small.
  }

  const buffer = new Uint8Array(data);
  return new Blob([buffer], { type: "audio/mpeg" });
}
