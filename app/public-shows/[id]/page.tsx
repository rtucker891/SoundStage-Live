import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ShareButton from "@/components/public/ShareButton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

// Turn a seconds count into a friendly "H:MM:SS" / "M:SS" string.
function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Build the per-show <title>/<meta> tags so links shared to social platforms
// show the show's real name, description, and artwork instead of a generic
// site card.
export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const { data: show } = await supabase
    .from("shows")
    .select("title, description, cover_art_url, published_cover_art_url")
    .eq("id", id)
    .single();

  if (!show) {
    return { title: "Show Not Found" };
  }

  const image = show.published_cover_art_url || show.cover_art_url || undefined;
  const description = show.description || "A podcast on SoundStage Live.";

  return {
    title: show.title,
    description,
    openGraph: {
      title: show.title,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: show.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicShowPage({ params }: Props) {
  const { id } = await params;

  const { data: show } = await supabase
    .from("shows")
    .select("*")
    .eq("id", id)
    .single();

  if (!show) {
    return (
      <main className="mx-auto max-w-4xl p-10">
        <h1 className="text-3xl font-bold">Show Not Found</h1>
        <Link
          href="/browse"
          className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Browse shows
        </Link>
      </main>
    );
  }

  const { data: episodesData } = await supabase
    .from("episodes")
    .select(
      "id, title, guest, cover_art_url, published_artwork_url, published_audio_duration, published_at, created_at"
    )
    .eq("show_id", id)
    .eq("status", "Published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: false });

  const episodes = episodesData ?? [];
  const artwork = show.published_cover_art_url || show.cover_art_url || "";

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl p-8">
        <Link
          href="/browse"
          className="mb-6 inline-block text-sm font-semibold text-purple-600"
        >
          ← Browse all shows
        </Link>

        <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-10 text-white shadow-xl">
          <div className="grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
            {artwork ? (
              <img
                src={artwork}
                alt={show.title}
                className="h-56 w-56 rounded-2xl border border-white/20 object-cover shadow-2xl"
              />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-center text-sm font-semibold text-white/70">
                No Show Artwork
              </div>
            )}

            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">
                {show.itunes_category
                  ? `${show.itunes_category} Podcast`
                  : "SoundStage Live Show"}
              </p>

              <h1 className="mt-3 text-5xl font-bold">{show.title}</h1>

              {show.author && (
                <p className="mt-3 text-white/80">by {show.author}</p>
              )}

              <p className="mt-4 text-lg text-white/80">
                {show.description || "Podcast show page"}
              </p>

              <p className="mt-4 text-sm font-semibold text-white/70">
                {episodes.length}{" "}
                {episodes.length === 1 ? "episode" : "episodes"}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`/rss/${show.id}`}
                  target="_blank"
                  className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900"
                >
                  Subscribe (RSS)
                </a>

                <ShareButton
                  url={`/public-shows/${show.id}`}
                  title={show.title}
                  label="Share Show"
                  className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold">Episodes</h2>

          {episodes.length === 0 ? (
            <p className="mt-4 text-slate-500">No published episodes yet.</p>
          ) : (
            <div className="mt-6 grid gap-4">
              {episodes.map((episode) => {
                const epArt =
                  episode.published_artwork_url ||
                  episode.cover_art_url ||
                  artwork ||
                  "";
                const duration = formatDuration(
                  episode.published_audio_duration
                );
                const date = formatDate(
                  episode.published_at || episode.created_at
                );

                return (
                  <Link
                    key={episode.id}
                    href={`/listen/${episode.id}`}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-purple-300 hover:shadow"
                  >
                    {epArt ? (
                      <img
                        src={epArt}
                        alt={episode.title}
                        className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-xl text-white">
                        🎙
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-slate-900">
                        {episode.title}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {episode.guest
                          ? `Guest: ${episode.guest}`
                          : "No guest listed"}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                        {date && <span>{date}</span>}
                        {duration && <span>· {duration}</span>}
                      </div>
                    </div>

                    <span className="flex-shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      Listen
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

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
