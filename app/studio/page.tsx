"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { getEpisodes } from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function StudioPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEpisodes()
      .then((data) => setEpisodes(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div>
        <h1 className="text-3xl font-bold">Studio</h1>

        <p className="mt-2 text-slate-600">
          Choose an episode to open its recording studio.
        </p>
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow">
        <h2 className="text-2xl font-bold">Episode Studios</h2>

        {loading ? (
          <p className="mt-4 text-slate-500">Loading episodes...</p>
        ) : (
          <div className="mt-6 space-y-4">
            {episodes.map((episode) => (
              <div
                key={episode.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
              >
                <div>
                  <h3 className="font-semibold">{episode.title}</h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {episode.show} • {episode.status}
                  </p>
                </div>

                <Link
                  href={`/episodes/${episode.id}/studio`}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
                >
                  Open Studio
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}