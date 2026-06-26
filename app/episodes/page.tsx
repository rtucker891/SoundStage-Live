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
      (transcript) =>
        transcript.episodeId === episode.id
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

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Episodes</h1>

          <p className="mt-2 text-slate-600">
            Plan, record, edit, and publish your episodes.
          </p>
           </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <CreateEpisodeForm />

        <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
          {loading ? (
            <p className="text-slate-500">Loading episodes...</p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
  <th className="pb-4">Episode</th>
  <th className="pb-4">Show</th>
  <th className="pb-4">Status</th>
  <th className="pb-4">Guest</th>
  <th className="pb-4">Production</th>
</tr>
              </thead>

              <tbody>
                {episodes.map((episode) => (
                  <tr
                    key={episode.id}
                    className="border-b border-slate-100"
                  >
                    <td className="py-4 font-semibold">
                      <Link
                        href={`/episodes/${episode.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {episode.title}
                      </Link>
                    </td>

                    <td className="py-4">{episode.show}</td>

                    <td className="py-4">
                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {episode.status}
                      </span>
                    </td>

                    <td className="py-4">{episode.guest}</td>
                  <td className="py-4">
  {(() => {
    const production =
      getProductionStatus(episode);

    return (
      <div className="text-xs space-y-1">
        <div>
          {production.hasRecording ? "✓" : "○"} Recording
        </div>

        <div>
          {production.hasTranscript ? "✓" : "○"} Transcript
        </div>

        <div>
          {production.hasShowNotes ? "✓" : "○"} Show Notes
        </div>

        <div>
          {production.isPublished ? "✓" : "○"} Published
        </div>
      </div>
    );
  })()}
</td>  
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}