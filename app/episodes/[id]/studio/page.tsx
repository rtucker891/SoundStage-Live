"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  createAsset,
  createRecording,
  getEpisodes,
  updateEpisodeStatus,
  uploadFileToStorage,
} from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function EpisodeStudioPage() {
  const params = useParams();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  try {
    setMessage("Requesting microphone access...");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    streamRef.current = stream;
    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
     try { 
      const blob = new Blob(chunksRef.current, {
        type: "audio/webm",
      });

      const fileName = `recording-${Date.now()}.webm`;

      const recordingFile = new File([blob], fileName, {
        type: "audio/webm",
      });

      const uploadedFile = await uploadFileToStorage(
        recordingFile,
        `episodes/${episode.id}/recordings`
      );

      const url = uploadedFile.url;

      await createRecording({
        episodeId: episode.id,
        name: `Recording ${new Date().toLocaleTimeString()}`,
        duration: 0,
        audioUrl: url,
      });

      setAudioUrl(url);

      await createAsset({
        episodeId: episode.id,
        name: `Recording ${new Date().toLocaleTimeString()}`,
        type: "recording",
        fileName,
        fileSize: blob.size,
        mimeType: "audio/webm",
        url,
      });

      await updateEpisodeStatus(episode.id, "Recording");

      setEpisode({
        ...episode,
        status: "Recording",
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());

      setMessage("Recording saved successfully.");
      } catch (error) {
  if (error instanceof Error) {
    setMessage(error.message);
  } else {
    setMessage("Recording upload failed.");
  }
}
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();

    setRecording(true);
    setMessage("Recording started...");
  } catch (error) {
    setMessage("Unable to start recording. Check microphone permission.");
  }

  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setMessage("Recording stopped. Saving file...");
  }

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading studio...</p>
      ) : !episode ? (
        <p className="text-red-500">Episode not found.</p>
      ) : (
        <>
          <EpisodeNavigation episodeId={episode.id} />

          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Recording Studio
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              {episode.title}
            </h1>

            <p className="mt-3 text-white/80">
              Show: {episode.show} · Guest: {episode.guest}
            </p>

            <div className="mt-6 flex gap-3">
              <Link
                href={`/episodes/${episode.id}/assets`}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              >
                View Assets
              </Link>

              <span className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold">
                {episode.status}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow lg:col-span-2">
              <h2 className="text-2xl font-bold">
                Browser Recorder
              </h2>

              <p className="mt-2 text-slate-600">
                Record audio for this episode directly in the browser.
              </p>

              <div className="mt-6 flex gap-4">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white"
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
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
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

            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Studio Checklist
              </h2>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>✓ Microphone access required</p>
                <p>✓ Recording saves as an asset</p>
                <p>✓ Recording can be replayed</p>
                <p>✓ Recording can be downloaded</p>
                <p>✓ Episode status updates automatically</p>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}