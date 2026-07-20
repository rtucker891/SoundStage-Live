"use client";

import Image from "next/image";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import EditEpisodeForm from "@/components/episodes/EditEpisodeForm";

import { getEpisodes } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";

import type { Episode } from "@/types/episode";
import type { Plan } from "@/lib/plan";

// Where the separate SoundStage Studio app lives (override per-env; the button
// opens `${STUDIO_URL}/?import=<episodeId>`).
const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ?? "https://soundstage-studio.vercel.app";

export default function EpisodeDetailsPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingNotes, setGeneratingNotes] = useState(false);
const [generatedNotes, setGeneratedNotes] = useState("");
const [generatingArtwork, setGeneratingArtwork] = useState(false);
const [generatedArtwork, setGeneratedArtwork] = useState("");

  useEffect(() => {
    getEpisodes()
      .then((episodes) => {
        const selectedEpisode = episodes.find(
          (item) => item.id === params.id
        );

        setEpisode(selectedEpisode || null);
      })
      .finally(() => setLoading(false));

    // Resolve the caller's plan so the "Open in Studio" action can be gated to
    // studio_plus (same authoritative /api/plan signal the live-studio page uses).
    (async () => {
      try {
        const res = await fetch("/api/plan", { headers: await authHeaders() });
        const json = (await res.json()) as { plan?: Plan };
        setPlan(json.plan ?? "free");
      } catch {
        setPlan("free");
      }
    })();
  }, [params.id]);
  async function generateShowNotes() {
  if (!episode) return;

  setGeneratingNotes(true);

  const response = await fetch("/api/ai/show-notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
   body: JSON.stringify({
  episodeId: episode.id,
  title: episode.title,
  transcript: `Episode title: ${episode.title}. Guest: ${episode.guest}. Show: ${episode.show}.`,
}),
  });

  const data = await response.json();

  setGeneratedNotes(data.showNotes || "No show notes generated.");
  setGeneratingNotes(false);
}

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading episode...</p>
      ) : !episode ? (
        <p className="text-red-500">Episode not found.</p>
      ) : (
        <>
          <EpisodeNavigation episodeId={episode.id} />

          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  Episode Workspace
                </p>

                <h1 className="mt-2 text-4xl font-bold">
                  {episode.title}
                </h1>

                <p className="mt-3 text-white/80">
                  Show: {episode.show}
                </p>

                <p className="mt-1 text-white/80">
                  Guest: {episode.guest}
                </p>
              </div>

              <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                {episode.status}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow">
              <p className="text-sm font-semibold text-blue-600">
                Recording
              </p>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                Ready
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 shadow">
              <p className="text-sm font-semibold text-purple-600">
                Transcript
              </p>
              <p className="mt-2 text-2xl font-bold text-purple-700">
                Ready
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow">
              <p className="text-sm font-semibold text-emerald-600">
                Show Notes
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                Ready
              </p>
            </div>

            <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 shadow">
              <p className="text-sm font-semibold text-pink-600">
                Publish Status
              </p>
              <p className="mt-2 text-2xl font-bold text-pink-700">
                {episode.status}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow">
              <h2 className="text-xl font-bold">Overview</h2>

              <p className="mt-2 text-sm text-slate-600">
                Review episode details and guest information.
              </p>

              <p className="mt-6 text-sm font-semibold text-slate-500">
                Guest
              </p>

              <p className="mt-1 font-bold">
                {episode.guest}
              </p>
            </div>

            <Link
              href={`/episodes/${episode.id}/assets`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Assets</h2>

              <p className="mt-2 text-sm text-slate-600">
                Manage recordings, transcripts, artwork, and files.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/studio`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Studio</h2>

              <p className="mt-2 text-sm text-slate-600">
                Record this episode with guests.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/editor`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Editor</h2>

              <p className="mt-2 text-sm text-slate-600">
                Edit transcript, audio, and AI cleanup.
              </p>
            </Link>

            <Link
              href={`/episodes/${episode.id}/publish`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <h2 className="text-xl font-bold">Publish</h2>

              <p className="mt-2 text-sm text-slate-600">
                Prepare show notes and release settings.
              </p>
            </Link>
          </div>

          {plan === "studio_plus" && episode.status === "Published" && (
            <div className="mt-8 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-purple-50 p-6 shadow">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
                    Studio Plus
                  </p>
                  <h2 className="text-2xl font-bold">Open in Studio</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Re-edit this episode&apos;s finished audio in SoundStage
                    Studio (multitrack recording &amp; editing).
                  </p>
                </div>

                <a
                  href={`${STUDIO_URL}/?import=${episode.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-500 to-purple-700 px-5 py-3 font-semibold text-white"
                >
                  Open in Studio
                </a>
              </div>
            </div>
          )}
          <div className="mt-8 rounded-2xl border border-purple-200 bg-white p-6 shadow">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
        AI Production
      </p>

      <h2 className="text-2xl font-bold">
        Generate Show Notes
      </h2>

      <p className="mt-2 text-sm text-slate-600">
        Use AI to create a summary, key points, and takeaways for this episode.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
  <button
    onClick={generateShowNotes}
    disabled={generatingNotes}
    className="rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
  >
    {generatingNotes ? "Generating..." : "Generate Notes"}
  </button>

  <button
  type="button"
  disabled={generatingArtwork}
  onClick={async () => {
  if (!episode) return;

  setGeneratingArtwork(true);

  try {
    // Step 1: generate the image (returns a base64 data URL).
    const response = await fetch("/api/ai/cover-art", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({
        title: episode.title,
        show: episode.show,
        guest: episode.guest,
      }),
    });

    const data = await response.json();
    const generated = data.imageUrl || data.image;

    if (!response.ok || !generated) {
      setGeneratedArtwork("");
      return;
    }

    // Step 2: save it as a permanent file and attach it to the episode.
    const saveResponse = await fetch(
      `/api/episodes/${episode.id}/cover-art`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ base64: generated }),
      }
    );

    const saved = await saveResponse.json();

    // Prefer the permanent saved URL; fall back to the preview if saving
    // failed for any reason.
    setGeneratedArtwork(saved.url || generated);
  } finally {
    setGeneratingArtwork(false);
  }
}}
  className="rounded-xl border border-purple-300 bg-white px-5 py-3 font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-60"
>
  {generatingArtwork ? "Generating Artwork..." : "Generate Artwork"}
</button>
</div>
  </div>

  {generatedNotes && (
    <div className="mt-6 whitespace-pre-wrap rounded-xl bg-slate-100 p-5 text-sm text-slate-700">
      {generatedNotes}
    </div>
  )}
  {generatedArtwork && (
  <div className="mt-6">
    <p className="mb-3 text-sm font-semibold text-purple-600">
      Generated Artwork
    </p>

    <Image
      src={generatedArtwork}
      alt="Generated podcast artwork"
      width={320}
      height={320}
      unoptimized
      className="h-auto w-full max-w-xs rounded-2xl shadow"
    />
  </div>
)}
</div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Episode Settings
              </p>

              <h2 className="text-2xl font-bold">
                Edit Episode
              </h2>
            </div>

            <EditEpisodeForm
              episode={episode}
              onUpdate={(updatedEpisode) =>
                setEpisode(updatedEpisode)
              }
            />
          </div>
        </>
      )}
    </AppShell>
  );
}