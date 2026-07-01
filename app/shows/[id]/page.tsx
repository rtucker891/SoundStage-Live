"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import {
  getEpisodes,
  getShows,
  updateShowCoverArt,
  uploadFileToStorage,
} from "@/lib/api";

import type { Episode } from "@/types/episode";
import type { Show } from "@/types/show";

export default function ShowDetailsPage() {
  const params = useParams();

  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
const [coverArtUrl, setCoverArtUrl] = useState("");
  useEffect(() => {
    Promise.all([getShows(), getEpisodes()])
      .then(([showsData, episodesData]) => {
        const selectedShow = showsData.find(
          (item) => item.id === params.id
        );

        setShow(selectedShow || null);
        setCoverArtUrl((selectedShow as any)?.cover_art_url || "");

        if (selectedShow) {
          setEpisodes(
            episodesData.filter(
              (episode) => episode.show === selectedShow.title
            )
          );
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);
async function uploadShowCoverArt(
  event: React.ChangeEvent<HTMLInputElement>
) {
  if (!show) return;

  const file = event.target.files?.[0];

  if (!file) return;

  const uploaded = await uploadFileToStorage(
    file,
    `shows/${show.id}/artwork`
  );

  await updateShowCoverArt(show.id, uploaded.url);

  setCoverArtUrl(uploaded.url);
}
  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading show...</p>
      ) : !show ? (
        <p className="text-red-500">Show not found.</p>
      ) : (
        <>
         <div className="flex items-center justify-between gap-6">
  <div>
    <h1 className="text-3xl font-bold">{show.title}</h1>

    <p className="mt-2 text-slate-600">
      {show.description}
    </p>
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow">
  <h2 className="text-lg font-bold">Show Cover Art</h2>

  {coverArtUrl ? (
    <img
      src={coverArtUrl}
      alt={show.title}
      className="mt-4 h-48 w-48 rounded-xl object-cover shadow"
    />
  ) : (
    <p className="mt-3 text-sm text-slate-500">
      No show cover art uploaded yet.
    </p>
  )}

  <input
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={uploadShowCoverArt}
    className="mt-4 block w-full rounded-lg border border-slate-200 bg-white p-3"
  />
</div>
  </div>

  <a
    href={`/public-shows/${show.id}`}
    target="_blank"
    className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
  >
    View Public Show Page
  </a>
</div>

          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">
              Episodes
            </h2>

            <p className="mt-2 text-slate-600">
              {episodes.length} episode(s)
            </p>

            <div className="mt-6 space-y-4">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {episode.title}
                    </h3>

                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {episode.status}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Guest: {episode.guest}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}