"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  createAsset,
  getEpisodes,
  updateEpisodeStatus,
} from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function EpisodeStudioPage() {
  const params = useParams();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const episodes = await getEpisodes();

      const selectedEpisode = episodes.find(
        (item) => item.id === params.id
      );

      setEpisode(selectedEpisode || null);
      setLoading(false);
    }

    load();
  }, [params.id]);

  async function startRecording() {
    if (!episode) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: "audio/webm",
      });

      const formData = new FormData();

formData.append(
  "file",
  blob,
  `recording-${Date.now()}.webm`
);

formData.append("episodeId", episode.id);
formData.append(
  "name",
  `Recording ${new Date().toLocaleTimeString()}`
);

const uploadResponse = await fetch(
  "/api/recordings",
  {
    method: "POST",
    body: formData,
  }
);

const uploadedRecording =
  await uploadResponse.json();

const url = uploadedRecording.audioUrl;

      setAudioUrl(url);

      await createAsset({
        episodeId: episode.id,
        name: `Recording ${new Date().toLocaleTimeString()}`,
        type: "recording",
        fileName: `recording-${Date.now()}.webm`,
        fileSize: blob.size,
        mimeType: "audio/webm",
        url,
      });

      await updateEpisodeStatus(episode.id, "Recording");

      setEpisode({
        ...episode,
        status: "Recording",
      });

      setMessage("Recording saved as an asset.");
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();

    setRecording(true);
    setMessage("Recording started...");
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setMessage("Recording stopped.");
  }

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading studio...</p>
      ) : !episode ? (
        <p className="text-red-500">Episode not found.</p>
      ) : (
        <>
  <EpisodeNavigation
    episodeId={episode.id}
  />

  <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Studio: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Show: {episode.show}
              </p>
            </div>

            <div className="flex items-center gap-3">
  <Link
    href={`/episodes/${episode.id}/assets`}
    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
  >
    View Assets
  </Link>

  <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
    {episode.status}
  </span>
</div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
              <h2 className="text-2xl font-bold">
                Recording Studio
              </h2>

              <p className="mt-2 text-slate-600">
                Record audio for this episode directly in the browser.
              </p>

              <div className="mt-6 flex gap-4">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
                  >
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white"
                  >
                    Stop Recording
                  </button>
                )}
              </div>

              {message && (
                <p className="mt-4 text-sm font-semibold text-slate-600">
                  {message}
                </p>
              )}

              {audioUrl && (
                <div className="mt-6">
                  <h3 className="font-bold">Latest Recording</h3>

                  <audio
                    controls
                    src={audioUrl}
                    className="mt-3 w-full"
                  />

                  <a
                    href={audioUrl}
                    download="recording.webm"
                    className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Download Recording
                  </a>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Studio Checklist
              </h2>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>✓ Microphone access required</p>
                <p>✓ Recording saves as an asset</p>
                <p>✓ Recording can be replayed</p>
                <p>✓ Recording can be downloaded</p>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}