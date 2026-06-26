"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Asset } from "@/types/asset";

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
} from "@/lib/api";

import type { Episode } from "@/types/episode";
import type { Transcript } from "@/types/transcript";
import type { ShowNote } from "@/types/show-note";

export default function EpisodeEditorPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
const [transcript, setTranscript] = useState<Transcript | null>(null);
const [loading, setLoading] = useState(true);
const [generating, setGenerating] = useState(false);
const [showNote, setShowNote] = useState<ShowNote | null>(null);
const [audioFile, setAudioFile] = useState<File | null>(null);

const [recordingAsset, setRecordingAsset] =
  useState<Asset | null>(null);

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

      const existing = transcripts.find(
        (item) => item.episodeId === params.id
      );

      if (existing) {
        setTranscript(existing);
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

  const response = await fetch(
    "/api/ai/transcribe",
    {
      method: "POST",
      body: formData,
    }
  );

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
    .map(
      (segment) =>
        `${segment.speaker}: ${segment.text}`
    )
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

  return (
 
    <AppShell>
      {loading ? (
        <p>Loading editor...</p>
      ) : !episode ? (
        <p>Episode not found.</p>
      ) : (
       <>
  <EpisodeNavigation
    episodeId={episode.id}
  />

  <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Editor: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Show: {episode.show}
              </p>
            </div>

            <span className="rounded-full bg-amber-100 px-4 py-2 font-semibold text-amber-700">
              {episode.status}
            </span>
          </div>

          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold">
              Transcript
            </h2>

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
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <p className="font-semibold">
                      {segment.speaker}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {segment.startTime}s - {segment.endTime}s
                    </p>

                    <p className="mt-3">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
                    <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold">
              Show Notes
            </h2>

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
              <div className="mt-6">
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
        </>
      )}
    </AppShell>
  );
}