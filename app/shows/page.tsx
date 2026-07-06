"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import CreateShowForm from "@/components/shows/CreateShowForm";

import { deleteShow, getShows } from "@/lib/api";

import type { Show } from "@/types/show";

export default function ShowsPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  // Which show is pending delete confirmation, and the text typed so far.
  const [confirmingShowId, setConfirmingShowId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getShows()
      .then((data) => setShows(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleDeleteShow(show: Show) {
    setDeletingId(show.id);
    try {
      await deleteShow(show.id);
      setShows((prev) => prev.filter((s) => s.id !== show.id));
      setConfirmingShowId(null);
      setConfirmText("");
    } catch (err) {
      alert(
        `Could not delete show: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setDeletingId(null);
    }
  }

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

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/shows/${show.id}`}
                    className="inline-block rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white"
                  >
                    Open Show
                  </Link>

                  {confirmingShowId === show.id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingShowId(show.id);
                        setConfirmText("");
                      }}
                      className="inline-block rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {confirmingShowId === show.id && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-700">
                      Delete this show and all its episodes?
                    </p>
                    <p className="mt-1 text-sm text-red-600">
                      This removes the show from the app and your public
                      podcast feed. Type the show title to confirm:
                    </p>
                    <p className="mt-2 text-sm font-mono font-semibold text-slate-800">
                      {show.title}
                    </p>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type the show title"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        disabled={
                          confirmText.trim() !== show.title ||
                          deletingId === show.id
                        }
                        onClick={() => handleDeleteShow(show)}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === show.id
                          ? "Deleting..."
                          : "Delete show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingShowId(null);
                          setConfirmText("");
                        }}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}