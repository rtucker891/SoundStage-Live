import { describe, expect, it } from "vitest";
import {
  keptFrameCount,
  sliceChannelsByRanges,
} from "@/lib/audio/renderFromEdl";

describe("renderFromEdl sample slicing", () => {
  // 10 frames at 10 Hz = 1 second of audio; values 0..9 make ranges easy to read.
  const sampleRate = 10;
  const channel = () => Float32Array.from({ length: 10 }, (_, i) => i);

  it("counts kept frames across ranges", () => {
    expect(keptFrameCount([{ start: 0, end: 1 }], sampleRate, 10)).toBe(10);
    expect(
      keptFrameCount([{ start: 0, end: 0.4 }, { start: 0.5, end: 1 }], sampleRate, 10)
    ).toBe(9);
  });

  it("copies only kept sample ranges, concatenated in order", () => {
    // Delete frames [4,5) -> keep [0,4) and [5,10).
    const sliced = sliceChannelsByRanges(
      [channel()],
      sampleRate,
      [
        { start: 0, end: 0.4 },
        { start: 0.5, end: 1.0 },
      ]
    );
    expect(Array.from(sliced[0])).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9]);
  });

  it("preserves multiple channels independently", () => {
    const left = channel();
    const right = Float32Array.from({ length: 10 }, (_, i) => i * 2);
    const sliced = sliceChannelsByRanges([left, right], sampleRate, [
      { start: 0.5, end: 1.0 },
    ]);
    expect(Array.from(sliced[0])).toEqual([5, 6, 7, 8, 9]);
    expect(Array.from(sliced[1])).toEqual([10, 12, 14, 16, 18]);
  });

  it("returns empty channels when nothing is kept", () => {
    const sliced = sliceChannelsByRanges([channel()], sampleRate, []);
    expect(sliced[0].length).toBe(0);
  });
});
