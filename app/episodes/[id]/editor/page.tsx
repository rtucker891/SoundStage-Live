"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  createAsset,
  createShowNote,
  createTranscript,
  getAssets,
  getEpisodes,
  getShowNotes,
  getTranscripts,
  updateEpisodeStatus,
  updateTranscript,
} from "@/lib/api";

import type { Asset } from "@/types/asset";
import type { Episode } from "@/types/episode";
import type { ShowNote } from "@/types/show-note";
import type { Transcript } from "@/types/transcript";

export default function EpisodeEditorPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showNote, setShowNote] = useState<ShowNote | null>(null);
  const [recordingAsset, setRecordingAsset] = useState<Asset | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [episodeDescription, setEpisodeDescription] = useState("");
  const [publishPackage, setPublishPackage] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [coverArtUrl, setCoverArtUrl] = useState("");
  const [coverArtPrompt, setCoverArtPrompt] = useState("");

  useEffect(() => {
    async function load() {
      const episodes = await getEpisodes();

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

      const transcripts = await getTranscripts();

      const existingTranscript = transcripts.find(
        (item) => item.episodeId === params.id
      );

      if (existingTranscript) {
        setTranscript(existingTranscript);
      }

      const showNotes = await getShowNotes();

      const existingShowNote = showNotes.find(
        (item) => item.episodeId === params.id
      );

      if (existingShowNote) {
        setShowNote(existingShowNote);
      }

      const assets = await getAssets();

      const recording = assets.find(
        (asset) =>
          asset.episodeId === params.id &&
          asset.type === "recording"
      );

      setRecordingAsset(recording || null);
      setLoading(false);
    }

    load();
  }, [params.id]);

  async function generateTranscript() {
    if (!episode || !recordingAsset?.url) return;

    setGenerating(true);

    const audioResponse = await fetch(recordingAsset.url);
    const audioBlob = await audioResponse.blob();

    const formData = new FormData();

    formData.append(
      "file",
      audioBlob,
      recordingAsset.fileName
    );

    const response = await fetch("/api/ai/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    const created = await createTranscript({
      episodeId: episode.id,
      segments: [
        {
          id: "1",
          speaker: "Speaker",
          startTime: 0,
          endTime: 0,
          text: data.text,
        },
      ],
    });

    await createAsset({
      episodeId: episode.id,
      name: "AI Transcript",
      type: "transcript",
      fileName: "transcript.json",
      fileSize: JSON.stringify(created).length,
      mimeType: "application/json",
      url: "#",
    });

    setTranscript(created);
    setGenerating(false);
  }

  async function generateShowNotes() {
    if (!episode || !transcript) return;

    const transcriptText = transcript.segments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n");

    const response = await fetch("/api/ai/show-notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript: transcriptText,
      }),
    });

    const data = await response.json();

    const created = await createShowNote({
      episodeId: episode.id,
      title: episode.title,
      summary: data.showNotes,
      bulletPoints: [],
    });

    setShowNote(created);

    await createAsset({
      episodeId: episode.id,
      name: "AI Show Notes",
      type: "show-notes",
      fileName: "ai-show-notes.md",
      fileSize: JSON.stringify(created).length,
      mimeType: "text/markdown",
      url: "#",
    });
  }

  async function saveTranscript() {
    if (!transcript) return;

    const saved = await updateTranscript({
      id: transcript.id,
      segments: transcript.segments,
    });

    setTranscript(saved);
    await generateShowNotes();

    setSaveMessage(
      "Transcript and show notes saved successfully."
    );
  }

  async function generateEpisodeDescription() {
    if (!transcript) return;

    const content = transcript.segments
      .map((segment) => segment.text)
      .join("\n");

    const response = await fetch(
      "/api/ai/episode-description",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
        }),
      }
    );

    const data = await response.json();

    setEpisodeDescription(data.description);

    if (episode) {
      await createAsset({
        episodeId: episode.id,
        name: "AI Episode Description",
        type: "episode-description",
        fileName: "episode-description.md",
        fileSize: data.description.length,
        mimeType: "text/markdown",
        url: "#",
      });
    }
  }

  async function generatePublishPackage() {
    if (!transcript || !showNote || !episode) return;

    const transcriptText = transcript.segments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n");

    const response = await fetch("/api/ai/publish-package", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript: transcriptText,
        showNotes: showNote.summary,
      }),
    });

    const data = await response.json();

    setPublishPackage(data.publishPackage);

    await createAsset({
      episodeId: episode.id,
      name: "AI Publish Package",
      type: "publish-package",
      fileName: "publish-package.md",
      fileSize: data.publishPackage.length,
      mimeType: "text/markdown",
      url: "#",
    });

    setPublishMessage(
      "Publish package generated successfully."
    );
  }

  async function generateCoverArt() {
    if (!episode) return;

    const prompt =
      coverArtPrompt ||
      `Podcast cover art for an episode titled ${episode.title}`;

    const response = await fetch("/api/ai/cover-art", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
      }),
    });

    const data = await response.json();

    setCoverArtUrl(data.imageUrl);

    await createAsset({
      episodeId: episode.id,
      name: "AI Cover Art",
      type: "artwork",
      fileName: "cover-art.png",
      fileSize: data.imageUrl.length,
      mimeType: "image/png",
      url: data.imageUrl,
    });
  }

  return (
    <AppShell>
      {loading ? (
        <p>Loading editor...</p>
      ) : !episode ? (
        <p>Episode not found.</p>
      ) : (
        <>
          <EpisodeNavigation episodeId={episode.id} />

          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  SoundStage Live Studio
                </p>

                <h1 className="mt-2 text-4xl font-bold">
                  Editor: {episode.title}
                </h1>

                <p className="mt-3 text-white/80">
                  Show: {episode.show}
                </p>
              </div>

              <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                {episode.status}
              </span>
            </div>
          </div>
<div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow">
  <h2 className="text-lg font-bold text-slate-900">
    Episode Progress
  </h2>

  <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
  <div className="rounded-xl bg-blue-50 p-3 text-center">
    <p className="text-sm font-semibold text-blue-700">
      ✓ Recording
    </p>
  </div>

  <div className="rounded-xl bg-blue-50 p-3 text-center">
    <p className="text-sm font-semibold text-blue-700">
      {transcript ? "✓ Transcript" : "○ Transcript"}
    </p>
  </div>

  <div className="rounded-xl bg-purple-50 p-3 text-center">
    <p className="text-sm font-semibold text-purple-700">
      {showNote ? "✓ Show Notes" : "○ Show Notes"}
    </p>
  </div>

  <div className="rounded-xl bg-emerald-50 p-3 text-center">
    <p className="text-sm font-semibold text-emerald-700">
      {episodeDescription ? "✓ Description" : "○ Description"}
    </p>
  </div>

  <div className="rounded-xl bg-orange-50 p-3 text-center">
    <p className="text-sm font-semibold text-orange-700">
      {publishPackage ? "✓ Publish" : "○ Publish"}
    </p>
  </div>

  <div className="rounded-xl bg-pink-50 p-3 text-center">
    <p className="text-sm font-semibold text-pink-700">
      {coverArtUrl ? "✓ Cover Art" : "○ Cover Art"}
    </p>
  </div>
</div>
  </div>

          <div className="mt-8 rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  AI Editing
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Transcript
                </h2>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                Speech to Text
              </span>
            </div>

            {!transcript ? (
              <>
                <p className="mt-4 text-slate-600">
                  Generate an AI transcript from the saved recording.
                </p>

                <button
                  onClick={generateTranscript}
                  disabled={generating}
                  className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
                >
                  {generating
                    ? "Generating..."
                    : "Generate AI Transcript"}
                </button>
              </>
            ) : (
              <div className="mt-6 space-y-6">
                {transcript.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="rounded-lg border border-blue-100 bg-white p-4"
                  >
                    <p className="font-semibold">
                      {segment.speaker}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {segment.startTime}s - {segment.endTime}s
                    </p>

                    <textarea
                      value={segment.text}
                      onChange={(event) => {
                        const updatedSegments =
                          transcript.segments.map((item) =>
                            item.id === segment.id
                              ? {
                                  ...item,
                                  text: event.target.value,
                                }
                              : item
                          );

                        setTranscript({
                          ...transcript,
                          segments: updatedSegments,
                        });
                      }}
                      className="mt-3 w-full rounded-lg border border-slate-200 p-3"
                      rows={4}
                    />

                    <button
                      onClick={saveTranscript}
                      className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
                    >
                      Save Transcript
                    </button>

                    {saveMessage && (
                      <p className="mt-3 text-sm font-semibold text-green-600">
                        {saveMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-purple-200 bg-gradient-to-br from-white to-purple-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
                  AI Content
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Show Notes
                </h2>
              </div>

              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                Summary Generated
              </span>
            </div>

            {!showNote ? (
              <>
                <p className="mt-4 text-slate-600">
                  Generate show notes from this episode.
                </p>

                <button
                  onClick={generateShowNotes}
                  className="mt-6 rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white"
                >
                  Generate Show Notes
                </button>
              </>
            ) : (
              <div className="mt-6 rounded-lg border border-purple-100 bg-white p-4">
                <h3 className="font-bold">
                  {showNote.title}
                </h3>

                <p className="mt-3 text-slate-600">
                  {showNote.summary}
                </p>

                <ul className="mt-4 list-disc space-y-2 pl-6">
                  {showNote.bulletPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                  AI Writing
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Episode Description
                </h2>
              </div>

              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                Publishing Copy
              </span>
            </div>

            <button
              onClick={generateEpisodeDescription}
              className="mt-4 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white"
            >
              Generate Episode Description
            </button>

            {episodeDescription && (
              <div className="mt-6 rounded-lg border border-emerald-100 bg-white p-4">
                <p>{episodeDescription}</p>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-orange-200 bg-gradient-to-br from-white to-orange-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                  Distribution
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Publish Package
                </h2>
              </div>

              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                Marketing Assets
              </span>
            </div>

            <button
              onClick={generatePublishPackage}
              className="mt-4 rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white"
            >
              Generate Publish Package
            </button>

            {publishMessage && (
              <p className="mt-4 text-sm font-semibold text-green-600">
                {publishMessage}
              </p>
            )}

            {publishPackage && (
              <>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(publishPackage);
                    setCopyMessage(
                      "Publish package copied successfully."
                    );
                  }}
                  className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Copy Publish Package
                </button>

                {copyMessage && (
                  <p className="mt-4 text-sm font-semibold text-green-600">
                    {copyMessage}
                  </p>
                )}

                <div className="mt-6 rounded-lg border border-orange-100 bg-white p-4 whitespace-pre-wrap">
                  {publishPackage}
                </div>
              </>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-pink-200 bg-gradient-to-br from-white to-pink-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-pink-600">
                  AI Artwork
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Cover Art Studio
                </h2>
              </div>

              <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700">
                Image Generation
              </span>
            </div>

            <input
              type="text"
              value={coverArtPrompt}
              onChange={(event) =>
                setCoverArtPrompt(event.target.value)
              }
              placeholder="Describe the cover art..."
              className="mt-4 w-full rounded-lg border border-slate-200 p-3"
            />

            <button
              onClick={generateCoverArt}
              className="mt-4 rounded-lg bg-pink-600 px-5 py-3 font-semibold text-white"
            >
              Generate Cover Art
            </button>

            {coverArtUrl && (
              <>
                <img
                  src={coverArtUrl}
                  alt="Generated Cover Art"
                  className="mt-6 rounded-xl border border-pink-200 shadow"
                />

                <a
                  href={coverArtUrl}
                  download="cover-art.png"
                  className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Download Cover Art
                </a>
              </>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}