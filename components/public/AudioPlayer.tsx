"use client";

import { useRef } from "react";

import { track } from "@/lib/track";

// Client-side audio player that records analytics (#25):
//   - episode.listened  → fired once, the first time the listener presses play.
//   - episode.downloaded → fired when the listener clicks the Download link.
//
// A "listen" is counted on first play (not on every play/pause) so replays and
// scrubbing don't inflate the number.
export default function AudioPlayer({
  src,
  type,
  episodeId,
}: {
  src: string;
  type: string;
  episodeId: string;
}) {
  const listenedRef = useRef(false);

  function handlePlay() {
    if (listenedRef.current) return;
    listenedRef.current = true;
    track("episode.listened", episodeId);
  }

  return (
    <div>
      <audio
        controls
        className="mt-6 w-full"
        onPlay={handlePlay}
      >
        <source src={src} type={type} />
        Your browser does not support the audio element.
      </audio>

      <a
        href={src}
        download
        onClick={() => track("episode.downloaded", episodeId)}
        className="mt-4 inline-block rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
      >
        Download episode
      </a>
    </div>
  );
}
