"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  getEpisodes,
  updateEpisodeStatus,
} from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function EpisodeStudioPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEpisodes()
      .then(async (episodes) => {
        const selectedEpisode = episodes.find(
          (item) => item.id === params.id
        );

        if (
          selectedEpisode &&
          selectedEpisode.status === "Planning"
        ) {
          await updateEpisodeStatus(
            selectedEpisode.id,
            "Recording"
          );

          selectedEpisode.status = "Recording";
        }

        setEpisode(selectedEpisode || null);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading studio...</p>
      ) : !episode ? (
        <p className="text-red-500">Episode not found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Studio: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Show: {episode.show}
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
              {episode.status}
            </span>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Microphone Check
              </h2>

              <p className="mt-2 text-slate-600">
                Verify microphone access and audio quality.
              </p>

              <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white">
                Test Microphone
              </button>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Guest Room
              </h2>

              <p className="mt-2 text-slate-600">
                Guest: {episode.guest}
              </p>

              <button className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
                Invite Guest
              </button>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Recording
              </h2>

              <p className="mt-2 text-slate-600">
                Recording status: Idle
              </p>

              <button className="mt-6 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white">
                Start Recording
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}