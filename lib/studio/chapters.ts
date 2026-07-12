/**
 * lib/studio/chapters.ts — PURE, dependency-free helpers for formatting the AI
 * chapter markers shown in the Live-to-Published Studio review screen.
 *
 * Kept free of React/Supabase/browser APIs so it can be unit-tested directly
 * and reused on both server and client.
 */

export type Chapter = { startTime: number; title: string };

/**
 * Format a number of seconds as a chapter timestamp.
 *   - < 1 hour  -> "M:SS"   (e.g. 65   -> "1:05")
 *   - >= 1 hour -> "H:MM:SS" (e.g. 3661 -> "1:01:01")
 *
 * Negative, non-finite, or fractional inputs are clamped/floored so the UI
 * never renders "NaN" or a negative time from a bad AI response.
 */
export function formatTimestamp(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;

  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const two = (n: number) => n.toString().padStart(2, "0");

  return hrs > 0
    ? `${hrs}:${two(mins)}:${two(secs)}`
    : `${mins}:${two(secs)}`;
}

/**
 * Normalize a raw chapter list (possibly from an AI response) into a clean,
 * ordered, render-ready list:
 *   - drops entries without a usable title,
 *   - coerces startTime to a non-negative integer (bad values -> 0),
 *   - sorts ascending by startTime so markers are always in playback order.
 */
export function normalizeChapters(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];

  const cleaned: Chapter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { startTime, title } = item as { startTime?: unknown; title?: unknown };

    const t = typeof title === "string" ? title.trim() : "";
    if (!t) continue;

    const st =
      typeof startTime === "number" && Number.isFinite(startTime)
        ? Math.max(0, Math.floor(startTime))
        : 0;

    cleaned.push({ startTime: st, title: t });
  }

  return cleaned.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Render chapters as a plain-text list suitable for a show-notes / description
 * block, one per line: "0:00 Intro".
 */
export function chaptersToText(chapters: Chapter[]): string {
  return normalizeChapters(chapters)
    .map((c) => `${formatTimestamp(c.startTime)} ${c.title}`)
    .join("\n");
}
