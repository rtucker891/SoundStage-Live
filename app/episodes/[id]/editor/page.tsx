"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  getEpisodes,
  updateEpisodeStatus,
} from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function EpisodeEditorPage() {
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
          selectedEpisode.status === "Recording"
        ) {
          await updateEpisodeStatus(
            selectedEpisode.id,
            "Editing"
          );

          selectedEpisode.status = "Editing";
        }

        setEpisode(selectedEpisode || null);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading editor...</p>
      ) : !episode ? (
        <p className="text-red-500">Episode not found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Editor: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Show: {episode.show}
              </p>
            </div>

            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              {episode.status}
            </span>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Transcript
              </h2>

              <p className="mt-2 text-slate-600">
                Review and edit the generated transcript.
              </p>

              <div className="mt-6 rounded-lg bg-slate-100 p-4 text-sm text-slate-500">
                Transcript will appear here.
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Audio Cleanup
              </h2>

              <p className="mt-2 text-slate-600">
                Apply AI enhancements to improve quality.
              </p>

              <div className="mt-6 space-y-3">
                <button className="w-full rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white">
                  Enhance Speech
                </button>

                <button className="w-full rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white">
                  Remove Noise
                </button>

                <button className="w-full rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white">
                  Remove Silence
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Export
              </h2>

              <p className="mt-2 text-slate-600">
                Download or publish the edited audio.
              </p>

              <div className="mt-6 space-y-3">
                <button className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
                  Export MP3
                </button>

                <button className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
                  Export WAV
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}