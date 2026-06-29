"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  getAssets,
  getEpisodes,
  getShowNotes,
  getTranscripts,
} from "@/lib/api";

import type { Asset } from "@/types/asset";
import type { Episode } from "@/types/episode";

export default function AssetViewerPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const episodes = await getEpisodes();

      const selectedEpisode = episodes.find(
        (item) => item.id === params.id
      );

      setEpisode(selectedEpisode || null);

      const assets = await getAssets();

      const selectedAsset = assets.find(
        (item) => item.id === params.assetId
      );

      setAsset(selectedAsset || null);

      if (selectedAsset?.type === "transcript") {
        const transcripts = await getTranscripts();

        const transcript = transcripts.find(
          (item) => item.episodeId === params.id
        );

        if (transcript) {
          setContent(
            transcript.segments
              .map(
                (segment) =>
                  `${segment.speaker}: ${segment.text}`
              )
              .join("\n\n")
          );
        }
      }

      if (selectedAsset?.type === "show-notes") {
        const showNotes = await getShowNotes();

        const showNote = showNotes.find(
          (item) => item.episodeId === params.id
        );

        if (showNote) {
          setContent(showNote.summary);
        }
      }

      setLoading(false);
    }

    load();
  }, [params.id, params.assetId]);

  return (
    <AppShell>
      {loading ? (
        <p>Loading asset...</p>
      ) : !episode || !asset ? (
        <p>Asset not found.</p>
      ) : (
        <>
          <EpisodeNavigation episodeId={episode.id} />

          <h1 className="text-3xl font-bold">
            {asset.name}
          </h1>

          <p className="mt-2 text-slate-600">
            {asset.type} • {asset.fileName}
          </p>

          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold">
              Asset Preview
            </h2>

            {asset.type === "recording" ? (
              <audio
                controls
                src={asset.url}
                className="mt-4 w-full"
              />
            ) : (
              <>
                <p className="mt-4 whitespace-pre-wrap text-slate-700">
                  {content || asset.name}
                </p>

                <p className="mt-4 text-sm text-slate-500">
                  This asset was generated and saved for this episode.
                </p>

                <a
                  href={`/episodes/${episode.id}/editor`}
                  className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Open in Editor
                </a>
              </>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}