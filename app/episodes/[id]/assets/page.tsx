"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  deleteAsset,
  deleteRecordingAsset,
  getAssets,
  getEpisodes,
  replaceRecordingAudio,
  uploadFileToStorage,
} from "@/lib/api";
import { convertToMp3 } from "@/lib/audio/convertToMp3";

import type { Episode } from "@/types/episode";
import type { Asset } from "@/types/asset";

export default function EpisodeAssetsPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  // Track which asset row is busy (replacing/deleting) so we can disable its
  // buttons and show a status message just for that row.
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});

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

  function setMessageFor(id: string, message: string) {
    setRowMessage((current) => ({ ...current, [id]: message }));
  }

  async function handleDeleteAsset(asset: Asset) {
    // Deleting audio is destructive and can't be undone — confirm first.
    const label =
      asset.type === "recording" ? "this audio recording" : "this asset";
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }

    setBusyAssetId(asset.id);
    setMessageFor(asset.id, "Deleting...");

    try {
      // Recordings live in three places (file + recordings row + asset row),
      // so use the full cleanup. Other asset types only have the asset row.
      if (asset.type === "recording") {
        await deleteRecordingAsset({ id: asset.id, url: asset.url });
      } else {
        await deleteAsset(asset.id);
      }

      setAssets((current) =>
        current.filter((item) => item.id !== asset.id)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setMessageFor(asset.id, `Could not delete: ${message}`);
    } finally {
      setBusyAssetId(null);
    }
  }

  async function handleReplaceAudio(
    asset: Asset,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    // Reset the input so re-picking the same file still fires onChange.
    event.target.value = "";

    if (!file) return;
    if (busyAssetId) return;

    setBusyAssetId(asset.id);
    setMessageFor(asset.id, "Preparing new audio...");

    try {
      // Convert to a standard podcast MP3, upload the new file, then point the
      // existing asset/recording at it and delete the old file.
      // Runs inside an async onChange handler (not during render), where a
      // timestamp for the upload filename is exactly the right thing to do.
      // eslint-disable-next-line react-hooks/purity
      const stem = `replace-${Date.now()}`;
      const { file: mp3File, size: mp3Size, durationSeconds } =
        await convertToMp3(file, stem, (status) =>
          setMessageFor(asset.id, status)
        );

      const uploaded = await uploadFileToStorage(
        mp3File,
        `episodes/${asset.episodeId}/recordings`
      );

      await replaceRecordingAudio({
        assetId: asset.id,
        oldUrl: asset.url,
        newUrl: uploaded.url,
        fileName: mp3File.name,
        fileSize: mp3Size,
        duration: durationSeconds,
      });

      // Update the row in place so the player points at the new audio.
      setAssets((current) =>
        current.map((item) =>
          item.id === asset.id
            ? {
                ...item,
                url: uploaded.url,
                fileName: mp3File.name,
                fileSize: mp3Size,
                mimeType: "audio/mpeg",
              }
            : item
        )
      );

      setMessageFor(asset.id, "Audio replaced successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setMessageFor(asset.id, `Could not replace audio: ${message}`);
    } finally {
      setBusyAssetId(null);
    }
  }

  return (
    <AppShell>
      {loading ? (
        <p>Loading assets...</p>
      ) : !episode ? (
        <p>Episode not found.</p>
      ) : (
        <>
          <EpisodeNavigation episodeId={episode.id} />

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Assets: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Manage episode files and resources.
              </p>
            </div>

            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              {assets.length} Assets
            </span>
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
                      <>
                        <audio
                          controls
                          src={asset.url}
                          className="mt-4 w-full"
                        />

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <a
                            href={asset.url}
                            download={asset.fileName}
                            className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Download Recording
                          </a>

                          <label
                            className={`inline-block cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white ${
                              busyAssetId ? "opacity-60" : ""
                            }`}
                          >
                            Replace Audio
                            <input
                              type="file"
                              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/webm,.mp3,.wav,.m4a,.webm"
                              onChange={(event) =>
                                handleReplaceAudio(asset, event)
                              }
                              disabled={busyAssetId !== null}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </>
                    )}

                    {asset.type === "artwork" && (
                      <>
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="mt-4 max-h-64 rounded-lg border border-slate-200"
                        />

                        <a
                          href={asset.url}
                          target="_blank"
                          className="mt-4 inline-block rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                          View Artwork
                        </a>
                      </>
                    )}

                    {asset.type === "transcript" && (
                      <a
                        href={`/episodes/${episode.id}/assets/${asset.id}`}
                        className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Transcript
                      </a>
                    )}

                    {asset.type === "show-notes" && (
                      <a
                        href={`/episodes/${episode.id}/editor`}
                        className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Show Notes
                      </a>
                    )}

                    {asset.type === "episode-description" && (
                      <a
                        href={`/episodes/${episode.id}/editor`}
                        className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Episode Description
                      </a>
                    )}

                    {asset.type === "publish-package" && (
                      <a
                        href={`/episodes/${episode.id}/editor`}
                        className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Publish Package
                      </a>
                    )}

                    <div className="mt-4 text-sm text-slate-500">
                      {(asset.fileSize / 1024).toFixed(1)} KB
                    </div>

                    {rowMessage[asset.id] && (
                      <p className="mt-3 text-sm font-semibold text-slate-600">
                        {rowMessage[asset.id]}
                      </p>
                    )}

                    <button
                      onClick={() =>
                        handleDeleteAsset(asset)
                      }
                      disabled={busyAssetId !== null}
                      className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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