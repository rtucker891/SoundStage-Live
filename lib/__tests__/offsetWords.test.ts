import { describe, expect, it } from "vitest";
import {
  chunkDurationFromContent,
  mergeChunkTranscriptions,
  type ChunkTranscription,
} from "@/lib/transcript/offsetWords";

const chunkA: ChunkTranscription = {
  text: "hello world",
  words: [
    { word: "hello", start: 0, end: 0.5 },
    { word: "world", start: 0.6, end: 1.0 },
  ],
  segments: [{ start: 0, end: 1.0, text: "hello world" }],
};

const chunkB: ChunkTranscription = {
  text: "goodbye now",
  words: [
    { word: "goodbye", start: 0, end: 0.7 },
    { word: "now", start: 0.8, end: 1.2 },
  ],
  segments: [{ start: 0, end: 1.2, text: "goodbye now" }],
};

describe("mergeChunkTranscriptions timestamp offsetting", () => {
  it("shifts the second chunk's word starts by the prior chunk's duration", () => {
    // Explicit durations: chunk A is exactly 600s long.
    const merged = mergeChunkTranscriptions([chunkA, chunkB], [600, 5]);

    // Chunk A words unchanged.
    expect(merged.words[0]).toEqual({ text: "hello", start: 0, end: 0.5 });
    expect(merged.words[1]).toEqual({ text: "world", start: 0.6, end: 1.0 });

    // Chunk B words shifted by +600.
    expect(merged.words[2]).toEqual({ text: "goodbye", start: 600, end: 600.7 });
    expect(merged.words[3]).toEqual({ text: "now", start: 600.8, end: 601.2 });

    // Segments shifted too.
    expect(merged.segments[1]).toEqual({ start: 600, end: 601.2, text: "goodbye now" });

    expect(merged.text).toBe("hello world\n\ngoodbye now");
  });

  it("falls back to each chunk's last end time when durations are missing", () => {
    // No durations provided -> chunk A's length is its last end (1.0).
    const merged = mergeChunkTranscriptions([chunkA, chunkB]);
    expect(merged.words[2].start).toBeCloseTo(1.0);
    expect(merged.words[3].start).toBeCloseTo(1.8);
  });

  it("monotonic timings never go backwards across the join", () => {
    const merged = mergeChunkTranscriptions([chunkA, chunkB], [600, 5]);
    for (let i = 1; i < merged.words.length; i++) {
      expect(merged.words[i].start).toBeGreaterThanOrEqual(
        merged.words[i - 1].start
      );
    }
  });

  it("estimates a chunk's duration from its content", () => {
    expect(chunkDurationFromContent(chunkA)).toBeCloseTo(1.0);
    expect(chunkDurationFromContent({ text: "", words: [], segments: [] })).toBe(0);
  });
});
