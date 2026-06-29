"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
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
          <EpisodeNavigation episodeId={episode.id} />

          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  Episode Workspace
                </p>

                <h1 className="mt-2 text-4xl font-bold">
                  {episode.title}
                </h1>

                <p className="mt-3 text-white/80">
                  Show: {episode.show}
                </p>

                <p className="mt-1 text-white/80">
                  Guest: {episode.guest}
                </p>
              </div>

              <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                {episode.status}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow">
              <p className="text-sm font-semibold text-blue-600">
                Recording
              </p>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                Ready
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 shadow">
              <p className="text-sm font-semibold text-purple-600">
                Transcript
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-700">
                Ready
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow">
              <p className="text-sm font-semibold text-emerald-600">
                Show Notes
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                Ready
              </p>
            </div>

            <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 shadow">
              <p className="text-sm font-semibold text-pink-600">
                Publish Status
              </p>
              <p className="mt-2 text-2xl font-bold text-pink-700">
                {episode.status}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow">
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
              href={`/episodes/${episode.id}/assets`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Assets</h2>

              <p className="mt-2 text-sm text-slate-600">
                Manage recordings, transcripts, artwork, and files.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/studio`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Studio</h2>

              <p className="mt-2 text-sm text-slate-600">
                Record this episode with guests.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/editor`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Editor</h2>

              <p className="mt-2 text-sm text-slate-600">
                Edit transcript, audio, and AI cleanup.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/publish`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Publish</h2>

              <p className="mt-2 text-sm text-slate-600">
                Prepare show notes and release settings.
              </p>
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Episode Settings
              </p>

              <h2 className="text-2xl font-bold">
                Edit Episode
              </h2>
            </div>

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