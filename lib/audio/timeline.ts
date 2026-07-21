export const MIN_CLIP_SECONDS = 0.05;

export type TimelineClip = {
  id: string;
  label: string;
  sourceStart: number;
  sourceEnd: number;
};

export type PositionedTimelineClip = TimelineClip & {
  timelineStart: number;
  timelineEnd: number;
  duration: number;
};

export function clipDuration(clip: TimelineClip) {
  return Math.max(0, clip.sourceEnd - clip.sourceStart);
}

export function positionTimelineClips(clips: TimelineClip[]): PositionedTimelineClip[] {
  let cursor = 0;
  return clips.map((clip) => {
    const duration = clipDuration(clip);
    const positioned = { ...clip, duration, timelineStart: cursor, timelineEnd: cursor + duration };
    cursor += duration;
    return positioned;
  });
}

export function timelineDuration(clips: TimelineClip[]) {
  return clips.reduce((total, clip) => total + clipDuration(clip), 0);
}

export function splitTimelineAt(clips: TimelineClip[], timelineTime: number, createId: () => string) {
  const positioned = positionTimelineClips(clips);
  const target = positioned.find(
    (clip) => timelineTime > clip.timelineStart + MIN_CLIP_SECONDS && timelineTime < clip.timelineEnd - MIN_CLIP_SECONDS,
  );
  if (!target) return clips;

  const sourceSplit = target.sourceStart + (timelineTime - target.timelineStart);
  const index = clips.findIndex((clip) => clip.id === target.id);
  const left = { ...clips[index], sourceEnd: sourceSplit };
  const right = { ...clips[index], id: createId(), sourceStart: sourceSplit, label: `${clips[index].label} · split` };
  return [...clips.slice(0, index), left, right, ...clips.slice(index + 1)];
}

export function trimTimelineClip(
  clips: TimelineClip[],
  clipId: string,
  edge: "start" | "end",
  sourceTime: number,
) {
  return clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    if (edge === "start") {
      return { ...clip, sourceStart: Math.min(Math.max(0, sourceTime), clip.sourceEnd - MIN_CLIP_SECONDS) };
    }
    return { ...clip, sourceEnd: Math.max(clip.sourceStart + MIN_CLIP_SECONDS, sourceTime) };
  });
}

export function deleteTimelineClip(clips: TimelineClip[], clipId: string) {
  return clips.filter((clip) => clip.id !== clipId);
}

export function rulerInterval(pixelsPerSecond: number, minimumPixels = 84) {
  const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200];
  return intervals.find((interval) => interval * pixelsPerSecond >= minimumPixels) ?? intervals.at(-1)!;
}

export function formatTimelineTime(seconds: number, precise = false) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const fraction = precise ? `.${Math.floor((safe % 1) * 10)}` : "";
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}${fraction}`;
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}${fraction}`;
}
