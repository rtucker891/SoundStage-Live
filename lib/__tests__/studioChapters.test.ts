import { describe, it, expect } from "vitest";
import {
  formatTimestamp,
  normalizeChapters,
  chaptersToText,
} from "../studio/chapters";

describe("formatTimestamp", () => {
  it("formats sub-hour times as M:SS", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(5)).toBe("0:05");
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(600)).toBe("10:00");
  });

  it("formats hour-plus times as H:MM:SS", () => {
    expect(formatTimestamp(3600)).toBe("1:00:00");
    expect(formatTimestamp(3661)).toBe("1:01:01");
  });

  it("floors fractional seconds", () => {
    expect(formatTimestamp(65.9)).toBe("1:05");
  });

  it("clamps negative and non-finite input to 0:00", () => {
    expect(formatTimestamp(-10)).toBe("0:00");
    expect(formatTimestamp(NaN)).toBe("0:00");
    expect(formatTimestamp(Infinity)).toBe("0:00");
  });
});

describe("normalizeChapters", () => {
  it("drops entries without a usable title and trims titles", () => {
    const out = normalizeChapters([
      { startTime: 0, title: "  Intro  " },
      { startTime: 10, title: "" },
      { startTime: 20 },
    ]);
    expect(out).toEqual([{ startTime: 0, title: "Intro" }]);
  });

  it("sorts ascending by startTime and coerces bad times to 0", () => {
    const out = normalizeChapters([
      { startTime: 30, title: "Third" },
      { startTime: "bad" as unknown as number, title: "First" },
      { startTime: 15, title: "Second" },
    ]);
    expect(out).toEqual([
      { startTime: 0, title: "First" },
      { startTime: 15, title: "Second" },
      { startTime: 30, title: "Third" },
    ]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeChapters(null)).toEqual([]);
    expect(normalizeChapters("nope")).toEqual([]);
  });
});

describe("chaptersToText", () => {
  it("renders one 'timestamp title' line per chapter, in order", () => {
    const text = chaptersToText([
      { startTime: 65, title: "Topic" },
      { startTime: 0, title: "Intro" },
    ]);
    expect(text).toBe("0:00 Intro\n1:05 Topic");
  });
});
