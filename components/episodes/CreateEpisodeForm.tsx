"use client";

import { useEffect, useState } from "react";
import { createEpisode, getShows } from "@/lib/api";
import type { Show } from "@/types/show";

export default function CreateEpisodeForm() {
  const [shows, setShows] = useState<Show[]>([]);
  const [title, setTitle] = useState("");
  const [guest, setGuest] = useState("");
  const [show, setShow] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getShows().then((data) => {
      setShows(data);
      setShow(data[0]?.title || "");
    });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Saving episode...");

        try {
      await createEpisode({ title, guest, show });
      setTitle("");
      setGuest("");
      setMessage("Episode saved.");
      window.location.reload();
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Episode could not be saved.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Episode title"
        className="w-full rounded-lg border border-slate-200 p-3"
        required
      />

      <input
        value={guest}
        onChange={(event) => setGuest(event.target.value)}
        placeholder="Guest name"
        className="w-full rounded-lg border border-slate-200 p-3"
      />

      <select
        value={show}
        onChange={(event) => setShow(event.target.value)}
        className="w-full rounded-lg border border-slate-200 p-3"
        required
      >
        {shows.map((item) => (
          <option key={item.id} value={item.title}>
            {item.title}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="w-full rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white"
      >
        Create Episode
      </button>

      {message && (
        <p className="text-sm font-semibold text-slate-600">
          {message}
        </p>
      )}
    </form>
  );
}