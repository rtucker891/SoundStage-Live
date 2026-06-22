"use client";

import { useEffect, useState } from "react";

import { createEpisode, getShows } from "@/lib/api";

import type { Show } from "@/types/show";

export default function CreateEpisodeForm() {
  const [title, setTitle] = useState("");
  const [guest, setGuest] = useState("");
  const [show, setShow] = useState("");

  const [shows, setShows] = useState<Show[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getShows().then((data) => {
      setShows(data);

      if (data.length > 0) {
        setShow(data[0].title);
      }
    });
  }, []);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);

    await createEpisode({
      title,
      guest,
      show,
    });

    setTitle("");
    setGuest("");

    if (shows.length > 0) {
      setShow(shows[0].title);
    }

    setSaving(false);

    window.location.reload();
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="text-2xl font-bold">Create New Episode</h2>

      <p className="mt-2 text-slate-600">
        Plan and manage your next recording.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded-lg border border-slate-200 px-4 py-3"
          placeholder="Episode title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <select
          className="w-full rounded-lg border border-slate-200 px-4 py-3"
          value={show}
          onChange={(event) => setShow(event.target.value)}
          required
        >
          {shows.map((showItem) => (
            <option key={showItem.id} value={showItem.title}>
              {showItem.title}
            </option>
          ))}
        </select>

        <input
          className="w-full rounded-lg border border-slate-200 px-4 py-3"
          placeholder="Guest name"
          value={guest}
          onChange={(event) => setGuest(event.target.value)}
          required
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Episode"}
        </button>
      </form>
    </div>
  );
}