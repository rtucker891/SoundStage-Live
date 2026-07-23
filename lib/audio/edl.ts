/**
 * edl.ts — a tiny Edit Decision List (EDL) for Descript-style transcript
 * editing.
 *
 * An EDL is just an ordered list of the audio time ranges we want to KEEP.
 * Instead of destructively chopping the source audio when the user deletes a
 * word, we recompute which spans of the ORIGINAL audio survive. This keeps the
 * original untouched (so edits are fully reversible/undoable) and defers the
 * one expensive render until export time.
 *
 * All times are in seconds. Ranges are half-open-ish spans {start, end} with
 * start < end. `keptRanges` are always sorted, non-overlapping, and merged.
 */

export type TimeRange = { start: number; end: number };

const EPS = 1e-6;

/** The whole episode is kept initially: a single range [0, duration]. */
export function fullRange(duration: number): TimeRange[] {
  if (!(duration > 0)) return [];
  return [{ start: 0, end: duration }];
}

/** Total kept length in seconds. */
export function totalKept(ranges: TimeRange[]): number {
  return ranges.reduce((sum, r) => sum + Math.max(0, r.end - r.start), 0);
}

/** Sort + merge adjacent/overlapping ranges into a clean canonical form. */
export function normalizeRanges(ranges: TimeRange[]): TimeRange[] {
  const valid = ranges
    .filter((r) => r.end - r.start > EPS)
    .sort((a, b) => a.start - b.start);

  const out: TimeRange[] = [];
  for (const r of valid) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + EPS) {
      // Overlapping or touching -> merge.
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ start: r.start, end: r.end });
    }
  }
  return out;
}

/**
 * Subtract a single [start, end] cut from the kept ranges. A cut in the middle
 * of a kept range splits it into two; a cut at an edge trims that edge; a cut
 * spanning a whole range removes it.
 */
export function subtractRange(
  kept: TimeRange[],
  cut: TimeRange
): TimeRange[] {
  const cs = cut.start;
  const ce = cut.end;
  if (!(ce - cs > EPS)) return normalizeRanges(kept);

  const out: TimeRange[] = [];
  for (const r of kept) {
    // No overlap: keep as-is.
    if (ce <= r.start + EPS || cs >= r.end - EPS) {
      out.push(r);
      continue;
    }
    // Left remainder (before the cut).
    if (cs > r.start + EPS) out.push({ start: r.start, end: Math.max(r.start, cs) });
    // Right remainder (after the cut).
    if (ce < r.end - EPS) out.push({ start: Math.min(r.end, ce), end: r.end });
  }
  return normalizeRanges(out);
}

/** Subtract many cuts (e.g. every deleted word's [start, end]). */
export function subtractRanges(
  kept: TimeRange[],
  cuts: TimeRange[]
): TimeRange[] {
  return cuts.reduce((acc, cut) => subtractRange(acc, cut), normalizeRanges(kept));
}

/**
 * Compute kept ranges directly from the full duration and the set of deleted
 * word spans. This is the model the UI drives: given the original duration and
 * which words were deleted, what audio survives?
 */
export function keptRangesFromDeletions(
  duration: number,
  deletedSpans: TimeRange[]
): TimeRange[] {
  return subtractRanges(fullRange(duration), deletedSpans);
}
