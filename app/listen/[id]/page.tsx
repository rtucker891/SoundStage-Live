import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ShareButton from "@/components/public/ShareButton";
import PageViewTracker from "@/components/public/PageViewTracker";
import AudioPlayer from "@/components/public/AudioPlayer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type Segment = {
  id?: string;
  text?: string;
  speaker?: string;
  startTime?: number;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Convert a seconds offset into a "M:SS" / "H:MM:SS" timestamp label.
function formatTimestamp(seconds?: number) {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Per-episode social/SEO tags. Only Published episodes get real metadata;
// anything else falls back to a generic "not found" title.
export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const { data: episode } = await supabase
    .from("episodes")
    .select(
      "title, guest, status, cover_art_url, published_artwork_url, shows(title, cover_art_url)"
    )
    .eq("id", id)
    .single();

  if (!episode || episode.status !== "Published") {
    return { title: "Episode Not Found" };
  }

  const showTitle = (episode.shows as any)?.title || "SoundStage Live";
  const image =
    episode.published_artwork_url ||
    episode.cover_art_url ||
    (episode.shows as any)?.cover_art_url ||
    undefined;
  const description = episode.guest
    ? `${episode.title} — featuring ${episode.guest}, on ${showTitle}.`
    : `${episode.title}, on ${showTitle}.`;

  return {
    title: episode.title,
    description,
    openGraph: {
      title: episode.title,
      description,
      type: "article",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: episode.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicEpisodePage({ params }: Props) {
  const { id } = await params;

  const { data: episode } = await supabase
    .from("episodes")
    .select(
      "id, title, guest, status, show_id, cover_art_url, published_audio_url, published_audio_mime, published_artwork_url, published_at, created_at, shows(title, cover_art_url)"
    )
    .eq("id", id)
    .single();

  // Only Published episodes are public. If an episode was never published (or
  // was unpublished), we treat it as "not found" so the public page never
  // serves a draft or an expired recording URL.
  if (!episode || episode.status !== "Published") {
    return (
      <main className="mx-auto max-w-4xl p-10">
        <h1 className="text-3xl font-bold">Episode Not Found</h1>
        <Link
          href="/browse"
          className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Browse shows
        </Link>
      </main>
    );
  }

  const { data: assetsData } = await supabase
    .from("assets")
    .select("*")
    .eq("episode_id", id);

  const assets = assetsData ?? [];

  const recording = assets.find((asset) => asset.type === "recording");
  const artworkAsset = assets.find((asset) => asset.type === "artwork");

  const coverArtUrl =
    episode.published_artwork_url ||
    episode.cover_art_url ||
    artworkAsset?.url ||
    (episode.shows as any)?.cover_art_url ||
    "";

  // Prefer the PERMANENT published MP3 (public bucket, never expires). Only
  // fall back to the asset's signed URL if the episode was never published —
  // those signed URLs expire after an hour.
  const audioSrc = episode.published_audio_url || recording?.url || "";
  const audioType = episode.published_audio_mime || undefined;
  const showTitle = (episode.shows as any)?.title || "Untitled Show";
  const publishedDate = formatDate(episode.published_at || episode.created_at);

  // Most recent show notes row (the AI generator may have run more than once).
  const { data: notes } = await supabase
    .from("show_notes")
    .select("*")
    .eq("episode_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const note = notes?.[0] ?? null;

  // Most recent transcript for this episode, if any.
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("segments")
    .eq("episode_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const segments: Segment[] = (transcripts?.[0]?.segments as Segment[]) ?? [];

  // Tags (#33) attached to this episode.
  const { data: tagRows } = await supabase
    .from("episode_tags")
    .select("tags(id, name, slug)")
    .eq("episode_id", id);
  const episodeTags = ((tagRows ?? []) as unknown as {
    tags: { id: string; name: string; slug: string } | null;
  }[])
    .map((r) => r.tags)
    .filter((t): t is { id: string; name: string; slug: string } => Boolean(t));

  // Guest profiles (#19) linked to this episode.
  const { data: guestRows } = await supabase
    .from("episode_guests")
    .select("guests(id, name, photo_url, deleted_at)")
    .eq("episode_id", id);
  const linkedGuests = ((guestRows ?? []) as unknown as {
    guests: {
      id: string;
      name: string;
      photo_url: string | null;
      deleted_at: string | null;
    } | null;
  }[])
    .map((r) => r.guests)
    .filter(
      (g): g is { id: string; name: string; photo_url: string | null; deleted_at: string | null } =>
        Boolean(g) && !g!.deleted_at
    );

  return (
    <main className="min-h-screen bg-slate-100">
      <PageViewTracker type="episode.viewed" entityId={episode.id} />
      <div className="mx-auto max-w-5xl p-8">
        <Link
          href={`/public-shows/${episode.show_id}`}
          className="mb-6 inline-block text-sm font-semibold text-purple-600"
        >
          ← Back to {showTitle}
        </Link>

        <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-10 text-white shadow-xl">
          <p className="text-sm uppercase tracking-wide text-white/70">
            {showTitle}
          </p>

          <h1 className="mt-3 text-5xl font-bold">{episode.title}</h1>

          {linkedGuests.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {linkedGuests.map((g) => (
                <a
                  key={g.id}
                  href={`/guest/${g.id}`}
                  className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.photo_url || "/default-cover.png"}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  {g.name}
                </a>
              ))}
            </div>
          ) : (
            episode.guest && (
              <p className="mt-4 text-lg text-white/80">
                Guest: {episode.guest}
              </p>
            )
          )}

          {episodeTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {episodeTags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
                >
                  #{t.name}
                </span>
              ))}
            </div>
          )}

          {publishedDate && (
            <p className="mt-2 text-sm text-white/60">
              Published {publishedDate}
            </p>
          )}

          <div className="mt-6">
            <ShareButton
              url={`/listen/${episode.id}`}
              title={episode.title}
              label="Share Episode"
              className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            />
          </div>

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
          <h2 className="text-2xl font-bold">Listen Now</h2>

          {audioSrc ? (
            <AudioPlayer
              src={audioSrc}
              type={audioType}
              episodeId={episode.id}
            />
          ) : (
            <p className="mt-4 text-slate-500">No recording available.</p>
          )}
        </div>

        {note && (
          <div className="mt-8 rounded-2xl bg-white p-8 shadow">
            <h2 className="text-2xl font-bold">Show Notes</h2>

            {note.summary && (
              <p className="mt-4 text-slate-700">{note.summary}</p>
            )}

            {(note.bullet_points || []).length > 0 && (
              <ul className="mt-6 list-disc space-y-1 pl-6 text-slate-700">
                {(note.bullet_points || []).map(
                  (point: string, index: number) => (
                    <li key={index}>{point}</li>
                  )
                )}
              </ul>
            )}
          </div>
        )}

        {segments.length > 0 && (
          <details className="mt-8 rounded-2xl bg-white p-8 shadow">
            <summary className="cursor-pointer text-2xl font-bold">
              Transcript
            </summary>

            <div className="mt-6 space-y-4">
              {segments.map((segment, index) => {
                const stamp = formatTimestamp(segment.startTime);
                return (
                  <div key={segment.id || index} className="text-slate-700">
                    <div className="flex items-baseline gap-2">
                      {segment.speaker && (
                        <span className="text-sm font-semibold text-purple-600">
                          {segment.speaker}
                        </span>
                      )}
                      {stamp && (
                        <span className="text-xs text-slate-400">{stamp}</span>
                      )}
                    </div>
                    <p className="mt-1">{segment.text}</p>
                  </div>
                );
              })}
            </div>
          </details>
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
