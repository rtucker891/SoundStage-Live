"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * Browser-side WebM -> MP3 conversion using @ffmpeg/ffmpeg (FFmpeg compiled to
 * WebAssembly). This runs entirely in the user's browser tab, so it needs no
 * server binary and sidesteps Vercel's serverless size/time limits.
 *
 * Why we do this: podcast recorders capture audio as WebM/Opus, but Apple
 * Podcasts (and most directories) require MP3. Converting at record time means
 * every new episode is submittable immediately, with no server-side backfill.
 *
 * The WASM core (~25MB) is fetched from a CDN on first use and cached by the
 * browser afterward. We load it via blob URLs so the app does NOT require
 * cross-origin-isolation (COOP/COEP) headers to be configured on the host.
 */

// Pin the core version to match @ffmpeg/ffmpeg 0.12.x.
const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Lazily create and load a single shared FFmpeg instance. Loading is the
 * expensive part (downloads the WASM core), so we only do it once per session.
 *
 * Exported so other browser-side audio features (e.g. addIntroOutro) reuse the
 * SAME loaded instance instead of downloading the ~25MB WASM core again.
 */
export async function getFFmpeg(
  onProgress?: (message: string) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
      // Uncomment for debugging conversion issues:
      // console.debug("[ffmpeg]", message);
      void message;
    });

    onProgress?.("Loading audio converter (first time may take a moment)...");

    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.js`,
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpegSingleton = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export type Mp3ConversionResult = {
  /** The converted MP3 as a File, ready to upload. */
  file: File;
  /** Size of the MP3 in bytes. */
  size: number;
  /** Duration in whole seconds (0 if it could not be determined). */
  durationSeconds: number;
  /** MIME type — always "audio/mpeg". */
  mimeType: "audio/mpeg";
};

/**
 * Convert a recorded audio Blob (typically WebM/Opus from MediaRecorder) into
 * an MP3 File suitable for podcast enclosures.
 *
 * @param input     The recorded audio blob.
 * @param baseName  File name stem (without extension), e.g. "recording-1699999999".
 * @param onProgress Optional callback for user-facing status messages.
 */
export async function convertToMp3(
  input: Blob,
  baseName: string,
  onProgress?: (message: string) => void
): Promise<Mp3ConversionResult> {
  const ffmpeg = await getFFmpeg(onProgress);

  const inputName = "input.webm";
  const outputName = "output.mp3";

  onProgress?.("Converting recording to MP3...");

  // Write the recorded blob into FFmpeg's in-memory filesystem.
  await ffmpeg.writeFile(inputName, await fetchFile(input));

  // -vn: drop any video track. -c:a libmp3lame -b:a 128k: standard podcast MP3.
  await ffmpeg.exec([
    "-i",
    inputName,
    "-vn",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    outputName,
  ]);

  const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

  // Best-effort duration: probe the MP3 by decoding its header via the browser.
  const durationSeconds = await probeDurationSeconds(data);

  // Clean up the in-memory files so repeated recordings don't accumulate.
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch {
    // Non-fatal — the FS is per-session and small.
  }

  const mp3Buffer = new Uint8Array(data);
  const blob = new Blob([mp3Buffer], { type: "audio/mpeg" });
  const file = new File([blob], `${baseName}.mp3`, { type: "audio/mpeg" });

  onProgress?.("Conversion complete.");

  return {
    file,
    size: blob.size,
    durationSeconds,
    mimeType: "audio/mpeg",
  };
}

/**
 * Determine the duration of an MP3 (in whole seconds) by loading it into a
 * hidden <audio> element. Returns 0 if the browser cannot determine it.
 */
function probeDurationSeconds(data: Uint8Array): Promise<number> {
  return new Promise((resolve) => {
    try {
      const buffer = new Uint8Array(data);
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      const cleanup = () => URL.revokeObjectURL(url);

      audio.addEventListener("loadedmetadata", () => {
        const secs =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration)
            : 0;
        cleanup();
        resolve(secs);
      });
      audio.addEventListener("error", () => {
        cleanup();
        resolve(0);
      });

      audio.src = url;
    } catch {
      resolve(0);
    }
  });
}
