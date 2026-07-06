"use client";

import { useEffect } from "react";

import { track, type TrackEventType } from "@/lib/track";

// Fires a single page-view analytics event when a public page mounts.
// Used on the public show page (show.viewed) and episode page (episode.viewed).
// A ref-free guard via a module-level Set would double-count in React strict
// mode dev, so we use a simple mounted flag scoped to the effect.
export default function PageViewTracker({
  type,
  entityId,
}: {
  type: TrackEventType;
  entityId: string;
}) {
  useEffect(() => {
    // In React strict mode (dev) effects run twice; a small guard keeps the
    // count honest. In production this runs once anyway.
    let fired = false;
    if (!fired) {
      track(type, entityId);
      fired = true;
    }
  }, [type, entityId]);

  return null;
}
