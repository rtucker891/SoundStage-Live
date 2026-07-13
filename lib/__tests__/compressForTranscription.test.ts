import { describe, it, expect, vi } from "vitest";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

import {
  compressForTranscription,
  buildCompressionArgs,
  type CompressForTranscriptionDeps,
} from "../audio/compressForTranscription";

/**
 * A mock FFmpeg instance recording every call. We only implement the four
 * methods compressForTranscription touches; no real WASM is loaded.
 */
function mockFFmpeg() {
  const written: string[] = [];
  const ffmpeg = {
    writeFile: vi.fn(async (name: string) => {
      written.push(name);
    }),
    exec: vi.fn(async () => 0),
    readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
    deleteFile: vi.fn(async () => undefined),
  };
  return { ffmpeg, written };
}

function makeDeps(ffmpeg: unknown): CompressForTranscriptionDeps {
  return {
    getFFmpeg: vi.fn(async () => ffmpeg as FFmpeg),
    fetchFile: vi.fn(async () => new Uint8Array([0])),
  };
}

const source = new Blob(["episode"], { type: "audio/mpeg" });

/** Pull the single exec() argv out of the mock. */
function execArgs(ffmpeg: { exec: { mock: { calls: unknown[][] } } }): string[] {
  expect(ffmpeg.exec.mock.calls).toHaveLength(1);
  return ffmpeg.exec.mock.calls[0][0] as string[];
}

/** Assert a "-flag value" pair appears together in the argv. */
function expectFlagValue(args: string[], flag: string, value: string) {
  const i = args.indexOf(flag);
  expect(i).toBeGreaterThanOrEqual(0);
  expect(args[i + 1]).toBe(value);
}

describe("buildCompressionArgs", () => {
  it("includes the speech-optimized flags", () => {
    const args = buildCompressionArgs("in", "out.mp3");
    expectFlagValue(args, "-ac", "1"); // mono
    expectFlagValue(args, "-ar", "16000"); // 16 kHz
    expectFlagValue(args, "-b:a", "32k"); // low bitrate
    expectFlagValue(args, "-c:a", "libmp3lame"); // LAME MP3
    expect(args).toContain("-vn"); // drop video/art
    // Input and output are wired up correctly.
    expectFlagValue(args, "-i", "in");
    expect(args[args.length - 1]).toBe("out.mp3");
  });
});

describe("compressForTranscription", () => {
  it("runs FFmpeg with the speech-optimized argv and returns an MP3 Blob", async () => {
    const { ffmpeg, written } = mockFFmpeg();
    const deps = makeDeps(ffmpeg);

    const out = await compressForTranscription({ source }, deps);

    // Wrote the source in, before exec.
    expect(written).toEqual(["transcribe-input"]);

    const args = execArgs(ffmpeg);
    expectFlagValue(args, "-ac", "1");
    expectFlagValue(args, "-ar", "16000");
    expectFlagValue(args, "-b:a", "32k");
    expectFlagValue(args, "-c:a", "libmp3lame");

    expect(out.type).toBe("audio/mpeg");
  });

  it("cleans up its in-memory files afterward", async () => {
    const { ffmpeg } = mockFFmpeg();
    const deps = makeDeps(ffmpeg);

    await compressForTranscription({ source }, deps);

    expect(ffmpeg.deleteFile).toHaveBeenCalledWith("transcribe-input");
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith("transcribe-output.mp3");
    expect(ffmpeg.deleteFile).toHaveBeenCalledTimes(2);
  });

  it("reports progress via the callback", async () => {
    const { ffmpeg } = mockFFmpeg();
    const deps = makeDeps(ffmpeg);
    const onProgress = vi.fn();

    await compressForTranscription({ source, onProgress }, deps);

    expect(onProgress).toHaveBeenCalledWith("Compressing audio…");
  });
});
