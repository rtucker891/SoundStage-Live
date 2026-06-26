"use client";

import Link from "next/link";

type EpisodeNavigationProps = {
  episodeId: string;
};

export default function EpisodeNavigation({
  episodeId,
}: EpisodeNavigationProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <Link
        href={`/episodes/${episodeId}`}
        className="rounded-lg bg-slate-200 px-4 py-2 font-semibold"
      >
        Overview
      </Link>

      <Link
        href={`/episodes/${episodeId}/studio`}
        className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
      >
        Studio
      </Link>

      <Link
        href={`/episodes/${episodeId}/assets`}
        className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"
      >
        Assets
      </Link>

      <Link
        href={`/episodes/${episodeId}/editor`}
        className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white"
      >
        Editor
      </Link>

      <Link
        href={`/episodes/${episodeId}/publish`}
        className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white"
      >
        Publish
      </Link>
    </div>
  );
}