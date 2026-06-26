"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  createAsset,
  deleteAsset,
  getAssets,
  getEpisodes,
} from "@/lib/api";

import type { Episode } from "@/types/episode";
import type { Asset } from "@/types/asset";

export default function EpisodeAssetsPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const episodes = await getEpisodes();

      const selectedEpisode = episodes.find(
        (item) => item.id === params.id
      );

      setEpisode(selectedEpisode || null);

      const allAssets = await getAssets();

      setAssets(
        allAssets.filter(
          (asset) => asset.episodeId === params.id
        )
      );

      setLoading(false);
    }

    load();
  }, [params.id]);

  async function addSampleAsset() {
    if (!episode) return;

    const asset = await createAsset({
      episodeId: episode.id,
      name: "Sample Recording",
      type: "recording",
      fileName: "recording.webm",
      fileSize: 1250000,
      mimeType: "audio/webm",
      url: "#",
    });

    setAssets((current) => [...current, asset]);
  }

  async function handleDeleteAsset(id: string) {
    await deleteAsset(id);

    setAssets((current) =>
      current.filter((asset) => asset.id !== id)
    );
  }

  return (
    <AppShell>
      {loading ? (
        <p>Loading assets...</p>
      ) : !episode ? (
        <p>Episode not found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Assets: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Manage episode files and resources.
              </p>
            </div>

            <button
              onClick={addSampleAsset}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
            >
              Add Sample Asset
            </button>
          </div>

          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">
              Episode Assets
            </h2>

            {assets.length === 0 ? (
              <p className="mt-4 text-slate-500">
                No assets yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {asset.name}
                        </h3>

                        <p className="text-sm text-slate-500">
                          {asset.type}
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                        {asset.fileName}
                      </span>
                    </div>

                    {asset.type === "recording" && (
                      <audio
                        controls
                        src={asset.url}
                        className="mt-4 w-full"
                      />
                    )}
                    {asset.type === "transcript" && (
  <a
    href={`/episodes/${episode?.id}/editor`}
    className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
  >
    View Transcript
  </a>
)}

                    <div className="mt-4 text-sm text-slate-500">
                      {(asset.fileSize / 1024).toFixed(1)} KB
                    </div>

                    <button
                      onClick={() =>
                        handleDeleteAsset(asset.id)
                      }
                      className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Delete Asset
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}