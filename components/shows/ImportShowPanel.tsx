"use client";

import Image from "next/image";
import { useState } from "react";
import { previewImport, importFromRss, type ImportPreview, type ImportResult } from "@/lib/api";
import type { Show } from "@/types/show";

/**
 * ImportShowPanel — the "Import from RSS" flow (#55).
 *
 * Three steps, all in one card:
 *   1. Paste a feed URL and click "Preview" (read-only fetch, writes nothing).
 *   2. Review the show + episode count, choose whether to copy audio.
 *   3. Confirm → creates the show + episodes, then reports what happened.
 *
 * On success we hand the new show back to the parent so the list updates
 * without a full reload.
 */
export default function ImportShowPanel({
  onImported,
}: {
  onImported: (show: Show) => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [copyAudio, setCopyAudio] = useState(true);

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFeedUrl("");
    setPreview(null);
    setResult(null);
    setError(null);
    setCopyAudio(true);
  }

  async function handlePreview() {
    setError(null);
    setResult(null);
    setPreview(null);
    setPreviewing(true);
    try {
      const p = await previewImport(feedUrl.trim());
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that feed.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    setError(null);
    setImporting(true);
    try {
      const r = await importFromRss(feedUrl.trim(), copyAudio);
      setResult(r);
      onImported({
        id: r.showId,
        title: r.showTitle,
        description: preview?.description ?? "",
        episodes: r.imported,
        status: "Active",
        myRole: "owner",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
      >
        ⬇ Import from RSS
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow lg:col-span-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Import a podcast from RSS</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste an existing podcast&apos;s RSS feed address. We&apos;ll read the
            show and its episodes, then create a copy here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          Close
        </button>
      </div>

      {/* Step 1 — the URL */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="https://example.com/feed.xml"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!feedUrl.trim() || previewing}
          onClick={handlePreview}
          className="whitespace-nowrap rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {previewing ? "Reading feed…" : "Preview"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Step 2 — preview + options */}
      {preview && !result && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-4">
            {preview.imageUrl && (
              <Image
                src={preview.imageUrl}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="font-bold">{preview.title}</p>
              {preview.author && (
                <p className="text-sm text-slate-500">by {preview.author}</p>
              )}
              <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                {preview.description}
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-700">
            <span className="font-semibold">{preview.episodeCount}</span>{" "}
            episode{preview.episodeCount === 1 ? "" : "s"} found
            {preview.episodesWithAudio < preview.episodeCount && (
              <> ({preview.episodesWithAudio} with audio)</>
            )}
            {preview.episodeCount > 100 && (
              <span className="text-amber-700">
                {" "}
                — the first 100 will be imported.
              </span>
            )}
          </p>

          {preview.sampleTitles.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              {preview.sampleTitles.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
              {preview.episodeCount > preview.sampleTitles.length && (
                <li className="list-none text-slate-400">…and more</li>
              )}
            </ul>
          )}

          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={copyAudio}
              onChange={(e) => setCopyAudio(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Copy audio into SoundStage</span> —
              downloads each episode&apos;s audio so you own a permanent copy.
              Slower, but the files won&apos;t break if the original host goes
              away. Uncheck to just link the original audio (instant).
            </span>
          </label>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={importing}
              onClick={handleImport}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {importing
                ? copyAudio
                  ? "Importing & copying audio… this can take a few minutes"
                  : "Importing…"
                : `Import ${preview.episodeCount > 100 ? "100" : preview.episodeCount} episode${
                    preview.episodeCount === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — result */}
      {result && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800">
            Imported “{result.showTitle}” 🎉
          </p>
          <p className="mt-1 text-sm text-green-700">
            {result.imported} of {result.totalInFeed} episode
            {result.totalInFeed === 1 ? "" : "s"} added.
            {result.audioCopied > 0 && (
              <> {result.audioCopied} audio file(s) copied into your storage.</>
            )}
            {result.audioLinked > 0 && (
              <> {result.audioLinked} linked to the original host.</>
            )}
            {result.cappedAt && (
              <> Only the first {result.cappedAt} episodes were imported.</>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
