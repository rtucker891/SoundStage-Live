import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PublicEpisodePage({
  params,
}: Props) {
  const { id } = await params;

 const { data: episode } = await supabase
  .from("episodes")
  .select(
  "id, title, guest, status, cover_art_url, published_audio_url, published_audio_mime, published_artwork_url, shows(title, cover_art_url)"
)
  .eq("id", id)
  .single();

  if (!episode) {
    return (
      <main className="mx-auto max-w-4xl p-10">
        <h1 className="text-3xl font-bold">
          Episode Not Found
        </h1>
      </main>
    );
  }

  const { data: assetsData } = await supabase
    .from("assets")
    .select("*")
    .eq("episode_id", id);

  const assets = assetsData ?? [];

  const recording = assets.find(
  (asset) => asset.type === "recording"
);
const artworkAsset = assets.find(
  (asset) => asset.type === "artwork"
);

const coverArtUrl =
  episode.published_artwork_url ||
  episode.cover_art_url ||
  artworkAsset?.url ||
  (episode.shows as any)?.cover_art_url ||
  "";

// Prefer the PERMANENT published MP3 (public bucket, never expires). Only fall
// back to the asset's signed URL if the episode was never published — those
// signed URLs expire after an hour, so they only work right after recording.
const audioSrc = episode.published_audio_url || recording?.url || "";
const audioType = episode.published_audio_mime || undefined;

  // An episode can have multiple show_notes rows (the AI generator was re-run),
  // so take the most recent one rather than .single() which would error.
  const { data: notes } = await supabase
    .from("show_notes")
    .select("*")
    .eq("episode_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const note = notes?.[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl p-8">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-10 text-white shadow-xl">
          <p className="text-sm uppercase tracking-wide text-white/70">
            SoundStage Live
          </p>

          <h1 className="mt-3 text-5xl font-bold">
            {episode.title}
          </h1>

          <p className="mt-4 text-lg text-white/80">
            Guest: {episode.guest}
          </p>

          <p className="mt-2 text-white/70">
            Show: {(episode.shows as any)?.title || "Untitled Show"}
          </p>
         {coverArtUrl && (
  <div className="mt-8">
    <img
      src={coverArtUrl}
      alt={episode.title}
      className="mx-auto w-full max-w-md rounded-2xl border border-white/20 shadow-2xl"
    />
  </div>
)}
        </div>

        <div className="mt-8 rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold">
            Listen Now
          </h2>

          {audioSrc ? (
            <audio controls className="mt-6 w-full">
              <source src={audioSrc} type={audioType} />
              Your browser does not support the audio element.
            </audio>
          ) : (
            <p className="mt-4 text-slate-500">
              No recording available.
            </p>
          )}
        </div>

        {note && (
          <div className="mt-8 rounded-2xl bg-white p-8 shadow">
            <h2 className="text-2xl font-bold">
              Show Notes
            </h2>

            <p className="mt-4 text-slate-700">
              {note.summary}
            </p>

            <ul className="mt-6 list-disc pl-6">
              {(note.bullet_points || []).map((point: string) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            Powered by SoundStage Live
          </Link>
        </div>
      </div>
    </main>
  );
}