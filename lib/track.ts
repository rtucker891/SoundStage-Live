// Tiny client-side analytics helper (#25).
//
// Fires a "fire-and-forget" event to the /api/track endpoint. It never throws
// and never blocks the UI — analytics must never break the page. We use
// navigator.sendBeacon when available (it survives page navigation, which
// matters for "download" and "leave" events), falling back to fetch.

export type TrackEventType =
  | "show.viewed"
  | "episode.viewed"
  | "episode.listened"
  | "episode.downloaded";

export function track(type: TrackEventType, entityId: string): void {
  if (typeof window === "undefined" || !entityId) return;

  const payload = JSON.stringify({ type, entityId });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
      return;
    }
  } catch {
    // Fall through to fetch.
  }

  // Fallback: best-effort fetch. keepalive lets it finish during navigation.
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Swallow — analytics is non-critical.
  });
}
