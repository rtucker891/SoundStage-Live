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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Manage your shows, episodes, recordings, and publishing workflow.
          </p>
        </div>

        <Link
          href="/episodes"
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          New Episode
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <StatCard title="Shows" value={shows.length} />
        <StatCard title="Episodes" value={episodes.length} />
        <StatCard title="Drafts" value={draftCount} />
        <StatCard title="Recordings" value={0} />
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow">
        <h3 className="text-2xl font-bold">Recent Episodes</h3>

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">Episode</th>
                <th className="p-4">Show</th>
                <th className="p-4">Status</th>
                <th className="p-4">Guest</th>
              </tr>
            </thead>

            <tbody>
              {episodes.map((episode) => (
                <tr key={episode.id} className="border-t border-slate-200">
                  <td className="p-4 font-semibold">{episode.title}</td>
                  <td className="p-4">{episode.show}</td>
                  <td className="p-4">
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {episode.status}
                    </span>
                  </td>
                  <td className="p-4">{episode.guest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow">
          <h3 className="text-2xl font-bold">Studio</h3>
          <p className="mt-2 text-slate-600">
            Prepare your recording room, check your microphone, and invite
            guests.
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Mic Check</span>
              <span className="text-sm text-slate-500">Not started</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Guest Room</span>
              <span className="text-sm text-slate-500">Ready</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Recording</span>
              <span className="text-sm text-slate-500">Idle</span>
            </div>
          </div>

          <Link
            href="/studio"
            className="mt-6 inline-block rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            Open Studio
          </Link>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h3 className="text-2xl font-bold">AI Tools</h3>
          <p className="mt-2 text-slate-600">
            Enhance speech, generate captions, remove silence, and clean up
            recordings.
          </p>

          <div className="mt-6 grid gap-3">
            <button className="rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Enhance Speech
            </button>
            <button className="rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Caption Video
            </button>
            <button className="rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Remove Music
            </button>
            <button className="rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Text-Based Editing
            </button>
          </div>
        </div>
      </div>
    </>
  );
}