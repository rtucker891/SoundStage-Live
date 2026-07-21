import { describe, expect, it } from "vitest";
import {
  deleteTimelineClip,
  formatTimelineTime,
  positionTimelineClips,
  rulerInterval,
  splitTimelineAt,
  timelineDuration,
  trimTimelineClip,
  type TimelineClip,
} from "@/lib/audio/timeline";

const clips: TimelineClip[] = [{ id: "a", label: "Episode", sourceStart: 0, sourceEnd: 10 }];

describe("browser timeline math", () => {
  it("positions ripple-edited clips on one clock", () => {
    const positioned = positionTimelineClips([
      { id: "a", label: "A", sourceStart: 1, sourceEnd: 4 },
      { id: "b", label: "B", sourceStart: 8, sourceEnd: 10 },
    ]);
    expect(positioned.map(({ timelineStart, timelineEnd }) => [timelineStart, timelineEnd])).toEqual([[0, 3], [3, 5]]);
    expect(timelineDuration(positioned)).toBe(5);
  });

  it("splits exactly at the playhead", () => {
    const result = splitTimelineAt(clips, 4.25, () => "b");
    expect(result).toEqual([
      { id: "a", label: "Episode", sourceStart: 0, sourceEnd: 4.25 },
      { id: "b", label: "Episode · split", sourceStart: 4.25, sourceEnd: 10 },
    ]);
  });

  it("ignores splits too close to an edge", () => {
    expect(splitTimelineAt(clips, 0.01, () => "b")).toBe(clips);
    expect(splitTimelineAt(clips, 9.99, () => "b")).toBe(clips);
  });

  it("trims either edge without creating a zero-length clip", () => {
    expect(trimTimelineClip(clips, "a", "start", 3)[0]).toMatchObject({ sourceStart: 3, sourceEnd: 10 });
    expect(trimTimelineClip(clips, "a", "end", 7)[0]).toMatchObject({ sourceStart: 0, sourceEnd: 7 });
    expect(trimTimelineClip(clips, "a", "start", 20)[0].sourceStart).toBeCloseTo(9.95);
  });

  it("deletes a clip and selects useful ruler intervals", () => {
    expect(deleteTimelineClip(clips, "a")).toEqual([]);
    expect(rulerInterval(600)).toBe(0.25);
    expect(rulerInterval(20)).toBe(5);
  });

  it("formats editor time labels", () => {
    expect(formatTimelineTime(65)).toBe("1:05");
    expect(formatTimelineTime(3661)).toBe("1:01:01");
    expect(formatTimelineTime(2.39, true)).toBe("0:02.3");
  });
});
