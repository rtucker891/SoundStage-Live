"use client";

import { useState } from "react";

import { createShow } from "@/lib/api";

export default function CreateShowForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);

    await createShow({
      title,
      description,
    });

    setTitle("");
    setDescription("");
    setSaving(false);

    window.location.reload();
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