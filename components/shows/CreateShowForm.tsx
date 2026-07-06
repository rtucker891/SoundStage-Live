"use client";

import { useState } from "react";

import { createShow } from "@/lib/api";
import type { Show } from "@/types/show";

export default function CreateShowForm({
  onCreated,
}: {
  onCreated?: (show: Show) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);

    try {
      const newShow = await createShow({
        title,
        description,
      });

      setTitle("");
      setDescription("");

      // Add the new show to the parent list instantly (no full page reload).
      onCreated?.(newShow);
    } catch (err) {
      alert(
        `Could not create show: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="text-2xl font-bold">Create New Show</h2>

      <p className="mt-2 text-slate-600">
        Add a new podcast show or broadcast channel.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded-lg border border-slate-200 px-4 py-3"
          placeholder="Show title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <textarea
          className="h-32 w-full rounded-lg border border-slate-200 px-4 py-3"
          placeholder="Show description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Show"}
        </button>
      </form>
    </div>
  );
}