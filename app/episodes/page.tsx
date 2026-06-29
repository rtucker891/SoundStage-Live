"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import CreateEpisodeForm from "@/components/episodes/CreateEpisodeForm";

import {
  getAssets,
  getEpisodes,
  getShowNotes,
  getTranscripts,
} from "@/lib/api";

import type { Episode } from "@/types/episode";
import type { Asset } from "@/types/asset";
import type { Transcript } from "@/types/transcript";
import type { ShowNote } from "@/types/show-note";

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [showNotes, setShowNotes] = useState<ShowNote[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    async function load() {
      const episodeData = await getEpisodes();
      const assetData = await getAssets();
      const transcriptData = await getTranscripts();
      const showNoteData = await getShowNotes();

      setEpisodes(episodeData);
      setAssets(assetData);
      setTranscripts(transcriptData);
      setShowNotes(showNoteData);

      setLoading(false);
    }

    load();
  }, []);

  function getProductionStatus(episode: Episode) {
    const hasRecording = assets.some(
      (asset) =>
        asset.episodeId === episode.id &&
        asset.type === "recording"
    );

    const hasTranscript = transcripts.some(
      (transcript) => transcript.episodeId === episode.id
    );

    const hasShowNotes = showNotes.some(
      (note) => note.episodeId === episode.id
    );

    const isPublished = episode.status === "Published";

    return {
      hasRecording,
      hasTranscript,
      hasShowNotes,
      isPublished,
    };
  }
const publishedCount = episodes.filter(
  (episode) => episode.status === "Published"
).length;

const draftCount = 0;
const inProductionCount = episodes.length - publishedCount;
  const filteredEpisodes = episodes.filter((episode) => {
    const matchesSearch =
      episode.title.toLowerCase().includes(searchText.toLowerCase()) ||
      episode.show.toLowerCase().includes(searchText.toLowerCase()) ||
      episode.guest.toLowerCase().includes(searchText.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || episode.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell>
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Episode Library
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Episodes
        </h1>

        <p className="mt-3 text-white/80">
          Plan, record, edit, package, and publish every episode from one workspace.
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow">
    <p className="text-sm font-semibold text-slate-500">
      Total Episodes
    </p>
    <p className="mt-2 text-3xl font-bold">
      {episodes.length}
    </p>
  </div>

  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 shadow">
    <p className="text-sm font-semibold text-purple-600">
      Published
    </p>
    <p className="mt-2 text-3xl font-bold text-purple-700">
      {publishedCount}
    </p>
  </div>

  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow">
    <p className="text-sm font-semibold text-blue-600">
      In Production
    </p>
    <p className="mt-2 text-3xl font-bold text-blue-700">
      {inProductionCount}
    </p>
  </div>

  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow">
    <p className="text-sm font-semibold text-slate-600">
      Drafts
    </p>
    <p className="mt-2 text-3xl font-bold text-slate-700">
      {draftCount}
    </p>
  </div>
</div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            New Production
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Create Episode
          </h2>

          <div className="mt-6">
            <CreateEpisodeForm />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Production Queue
              </p>

              <h2 className="text-2xl font-bold">
                Episode Workspace
              </h2>
            </div>

            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
              {episodes.length} Episodes
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search episodes, shows, or guests..."
              className="rounded-xl border border-slate-200 p-3"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 p-3"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Recording">Recording</option>
              <option value="Editing">Editing</option>
              <option value="Ready to Publish">Ready to Publish</option>
              <option value="Published">Published</option>
            </select>
          </div>

          {loading ? (
            <p className="mt-6 text-slate-500">
              Loading episodes...
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {filteredEpisodes.map((episode) => {
                const production = getProductionStatus(episode);

                const coverArt = assets.find(
                  (asset) =>
                    asset.episodeId === episode.id &&
                    asset.type === "artwork"
                );

                return (
                  <div
                    key={episode.id}
                    className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
                  >
                    {coverArt ? (
                      <img
                        src={coverArt.url}
                        alt={episode.title}
                        className="mb-4 h-40 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="mb-4 flex h-40 w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-4xl text-white">
                        🎙
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {episode.status}
                      </span>

                      <span className="text-xl">🎙</span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900">
                      {episode.title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      Show: {episode.show}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Guest: {episode.guest}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white p-2 shadow-sm">
                        {production.hasRecording ? "✓" : "○"} Recording
                      </div>

                      <div className="rounded-lg bg-white p-2 shadow-sm">
                        {production.hasTranscript ? "✓" : "○"} Transcript
                      </div>

                      <div className="rounded-lg bg-white p-2 shadow-sm">
                        {production.hasShowNotes ? "✓" : "○"} Show Notes
                      </div>

                      <div className="rounded-lg bg-white p-2 shadow-sm">
                        {production.isPublished ? "✓" : "○"} Published
                      </div>
                    </div>

                    <Link
                      href={`/episodes/${episode.id}`}
                      className="mt-5 inline-block rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Open Episode
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}