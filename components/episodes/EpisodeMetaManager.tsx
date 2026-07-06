"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  getTags,
  createTag,
  getEpisodeTags,
  setEpisodeTags,
  getGuests,
  getEpisodeGuests,
  setEpisodeGuests,
  type Tag,
  type Guest,
} from "@/lib/api";

/**
 * Lets a creator attach TAGS (#33) and GUESTS (#19) to a single episode.
 * Self-contained: loads its own data and saves changes immediately, so it can
 * be dropped anywhere in the editor without touching the editor's state.
 */
export default function EpisodeMetaManager({
  episodeId,
}: {
  episodeId: string;
}) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState("");

  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(
    new Set()
  );

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [tags, epTags, guests, epGuests] = await Promise.all([
          getTags(),
          getEpisodeTags(episodeId),
          getGuests(),
          getEpisodeGuests(episodeId),
        ]);
        setAllTags(tags);
        setSelectedTagIds(new Set(epTags.map((t) => t.id)));
        setAllGuests(guests);
        setSelectedGuestIds(new Set(epGuests.map((g) => g.id)));
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [episodeId]);

  async function toggleTag(tagId: string) {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setSelectedTagIds(next);
    try {
      await setEpisodeTags(episodeId, Array.from(next));
      setMessage("Tags saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    const label = newTag.trim();
    if (!label) return;
    try {
      const tag = await createTag(label);
      setNewTag("");
      // Add to the master list if new.
      setAllTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
      );
      const next = new Set(selectedTagIds);
      next.add(tag.id);
      setSelectedTagIds(next);
      await setEpisodeTags(episodeId, Array.from(next));
      setMessage(`Added tag “${tag.name}”.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function toggleGuest(guestId: string) {
    const next = new Set(selectedGuestIds);
    if (next.has(guestId)) next.delete(guestId);
    else next.add(guestId);
    setSelectedGuestIds(next);
    try {
      await setEpisodeGuests(episodeId, Array.from(next));
      setMessage("Guests saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow">
        <p className="text-slate-500">Loading tags & guests…</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Tags & Guests</h2>
        {message && <span className="text-sm text-slate-500">{message}</span>}
      </div>

      {/* Tags */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tags
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Labels that help listeners find this episode when browsing.
        </p>
        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {allTags.map((t) => {
              const on = selectedTagIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                    on
                      ? "bg-purple-600 text-white"
                      : "border border-slate-300 text-slate-600 hover:border-purple-400"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
        <form onSubmit={handleAddTag} className="mt-3 flex gap-2">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a new tag…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
        </form>
      </div>

      {/* Guests */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Guests
          </h3>
          <Link
            href="/guests"
            className="text-sm font-semibold text-purple-600"
          >
            Manage guests →
          </Link>
        </div>
        {allGuests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No guest profiles yet.{" "}
            <Link href="/guests" className="font-semibold text-purple-600">
              Create one
            </Link>{" "}
            to attach it here.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {allGuests.map((g) => {
              const on = selectedGuestIds.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGuest(g.id)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition ${
                    on
                      ? "bg-purple-600 text-white"
                      : "border border-slate-300 text-slate-600 hover:border-purple-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.photoUrl || "/default-cover.png"}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                  {on ? "✓ " : ""}
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
