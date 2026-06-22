"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import EditEpisodeForm from "@/components/episodes/EditEpisodeForm";

import { getEpisodes } from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function EpisodeDetailsPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEpisodes()
      .then((episodes) => {
        const selectedEpisode = episodes.find(
          (item) => item.id === params.id
        );

        setEpisode(selectedEpisode || null);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading episode...</p>
      ) : !episode ? (
        <p className="text-red-500">Episode not found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Show: {episode.show}
              </p>
            </div>

            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              {episode.status}
            </span>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">Overview</h2>

              <p className="mt-2 text-sm text-slate-600">
                Review episode details and guest information.
              </p>

              <p className="mt-6 text-sm font-semibold text-slate-500">
                Guest
              </p>

              <p className="mt-1 font-bold">
                {episode.guest}
              </p>
            </div>

            <Link
              href={`/episodes/${episode.id}/studio`}
              className="rounded-xl bg-white p-6 shadow hover:shadow-md"
            >
              <h2 className="text-xl font-bold">Studio</h2>

              <p className="mt-2 text-sm text-slate-600">
                Record this episode with guests.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/editor`}
              className="rounded-xl bg-white p-6 shadow hover:shadow-md"
            >
              <h2 className="text-xl font-bold">Editor</h2>

              <p className="mt-2 text-sm text-slate-600">
                Edit transcript, audio, and AI cleanup.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/publish`}
              className="rounded-xl bg-white p-6 shadow hover:shadow-md"
            >
              <h2 className="text-xl font-bold">Publish</h2>

              <p className="mt-2 text-sm text-slate-600">
                Prepare show notes and release settings.
              </p>
            </Link>
          </div>

          <div className="mt-8">
            <EditEpisodeForm
              episode={episode}
              onUpdate={(updatedEpisode) =>
                setEpisode(updatedEpisode)
              }
            />
          </div>
        </>
      )}
    </AppShell>
  );
}