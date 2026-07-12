import { describe, it, expect } from "vitest";
import {
  detectSilenceBounds,
  trimmedSecondsRemoved,
  encodeWav,
} from "../audio/trimSilence";

// Build a mono clip: `lead` silent samples, `sound` loud samples, `tail` silent.
function clip(lead: number, sound: number, tail: number): Float32Array {
  const arr = new Float32Array(lead + sound + tail);
  for (let i = lead; i < lead + sound; i++) arr[i] = 0.5;
  return arr;
}

describe("detectSilenceBounds", () => {
  it("trims leading and trailing silence with no padding", () => {
    const samples = clip(100, 50, 100);
    const b = detectSilenceBounds(samples, 1000, {
      threshold: 0.01,
      padSeconds: 0,
    });
    expect(b.startSample).toBe(100);
    expect(b.endSample).toBe(150);
  });

  it("applies symmetric padding without exceeding clip bounds", () => {
    const samples = clip(100, 50, 100);
    // padSeconds * sampleRate = 0.02 * 1000 = 20 samples of pad.
    const b = detectSilenceBounds(samples, 1000, {
      threshold: 0.01,
      padSeconds: 0.02,
    });
    expect(b.startSample).toBe(80);
    expect(b.endSample).toBe(170);
  });

  it("clamps padding at the clip edges", () => {
    const samples = clip(5, 50, 5);
    const b = detectSilenceBounds(samples, 1000, {
      threshold: 0.01,
      padSeconds: 1, // 1000 samples — far larger than the clip
    });
    expect(b.startSample).toBe(0);
    expect(b.endSample).toBe(samples.length);
  });

  it("returns an empty range for an all-silent clip", () => {
    const b = detectSilenceBounds(new Float32Array(500), 1000);
    expect(b.startSample).toBe(0);
    expect(b.endSample).toBe(0);
  });

  it("returns an empty range for an empty clip or bad sample rate", () => {
    expect(detectSilenceBounds(new Float32Array(0), 1000)).toEqual({
      startSample: 0,
      endSample: 0,
    });
    expect(detectSilenceBounds(clip(10, 10, 10), 0)).toEqual({
      startSample: 0,
      endSample: 0,
    });
  });

  it("respects the threshold (quiet noise below threshold is trimmed)", () => {
    const samples = new Float32Array(300);
    for (let i = 0; i < 100; i++) samples[i] = 0.005; // below threshold
    for (let i = 100; i < 200; i++) samples[i] = 0.5; // above
    const b = detectSilenceBounds(samples, 1000, {
      threshold: 0.01,
      padSeconds: 0,
    });
    expect(b.startSample).toBe(100);
    expect(b.endSample).toBe(200);
  });
});

describe("trimmedSecondsRemoved", () => {
  it("computes removed seconds from kept range", () => {
    // total 250 samples @ 1000Hz = 0.25s; keep 150 → removed 100 → 0.1s
    const removed = trimmedSecondsRemoved(
      { startSample: 100, endSample: 250 },
      350,
      1000
    );
    expect(removed).toBeCloseTo(0.2, 5); // 350-150=200 samples → 0.2s
  });

  it("returns 0 for a bad sample rate", () => {
    expect(trimmedSecondsRemoved({ startSample: 0, endSample: 10 }, 100, 0)).toBe(
      0
    );
  });
});

describe("encodeWav", () => {
  it("writes a valid 44-byte RIFF/WAVE header for mono PCM", () => {
    const blob = encodeWav([new Float32Array([0, 0.5, -0.5, 1])], 8000);
    expect(blob.type).toBe("audio/wav");
    // 44 header + 4 frames * 1 channel * 2 bytes = 52 bytes
    expect(blob.size).toBe(52);
  });

  it("accounts for channel count in the byte size", () => {
    const stereo = encodeWav(
      [new Float32Array([0, 0.5]), new Float32Array([0, -0.5])],
      8000
    );
    // 44 + 2 frames * 2 channels * 2 bytes = 52
    expect(stereo.size).toBe(52);
  });
});
