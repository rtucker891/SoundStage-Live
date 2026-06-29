import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function PublicEpisodePage({
  params,
}: Props) {
  const { id } = await params;

 const { data: episode } = await supabase
  .from("episodes")
  .select(
    "id, title, guest, status, cover_art_url, shows(title)"
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

  const { data: assets = [] } = await supabase
    .from("assets")
    .select("*")
    .eq("episode_id", id);

  const recording = assets.find(
    (asset) => asset.type === "recording"
  );

  const { data: note } = await supabase
    .from("show_notes")
    .select("*")
    .eq("episode_id", id)
    .maybeSingle();

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
          {episode.cover_art_url && (
  <div className="mt-8">
    <img
      src={episode.cover_art_url}
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

          {recording ? (
            <audio
              controls
              src={recording.url}
              className="mt-6 w-full"
            />
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