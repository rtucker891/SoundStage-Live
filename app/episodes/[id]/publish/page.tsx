"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  getEpisodes,
  updateEpisodeStatus,
} from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function EpisodePublishPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [publishedMessage, setPublishedMessage] = useState("");

  useEffect(() => {
    getEpisodes()
      .then(async (episodes) => {
        const selectedEpisode = episodes.find(
          (item) => item.id === params.id
        );

        if (
          selectedEpisode &&
          selectedEpisode.status === "Editing"
        ) {
          await updateEpisodeStatus(
            selectedEpisode.id,
            "Ready to Publish"
          );

          selectedEpisode.status = "Ready to Publish";
        }

        setEpisode(selectedEpisode || null);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handlePublish() {
    if (!episode) return;

    await updateEpisodeStatus(
      episode.id,
      "Published"
    );

    setEpisode({
      ...episode,
      status: "Published",
    });
    setPublishedMessage(
  releaseDate
    ? `Episode published for ${releaseDate}.`
    : "Episode published successfully."
);
  }

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">
          Loading publish settings...
        </p>
      ) : !episode ? (
        <p className="text-red-500">
          Episode not found.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Publish: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Show: {episode.show}
              </p>
            </div>

            <span className="rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
              {episode.status}
            </span>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Show Notes
              </h2>

              <textarea
                rows={10}
                placeholder="Write episode summary, links, and timestamps..."
                className="mt-4 w-full rounded-lg border border-slate-200 p-3"
              />
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Distribution
              </h2>

              <div className="mt-4 space-y-4">
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked />
                  Spotify
                </label>

                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked />
                  Apple Podcasts
                </label>

                <label className="flex items-center gap-3">
                  <input type="checkbox" />
                  YouTube
                </label>

                <label className="flex items-center gap-3">
                  <input type="checkbox" />
                  RSS Feed
                </label>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Release
              </h2>

             <p className="mt-2 text-slate-600">
  Choose a release date and publish when ready.
</p>

<input
  type="date"
  value={releaseDate}
  onChange={(event) =>
    setReleaseDate(event.target.value)
  }
  className="mt-4 w-full rounded-lg border border-slate-200 p-3"
/>

<button
  onClick={handlePublish}
  className="mt-6 w-full rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white"
>
  Publish Episode
</button>
{publishedMessage && (
  <p className="mt-4 text-sm font-semibold text-green-600">
    {publishedMessage}
  </p>
)}
            
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}