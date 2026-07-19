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
import { convertToMp3 } from "@/lib/audio/convertToMp3";

import type { Episode } from "@/types/episode";

export default function EpisodeStudioPage() {
  const params = useParams();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  // Shared "save an audio blob to this episode" pipeline. Both the browser
  // recorder and the file uploader feed into this so they behave identically:
  // convert to a standard podcast MP3, upload to storage, then record it as a
  // recording + asset and move the episode into the Recording state.
  async function saveAudioBlob(blob: Blob, stem: string) {
    if (!episode) return;

    const { file: audioFile, size: mp3Size, durationSeconds } =
      await convertToMp3(blob, stem, (status) => setMessage(status));

    const fileName = audioFile.name; // "<stem>.mp3"

    const uploadedFile = await uploadFileToStorage(
      audioFile,
      `episodes/${episode.id}/recordings`
    );

    const url = uploadedFile.url;

    await createRecording({
      episodeId: episode.id,
      name: `Recording ${new Date().toLocaleTimeString()}`,
      duration: durationSeconds,
      audioUrl: url,
    });

    setAudioUrl(url);

    await createAsset({
      episodeId: episode.id,
      name: `Recording ${new Date().toLocaleTimeString()}`,
      type: "recording",
      fileName,
      fileSize: mp3Size,
      mimeType: "audio/mpeg",
      url,
    });

    await updateEpisodeStatus(episode.id, "Recording");

    setEpisode({
      ...episode,
      status: "Recording",
    });
  }

  // Handle an existing audio file the user picked from their computer (e.g. a
  // Zoom/Audacity/phone recording). Reuses the same save pipeline as the
  // browser recorder.
  async function uploadAudioFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!episode) return;

    const file = event.target.files?.[0];

    // Reset the input so picking the same file again still fires onChange.
    event.target.value = "";

    if (!file) return;

    if (uploading || recording) return;

    setUploading(true);
    setMessage("Preparing your audio file...");

    try {
      const stem = `upload-${Date.now()}`;
      await saveAudioBlob(file, stem);
      setMessage("Audio uploaded and saved successfully.");
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Audio upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }

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
      // Raw browser capture is WebM/Opus. The shared pipeline converts it to a
      // standard podcast MP3 before uploading. See lib/audio.
      const webmBlob = new Blob(chunksRef.current, {
        type: "audio/webm",
      });

      await saveAudioBlob(webmBlob, `recording-${Date.now()}`);

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
  } catch {
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
                    disabled={uploading}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
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

              <div className="mt-8 border-t border-slate-200 pt-6">
                <h3 className="text-lg font-bold">
                  Upload an Audio File
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  Already recorded somewhere else? Upload an MP3, WAV, M4A, or
                  WebM file and we&apos;ll convert it to a podcast-ready MP3.
                </p>

                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/webm,.mp3,.wav,.m4a,.webm"
                  onChange={uploadAudioFile}
                  disabled={uploading || recording}
                  className="mt-4 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-60"
                />
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
                    download="recording.mp3"
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
                <p>✓ Record in the browser or upload a file</p>
                <p>✓ Files convert to podcast-ready MP3</p>
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