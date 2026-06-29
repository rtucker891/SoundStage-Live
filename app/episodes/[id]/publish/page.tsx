"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  getAssets,
  getEpisodes,
  getShowNotes,
  updateEpisodeStatus,
} from "@/lib/api";

import type { Asset } from "@/types/asset";
import type { Episode } from "@/types/episode";
import type { ShowNote } from "@/types/show-note";

export default function EpisodePublishPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [releaseDate, setReleaseDate] = useState("");
  const [publishedMessage, setPublishedMessage] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showNote, setShowNote] = useState<ShowNote | null>(null);

  
    const [checks, setChecks] = useState({
  recording: false,
  transcript: false,
  showNotes: false,
  description: false,
  coverArt: false,
  publishPackage: false,
});

  useEffect(() => {
    async function load() {
      const episodes = await getEpisodes();
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

      const assetData = await getAssets();
      const episodeAssets = assetData.filter(
        (asset) => asset.episodeId === params.id
      );

      setAssets(episodeAssets);

      const showNotes = await getShowNotes();
      const existingShowNote = showNotes.find(
        (note) => note.episodeId === params.id
      );

      setShowNote(existingShowNote || null);
      setLoading(false);
    }

    load();
  }, [params.id]);

  const hasRecording = assets.some(
    (asset) => asset.type === "recording"
  );

  const hasTranscript = assets.some(
    (asset) => asset.type === "transcript"
  );

  const hasDescription = assets.some(
    (asset) => asset.type === "episode-description"
  );

  const hasCoverArt = assets.some(
    (asset) => asset.type === "artwork"
  );
  const hasPublishPackage = assets.some(
  (asset) => asset.type === "publish-package"
);

  const readyToPublish =
  checks.recording &&
  checks.transcript &&
  checks.showNotes &&
  checks.description &&
  checks.coverArt &&
  checks.publishPackage;

  async function handlePublish() {
    if (!episode || !readyToPublish) return;

    await updateEpisodeStatus(episode.id, "Published");

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

  function toggleCheck(key: keyof typeof checks) {
    setChecks({
      ...checks,
      [key]: !checks[key],
    });
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
          <EpisodeNavigation episodeId={episode.id} />

          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Publishing Dashboard
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Publish: {episode.title}
            </h1>

            <p className="mt-3 text-white/80">
              Show: {episode.show} · Guest: {episode.guest}
            </p>

            <span className="mt-6 inline-block rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
              {episode.status}
            </span>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-purple-200 bg-white p-6 shadow lg:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
                Final Review
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Publishing Checklist
              </h2>

              <div className="mt-6 space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={checks.recording}
                    onChange={() => toggleCheck("recording")}
                  />
                  <span>
                    Recording reviewed{" "}
                    {hasRecording ? "✓" : "(missing recording asset)"}
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={checks.transcript}
                    onChange={() => toggleCheck("transcript")}
                  />
                  <span>
                    Transcript reviewed{" "}
                    {hasTranscript ? "✓" : "(missing transcript asset)"}
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={checks.showNotes}
                    onChange={() => toggleCheck("showNotes")}
                  />
                  <span>
                    Show notes reviewed{" "}
                    {showNote ? "✓" : "(missing show notes)"}
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={checks.description}
                    onChange={() => toggleCheck("description")}
                  />
                  <span>
                    Episode description reviewed{" "}
                    {hasDescription ? "✓" : "(missing description asset)"}
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={checks.coverArt}
                    onChange={() => toggleCheck("coverArt")}
                  />
                  <span>
                    Cover art approved{" "}
                    {hasCoverArt ? "✓" : "(missing cover art)"}
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
  <input
    type="checkbox"
    checked={checks.publishPackage}
    onChange={() => toggleCheck("publishPackage")}
  />
  <span>
    Publish package reviewed{" "}
    {hasPublishPackage
      ? "✓"
      : "(missing publish package)"}
  </span>
</label>
              </div>

              <input
                type="date"
                value={releaseDate}
                onChange={(event) =>
                  setReleaseDate(event.target.value)
                }
                className="mt-6 w-full rounded-lg border border-slate-200 p-3"
              />

              <button
                onClick={handlePublish}
                disabled={!readyToPublish}
                className="mt-6 w-full rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish Episode
              </button>

             {publishedMessage && (
  <div className="mt-4 rounded-lg bg-green-100 p-4">
    <p className="text-sm font-semibold text-green-700">
      {publishedMessage}
    </p>

    <a
      href={`/listen/${episode.id}`}
      target="_blank"
      className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
    >
      View Public Page
    </a>
  </div>
)}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Episode Assets
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Publishing Package
              </h2>

              <div className="mt-5 space-y-3 text-sm">
                <p>{hasRecording ? "✓" : "○"} Recording</p>
                <p>{hasTranscript ? "✓" : "○"} Transcript</p>
                <p>{showNote ? "✓" : "○"} Show Notes</p>
                <p>{hasDescription ? "✓" : "○"} Description</p>
                <p>{hasCoverArt ? "✓" : "○"} Cover Art</p>
                <p>{hasPublishPackage ? "✓" : "○"} Publish Package</p>
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Distribution Channels
                </p>

                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>○ Spotify</p>
                  <p>○ Apple Podcasts</p>
                  <p>○ YouTube</p>
                  <p>○ RSS Feed</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}