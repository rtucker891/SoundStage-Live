"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import StatCard from "@/components/dashboard/StatCard";
import { getEpisodes, getShows } from "@/lib/api";

import type { Episode } from "@/types/episode";
import type { Show } from "@/types/show";

export default function DashboardContent() {
  const [shows, setShows] = useState<Show[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getShows(), getEpisodes()])
      .then(([showsData, episodesData]) => {
        setShows(showsData);
        setEpisodes(episodesData);
      })
      .finally(() => setLoading(false));
  }, []);

  const draftCount = episodes.filter(
    (episode) => episode.status === "Draft"
  ).length;

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-6 shadow">
        <p className="text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <>
    <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
        SoundStage Live
      </p>

      <h1 className="mt-2 text-4xl font-bold">
        Production Dashboard
      </h1>

      <p className="mt-3 text-white/80">
        Manage shows, episodes, AI content, recordings, and publishing.
      </p>
    </div>

    <Link
      href="/episodes"
      className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 shadow"
    >
      + New Episode
    </Link>
  </div>
</div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <StatCard title="Shows" value={shows.length} />
        <StatCard title="Episodes" value={episodes.length} />
        <StatCard title="Drafts" value={draftCount} />
        <StatCard title="Recordings" value={0} />
      </div>
<div className="mt-8 rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
        AI Activity
      </p>

      <h3 className="text-2xl font-bold">
        Recent Production Activity
      </h3>
    </div>

    <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
      Live Feed
    </span>
  </div>

  <div className="mt-6 grid gap-3 md:grid-cols-2">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      🤖 Show notes generated
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      🎨 Cover art created
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      📝 Episode description prepared
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      🚀 Publish package generated
    </div>
  </div>

</div>
<div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
        Quick Actions
      </p>

      <h3 className="text-2xl font-bold">
        Production Shortcuts
      </h3>
    </div>

    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
      Ready
    </span>
  </div>

  <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
    <Link href="/shows" className="rounded-xl bg-white p-4 text-center shadow-sm hover:shadow">
      🎙<br />New Show
    </Link>

    <Link href="/episodes" className="rounded-xl bg-white p-4 text-center shadow-sm hover:shadow">
      📺<br />New Episode
    </Link>

    <Link href="/studio" className="rounded-xl bg-white p-4 text-center shadow-sm hover:shadow">
      ⏺<br />Record
    </Link>

    <Link href="/editor" className="rounded-xl bg-white p-4 text-center shadow-sm hover:shadow">
      ✍<br />Edit
    </Link>

    <Link href="/publish" className="rounded-xl bg-white p-4 text-center shadow-sm hover:shadow">
      🚀<br />Publish
    </Link>

    <Link href="/settings" className="rounded-xl bg-white p-4 text-center shadow-sm hover:shadow">
      ⚙<br />Settings
    </Link>
  </div>
</div>
     <div className="mt-8 rounded-xl bg-white p-6 shadow">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
        Production Activity
      </p>

      <h3 className="text-2xl font-bold">
        Recent Episodes
      </h3>
    </div>

    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
      {episodes.length} Episodes
    </span>
  </div>

  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {episodes.slice(0, 6).map((episode) => (
      <div
        key={episode.id}
        className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow transition-all hover:-translate-y-1 hover:shadow-xl"
      >
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {episode.status}
          </span>

          <span className="text-xl">🎙</span>
        </div>

        <h4 className="mt-4 text-lg font-bold text-slate-900">
          {episode.title}
        </h4>

        <p className="mt-2 text-sm text-slate-500">
          Show: {episode.show}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Guest: {episode.guest}
        </p>

        <Link
          href={`/episodes/${episode.id}`}
          className="mt-5 inline-block rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Open Episode
        </Link>
      </div>
    ))}
  </div>
  <div className="mt-6 text-center">
  <Link
    href="/episodes"
    className="inline-flex items-center rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-3 font-semibold text-white shadow"
  >
    View All Episodes →
  </Link>
</div>
</div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
       <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
        Recording Environment
      </p>

      <h3 className="text-2xl font-bold">
        Studio
      </h3>
    </div>

    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
      Ready
    </span>
  </div>

  <p className="mt-3 text-slate-600">
    Prepare your recording room, test equipment, and manage guests.
  </p>

  <div className="mt-6 space-y-3">
    <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
      <span className="font-semibold">🎤 Mic Check</span>
      <span className="text-sm text-emerald-600">Ready</span>
    </div>

    <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
      <span className="font-semibold">👥 Guest Room</span>
      <span className="text-sm text-emerald-600">Ready</span>
    </div>

    <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
      <span className="font-semibold">⏺ Recording</span>
      <span className="text-sm text-slate-500">Idle</span>
    </div>
  </div>

  <Link
    href="/studio"
    className="mt-6 inline-block rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white"
  >
    Open Studio
  </Link>
</div>
<div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-white to-purple-50 p-6 shadow">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
        AI Production Suite
      </p>

      <h3 className="text-2xl font-bold">
        AI Tools
      </h3>
    </div>

    <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
      6 Tools
    </span>
  </div>

  <p className="mt-3 text-slate-600">
    Enhance recordings, generate content, and accelerate publishing.
  </p>

  <div className="mt-6 grid gap-3">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      🎤 Enhance Speech
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      🎬 Caption Video
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      🎵 Remove Music
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      ✂ Text-Based Editing
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      📝 Generate Show Notes
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      🎨 Create Cover Art
    </div>
  </div>
</div>
      </div>
    </>
  );
}