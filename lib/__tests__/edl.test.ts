import { describe, expect, it } from "vitest";
import {
  fullRange,
  keptRangesFromDeletions,
  normalizeRanges,
  subtractRange,
  subtractRanges,
  totalKept,
  type TimeRange,
} from "@/lib/audio/edl";

describe("EDL kept-range math", () => {
  it("starts by keeping the whole episode", () => {
    expect(fullRange(10)).toEqual([{ start: 0, end: 10 }]);
    expect(fullRange(0)).toEqual([]);
  });

  it("deleting a MIDDLE word splits kept audio into two ranges", () => {
    const kept = keptRangesFromDeletions(10, [{ start: 4, end: 5 }]);
    expect(kept).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 10 },
    ]);
    expect(totalKept(kept)).toBeCloseTo(9);
  });

  it("deleting ADJACENT words merges into a single cut (no zero-length gap)", () => {
    // Two touching deletions [3,4] and [4,5] should behave like one cut [3,5].
    const kept = keptRangesFromDeletions(10, [
      { start: 3, end: 4 },
      { start: 4, end: 5 },
    ]);
    expect(kept).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 10 },
    ]);
  });

  it("deleting the FIRST word trims the start", () => {
    const kept = keptRangesFromDeletions(10, [{ start: 0, end: 2 }]);
    expect(kept).toEqual([{ start: 2, end: 10 }]);
  });

  it("deleting the LAST word trims the end", () => {
    const kept = keptRangesFromDeletions(10, [{ start: 8, end: 10 }]);
    expect(kept).toEqual([{ start: 0, end: 8 }]);
  });

  it("a deleted word's time range is fully excluded from kept ranges", () => {
    const deleted: TimeRange = { start: 4.2, end: 5.7 };
    const kept = keptRangesFromDeletions(12, [deleted]);
    // No kept range may overlap the deleted span.
    for (const r of kept) {
      const overlaps = r.start < deleted.end && r.end > deleted.start;
      expect(overlaps).toBe(false);
    }
  });

  it("normalizes overlapping and out-of-order ranges", () => {
    expect(
      normalizeRanges([
        { start: 5, end: 8 },
        { start: 0, end: 6 },
      ])
    ).toEqual([{ start: 0, end: 8 }]);
  });

  it("subtractRange leaves non-overlapping ranges untouched", () => {
    const kept = [{ start: 0, end: 10 }];
    expect(subtractRange(kept, { start: 20, end: 25 })).toEqual(kept);
  });

  it("subtractRanges applies many cuts in sequence", () => {
    const kept = subtractRanges(fullRange(20), [
      { start: 2, end: 3 },
      { start: 10, end: 11 },
    ]);
    expect(kept).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 10 },
      { start: 11, end: 20 },
    ]);
  });
});
