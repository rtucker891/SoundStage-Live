"use client";

import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

import { getFFmpeg } from "./convertToMp3";

/**
 * addIntroOutro — stitch an optional intro clip and/or outro clip onto an
 * episode recording, entirely in the browser, and return ONE combined MP3.
 *
 * All the heavy lifting is done by the SAME shared FFmpeg-WASM instance the MP3
 * converter uses (see getFFmpeg in convertToMp3.ts), so we never download the
 * WASM core twice and there's no server-side audio processing.
 *
 * The result order is always: intro -> episode -> outro (whichever are given).
 * The original episode Blob/URL is only READ here — nothing is overwritten, so
 * the caller can save the combined output as a NEW file and keep the original.
 */

export type AddIntroOutroInput = {
  /** The episode audio, either a Blob/File or a URL string to fetch. */
  episode: Blob | string;
  /** Optional intro clip to play BEFORE the episode. */
  intro?: Blob | null;
  /** Optional outro clip to play AFTER the episode. */
  outro?: Blob | null;
  /**
   * Crossfade duration in seconds between adjacent segments. 0 (default) means
   * a hard cut (simple concatenation). A small value like 1-2s blends the clips
   * so the intro music fades smoothly into speech, etc.
   */
  crossfadeSeconds?: number;
  /** Optional status callback for a progress UI. */
  onProgress?: (message: string) => void;
};

/**
 * Dependencies, injectable so unit tests can supply a mock FFmpeg and a stub
 * fetchFile — no real browser or WASM needed to verify the argument building.
 */
export type AddIntroOutroDeps = {
  getFFmpeg: (onProgress?: (message: string) => void) => Promise<FFmpeg>;
  fetchFile: (input: Blob | string) => Promise<Uint8Array>;
};

const defaultDeps: AddIntroOutroDeps = {
  getFFmpeg,
  // @ffmpeg/util's fetchFile accepts a Blob/File or a URL string and returns
  // the bytes as a Uint8Array. The cast keeps our narrower Deps type happy.
  fetchFile: fetchFile as AddIntroOutroDeps["fetchFile"],
};

/**
 * Build the FFmpeg `-filter_complex` graph that combines `numInputs` audio
 * inputs (already provided in play order via `-i`).
 *
 * - crossfade == 0  -> `concat`: glue the inputs end-to-end with a hard cut.
 *     e.g. two inputs: "[0:a][1:a]concat=n=2:v=0:a=1[out]"
 * - crossfade  > 0  -> `acrossfade`: overlap each adjacent pair by `d` seconds
 *     with a triangular (linear) fade. acrossfade only takes TWO inputs, so for
 *     three segments we chain: fade 0+1 into a temp label, then fade that temp
 *     label with input 2.
 *     e.g. three inputs, d=1.5:
 *       "[0:a][1:a]acrossfade=d=1.5:c1=tri:c2=tri[a1];"
 *       "[a1][2:a]acrossfade=d=1.5:c1=tri:c2=tri[out]"
 *
 * Returns the filtergraph string plus the label of the final output node.
 * Exported for direct unit testing of the graph logic.
 */
export function buildFilterGraph(
  numInputs: number,
  crossfadeSeconds: number
): { filter: string; outLabel: string } {
  if (numInputs < 1) {
    throw new Error("addIntroOutro: need at least one audio input.");
  }

  // A single input needs no filtering — just map it straight to the output.
  if (numInputs === 1) {
    return { filter: "", outLabel: "0:a" };
  }

  if (crossfadeSeconds > 0) {
    // Chain acrossfade across every adjacent pair.
    const steps: string[] = [];
    // The "running" label starts as the first input's audio stream.
    let prev = "0:a";
    for (let i = 1; i < numInputs; i++) {
      const isLast = i === numInputs - 1;
      const out = isLast ? "out" : `a${i}`;
      steps.push(
        `[${prev}][${i}:a]acrossfade=d=${crossfadeSeconds}:c1=tri:c2=tri[${out}]`
      );
      prev = out;
    }
    return { filter: steps.join(";"), outLabel: "out" };
  }

  // Hard-cut concatenation of all inputs in one concat filter.
  const labels = Array.from({ length: numInputs }, (_, i) => `[${i}:a]`).join(
    ""
  );
  return {
    filter: `${labels}concat=n=${numInputs}:v=0:a=1[out]`,
    outLabel: "out",
  };
}

/**
 * Combine intro/episode/outro into a single MP3 Blob (audio/mpeg).
 *
 * @param input  The episode plus optional intro/outro and crossfade.
 * @param deps   Injectable FFmpeg + fetchFile (defaults to the real ones).
 */
export async function addIntroOutro(
  input: AddIntroOutroInput,
  deps: AddIntroOutroDeps = defaultDeps
): Promise<Blob> {
  const { episode, intro, outro, onProgress } = input;
  const crossfadeSeconds = input.crossfadeSeconds ?? 0;

  // Assemble the segments in play order, skipping any that weren't provided.
  const segments: (Blob | string)[] = [];
  if (intro) segments.push(intro);
  segments.push(episode);
  if (outro) segments.push(outro);

  const ffmpeg = await deps.getFFmpeg(onProgress);

  onProgress?.("Preparing audio segments...");

  // Write each segment into FFmpeg's in-memory filesystem as in0, in1, ...
  // FFmpeg detects the format from the file contents, so no extension needed.
  const inputNames: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const name = `in${i}`;
    await ffmpeg.writeFile(name, await deps.fetchFile(segments[i]));
    inputNames.push(name);
  }

  const outputName = "output.mp3";

  // One "-i <name>" pair per input, in play order.
  const inputArgs = inputNames.flatMap((name) => ["-i", name]);

  const { filter, outLabel } = buildFilterGraph(
    inputNames.length,
    crossfadeSeconds
  );

  // Map either the filtergraph output or (single input) the raw stream, then
  // encode a standard 128k podcast MP3 — same settings as convertToMp3.
  const filterArgs = filter ? ["-filter_complex", filter] : [];

  onProgress?.(
    crossfadeSeconds > 0
      ? `Combining with a ${crossfadeSeconds}s crossfade...`
      : "Combining segments..."
  );

  await ffmpeg.exec([
    ...inputArgs,
    ...filterArgs,
    "-map",
    filter ? `[${outLabel}]` : outLabel,
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    outputName,
  ]);

  const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

  // Clean up the in-memory files so repeated runs don't accumulate.
  try {
    for (const name of inputNames) await ffmpeg.deleteFile(name);
    await ffmpeg.deleteFile(outputName);
  } catch {
    // Non-fatal — the FS is per-session and small.
  }

  onProgress?.("Done.");

  const buffer = new Uint8Array(data);
  return new Blob([buffer], { type: "audio/mpeg" });
}
