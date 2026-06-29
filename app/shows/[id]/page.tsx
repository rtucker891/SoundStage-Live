"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import { getEpisodes, getShows } from "@/lib/api";

import type { Episode } from "@/types/episode";
import type { Show } from "@/types/show";

export default function ShowDetailsPage() {
  const params = useParams();

  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getShows(), getEpisodes()])
      .then(([showsData, episodesData]) => {
        const selectedShow = showsData.find(
          (item) => item.id === params.id
        );

        setShow(selectedShow || null);

        if (selectedShow) {
          setEpisodes(
            episodesData.filter(
              (episode) => episode.show === selectedShow.title
            )
          );
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading show...</p>
      ) : !show ? (
        <p className="text-red-500">Show not found.</p>
      ) : (
        <>
         <div className="flex items-center justify-between gap-6">
  <div>
    <h1 className="text-3xl font-bold">{show.title}</h1>

    <p className="mt-2 text-slate-600">
      {show.description}
    </p>
  </div>

  <a
    href={`/public-shows/${show.id}`}
    target="_blank"
    className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
  >
    View Public Show Page
  </a>
</div>

          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">
              Episodes
            </h2>

            <p className="mt-2 text-slate-600">
              {episodes.length} episode(s)
            </p>

            <div className="mt-6 space-y-4">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {episode.title}
                    </h3>

                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {episode.status}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Guest: {episode.guest}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}