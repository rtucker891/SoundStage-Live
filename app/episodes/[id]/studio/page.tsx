"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  createRecording,
  getEpisodes,
  updateEpisodeStatus,
} from "@/lib/api";

import type { Episode } from "@/types/episode";

type SavedRecording = {
  id: string;
  name: string;
  duration: number;
  audioUrl: string;
};

export default function EpisodeStudioPage() {
  const params = useParams();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>(
    []
  );
  const [micStatus, setMicStatus] = useState("Not tested");

  useEffect(() => {
    getEpisodes()
      .then(async (episodes) => {
        const selectedEpisode = episodes.find(
          (item) => item.id === params.id
        );

        if (
          selectedEpisode &&
          selectedEpisode.status === "Planning"
        ) {
          await updateEpisodeStatus(
            selectedEpisode.id,
            "Recording"
          );

          selectedEpisode.status = "Recording";
        }

        setEpisode(selectedEpisode || null);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function testMicrophone() {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      stream.getTracks().forEach((track) => track.stop());

      setMicStatus("Microphone ready");
    } catch {
      setMicStatus("Microphone access denied");
    }
  }

  async function startRecording() {
    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

    audioChunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      const url = URL.createObjectURL(audioBlob);

      setAudioUrl(url);

      if (episode) {
        const savedRecording = await createRecording({
          episodeId: episode.id,
          name: `Recording ${new Date().toLocaleTimeString()}`,
          duration: recordingTime,
          audioUrl: url,
        });

        setSavedRecordings((current) => [
          ...current,
          savedRecording,
        ]);
      }

      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();

    setRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime((time) => time + 1);
    }, 1000);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();

    setRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }

  const minutes = Math.floor(recordingTime / 60);
  const seconds = recordingTime % 60;

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading studio...</p>
      ) : !episode ? (
        <p className="text-red-500">Episode not found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Studio: {episode.title}
              </h1>

              <p className="mt-2 text-slate-600">
                Show: {episode.show}
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
              {episode.status}
            </span>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Microphone Check
              </h2>

              <p className="mt-2 text-slate-600">
                Verify microphone access before recording.
              </p>

              <p className="mt-4 text-sm font-semibold text-slate-500">
                Status: {micStatus}
              </p>

              <button
                onClick={testMicrophone}
                className="mt-6 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white"
              >
                Test Microphone
              </button>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">Guest Room</h2>

              <p className="mt-2 text-slate-600">
                Guest: {episode.guest}
              </p>

              <button className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
                Invite Guest
              </button>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">Recording</h2>

              <p className="mt-2 text-slate-600">
                Recording timer:{" "}
                {String(minutes).padStart(2, "0")}:
                {String(seconds).padStart(2, "0")}
              </p>

              {!recording ? (
                <button
                  onClick={startRecording}
                  className="mt-6 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="mt-6 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white"
                >
                  Stop Recording
                </button>
              )}
            </div>
          </div>

          {audioUrl && (
            <div className="mt-8 rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                Recording Preview
              </h2>

              <p className="mt-2 text-slate-600">
                Listen to your recording.
              </p>

              <audio
                controls
                src={audioUrl}
                className="mt-6 w-full"
              />
            </div>
          )}

          {savedRecordings.length > 0 && (
            <div className="mt-8 rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold">Audio Library</h2>

              <p className="mt-2 text-slate-600">
                Saved recordings for this episode.
              </p>

              <div className="mt-6 space-y-4">
                {savedRecordings.map((recording) => (
                  <div
                    key={recording.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {recording.name}
                      </p>

                      <p className="text-sm text-slate-500">
                        {recording.duration} sec
                      </p>
                    </div>

                    <audio
                      controls
                      src={recording.audioUrl}
                      className="mt-4 w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}