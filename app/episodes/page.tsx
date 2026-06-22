"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import CreateEpisodeForm from "@/components/episodes/CreateEpisodeForm";

import { getEpisodes } from "@/lib/api";

import type { Episode } from "@/types/episode";

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEpisodes()
      .then((data) => setEpisodes(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Episodes</h1>

          <p className="mt-2 text-slate-600">
            Plan, record, edit, and publish your episodes.
          </p>
        </div>

        <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
          New Episode
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <CreateEpisodeForm />

        <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
          {loading ? (
            <p className="text-slate-500">Loading episodes...</p>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-4">Episode</th>
                  <th className="pb-4">Show</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4">Guest</th>
                </tr>
              </thead>

              <tbody>
                {episodes.map((episode) => (
                  <tr
                    key={episode.id}
                    className="border-b border-slate-100"
                  >
                    <td className="py-4 font-semibold">
                      <Link
                        href={`/episodes/${episode.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {episode.title}
                      </Link>
                    </td>

                    <td className="py-4">{episode.show}</td>

                    <td className="py-4">
                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {episode.status}
                      </span>
                    </td>

                    <td className="py-4">{episode.guest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}