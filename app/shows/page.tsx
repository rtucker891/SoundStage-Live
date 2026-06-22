"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import CreateShowForm from "@/components/shows/CreateShowForm";

import { getShows } from "@/lib/api";

import type { Show } from "@/types/show";

export default function ShowsPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShows()
      .then((data) => setShows(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shows</h1>

          <p className="mt-2 text-slate-600">
            Manage your podcast shows and broadcast channels.
          </p>
        </div>

        <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
          New Show
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <CreateShowForm />

        {loading ? (
          <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
            <p className="text-slate-500">Loading shows...</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:col-span-2">
            {shows.map((show) => (
              <div key={show.id} className="rounded-xl bg-white p-6 shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{show.title}</h2>

                    <p className="mt-2 text-slate-600">
                      {show.description}
                    </p>
                  </div>

                  <span className="inline-flex h-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {show.status}
                  </span>
                </div>

                <div className="mt-6 rounded-lg bg-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-500">
                    Episodes
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {show.episodes}
                  </p>
                </div>

                <Link
                  href={`/shows/${show.id}`}
                  className="mt-6 inline-block rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white"
                >
                  Open Show
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}