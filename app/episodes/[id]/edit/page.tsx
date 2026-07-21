"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import { getAssets, getEpisodes } from "@/lib/api";
import { studioDeepLink } from "@/lib/studioBridge";
import type { Asset } from "@/types/asset";
import type { Episode } from "@/types/episode";

export default function EpisodeEditChoicePage() {
  const params = useParams();
  const episodeId = String(params.id || "");
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [audio, setAudio] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [launchAttempted, setLaunchAttempted] = useState(false);

  useEffect(() => {
    Promise.all([getEpisodes(), getAssets()])
      .then(([episodes, assets]) => {
        setEpisode(episodes.find((item) => item.id === episodeId) || null);
        setAudio(assets.find((item) => item.episodeId === episodeId && item.type === "recording") || null);
      })
      .finally(() => setLoading(false));
  }, [episodeId]);

  const desktopHref = useMemo(() => studioDeepLink(episodeId), [episodeId]);

  return (
    <AppShell>
      {loading ? <div className="rounded-2xl bg-white p-6 shadow">Loading editing options…</div> : !episode ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">Episode not found.</div>
      ) : (
        <>
          <EpisodeNavigation episodeId={episode.id} />

          <section className="overflow-hidden rounded-3xl bg-[#0b0b14] px-6 py-10 text-white shadow-2xl sm:px-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Choose your editor</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">How do you want to edit?</h1>
            <p className="mt-3 max-w-2xl text-slate-300">{episode.title} stays connected to this episode whichever editor you choose.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{episode.show}</span>
              <span className={`rounded-full border px-3 py-1.5 ${audio ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>{audio ? "Audio ready" : "No audio yet"}</span>
            </div>
          </section>

          <section className="mt-7 grid gap-6 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-3xl border border-violet-200 bg-white p-7 shadow-[0_18px_50px_rgba(82,57,145,0.12)] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xl font-black text-white shadow-lg shadow-violet-200">⌁</span>
              <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-violet-600">Nothing to install</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Edit in browser</h2>
              <p className="mt-4 leading-7 text-slate-600">Open the connected web editor for transcripts, AI cleanup, music, show notes, chapters, and episode preparation.</p>
              <ul className="mt-6 space-y-2 text-sm font-semibold text-slate-700">
                <li>✓ Works anywhere you sign in</li>
                <li>✓ Changes stay attached to this episode</li>
                <li>✓ Best for fast production and collaboration</li>
              </ul>
              <Link href={`/episodes/${episode.id}/editor`} className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 font-black text-white shadow-lg shadow-violet-200">Edit in browser</Link>
            </article>

            <article className="relative overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-7 shadow-[0_18px_50px_rgba(40,140,170,0.1)] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl font-black text-white shadow-lg shadow-cyan-200">◫</span>
              <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Studio plan · Desktop power</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Open in Studio app</h2>
              <p className="mt-4 leading-7 text-slate-600">Send this episode’s audio into the full multitrack timeline for precise waveform cuts, deep zoom, fades, and detailed mixing.</p>
              <ul className="mt-6 space-y-2 text-sm font-semibold text-slate-700">
                <li>✓ Imports the latest episode audio</li>
                <li>✓ Full multitrack waveform workspace</li>
                <li>✓ Send the finished mix back to Live</li>
              </ul>
              {audio ? (
                <a href={desktopHref} onClick={() => window.setTimeout(() => setLaunchAttempted(true), 700)} className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white shadow-lg">Open in Studio app</a>
              ) : (
                <Link href={`/episodes/${episode.id}/studio`} className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white shadow-lg">Record or upload audio first</Link>
              )}
              {launchAttempted && <p className="mt-4 rounded-xl border border-cyan-200 bg-white/80 p-3 text-sm text-slate-600">If Studio did not open, make sure the desktop app is installed and try again. Your episode remains safe in Live.</p>}
            </article>
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <span><strong className="text-slate-900">One episode, two editors.</strong> You can switch editors without creating a second account.</span>
            <Link href={`/episodes/${episode.id}/assets`} className="font-bold text-violet-700">Review episode assets →</Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
