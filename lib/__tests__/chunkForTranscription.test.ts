import { describe, it, expect, vi } from "vitest";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

import {
  chunkForTranscription,
  buildSegmentArgs,
  chunkFileName,
  CHUNK_PATTERN,
  type ChunkForTranscriptionDeps,
} from "../audio/chunkForTranscription";

/**
 * A mock FFmpeg that pretends the segment muxer produced exactly three files:
 * chunk_000.mp3, chunk_001.mp3, chunk_002.mp3. readFile returns bytes for those
 * and throws for any other name — that "throw" is how the real reader learns it
 * has reached the end. No real WASM is loaded.
 */
function mockFFmpeg(chunkCount = 3) {
  const produced = new Set<string>();
  for (let i = 0; i < chunkCount; i++) produced.add(chunkFileName(i));

  const readOrder: string[] = [];
  const ffmpeg = {
    writeFile: vi.fn(async () => undefined),
    exec: vi.fn(async () => 0),
    readFile: vi.fn(async (name: string) => {
      if (!produced.has(name)) throw new Error(`ENOENT: ${name}`);
      readOrder.push(name);
      return new Uint8Array([1, 2, 3]);
    }),
    deleteFile: vi.fn(async () => undefined),
  };
  return { ffmpeg, readOrder };
}

function makeDeps(ffmpeg: unknown): ChunkForTranscriptionDeps {
  return {
    getFFmpeg: vi.fn(async () => ffmpeg as FFmpeg),
    fetchFile: vi.fn(async () => new Uint8Array([0])),
  };
}

const source = new Blob(["compressed-episode"], { type: "audio/mpeg" });

describe("buildSegmentArgs", () => {
  it("uses the segment muxer with stream copy and the chunk pattern", () => {
    const args = buildSegmentArgs("in.mp3", 600, CHUNK_PATTERN);

    // -i in.mp3
    expect(args[args.indexOf("-i") + 1]).toBe("in.mp3");
    // -f segment
    expect(args[args.indexOf("-f") + 1]).toBe("segment");
    // -segment_time 600
    expect(args[args.indexOf("-segment_time") + 1]).toBe("600");
    // -c copy (no re-encode)
    expect(args[args.indexOf("-c") + 1]).toBe("copy");
    // output pattern is last
    expect(args[args.length - 1]).toBe(CHUNK_PATTERN);
  });
});

describe("chunkFileName", () => {
  it("zero-pads to three digits like FFmpeg's %03d", () => {
    expect(chunkFileName(0)).toBe("chunk_000.mp3");
    expect(chunkFileName(2)).toBe("chunk_002.mp3");
    expect(chunkFileName(42)).toBe("chunk_042.mp3");
  });
});

describe("chunkForTranscription", () => {
  it("collects sequential chunk files in order until a read fails", async () => {
    const { ffmpeg, readOrder } = mockFFmpeg(3);
    const deps = makeDeps(ffmpeg);

    const chunks = await chunkForTranscription({ source }, deps);

    expect(chunks).toHaveLength(3);
    for (const chunk of chunks) expect(chunk.type).toBe("audio/mpeg");

    // Read in index order 000, 001, 002 (003 threw, ending the loop).
    expect(readOrder).toEqual([
      "chunk_000.mp3",
      "chunk_001.mp3",
      "chunk_002.mp3",
    ]);
  });

  it("cleans up the input and every chunk file afterward", async () => {
    const { ffmpeg } = mockFFmpeg(3);
    const deps = makeDeps(ffmpeg);

    await chunkForTranscription({ source }, deps);

    expect(ffmpeg.deleteFile).toHaveBeenCalledWith("chunk-input.mp3");
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith("chunk_000.mp3");
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith("chunk_001.mp3");
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith("chunk_002.mp3");
  });

  it("reports progress via the callback", async () => {
    const { ffmpeg } = mockFFmpeg(1);
    const deps = makeDeps(ffmpeg);
    const onProgress = vi.fn();

    await chunkForTranscription({ source, onProgress }, deps);

    expect(onProgress).toHaveBeenCalledWith("Splitting audio into parts…");
  });
});
