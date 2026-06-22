"use client";

import { useState } from "react";

import { updateEpisode } from "@/lib/api";

import type {
  Episode,
  EpisodeStatus,
} from "@/types/episode";

type EditEpisodeFormProps = {
  episode: Episode;
  onUpdate: (episode: Episode) => void;
};

const statuses: EpisodeStatus[] = [
  "Planning",
  "Recording",
  "Editing",
  "Ready to Publish",
  "Published",
];

export default function EditEpisodeForm({
  episode,
  onUpdate,
}: EditEpisodeFormProps) {
  const [title, setTitle] = useState(episode.title);
  const [guest, setGuest] = useState(episode.guest);
  const [show, setShow] = useState(episode.show);
  const [status, setStatus] = useState<EpisodeStatus>(
    episode.status
  );

  const [saving, setSaving] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);

    try {
      const updatedEpisode = await updateEpisode({
        id: episode.id,
        title,
        guest,
        show,
        status,
      });

      onUpdate(updatedEpisode);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-white p-6 shadow"
    >
      <h2 className="text-xl font-bold">
        Edit Episode
      </h2>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Title
          </label>

          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            className="w-full rounded-lg border border-slate-200 p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Guest
          </label>

          <input
            value={guest}
            onChange={(event) =>
              setGuest(event.target.value)
            }
            className="w-full rounded-lg border border-slate-200 p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Show
          </label>

          <input
            value={show}
            onChange={(event) =>
              setShow(event.target.value)
            }
            className="w-full rounded-lg border border-slate-200 p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Status
          </label>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as EpisodeStatus
              )
            }
            className="w-full rounded-lg border border-slate-200 p-3"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}