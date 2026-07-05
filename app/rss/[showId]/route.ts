import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    showId: string;
  }>;
};

/**
 * Escape a string for safe inclusion in XML text/attribute content.
 * Without this, an ampersand or angle bracket in a title/description
 * produces an invalid feed that Apple/Spotify will reject.
 */
function xml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format a duration given in seconds as HH:MM:SS (or MM:SS), per the
 * iTunes <itunes:duration> spec. Returns null when unknown (0/missing),
 * so we can omit the tag rather than emit a misleading 00:00.
 */
function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Best-effort MIME type for a podcast enclosure based on the file URL.
 * Podcast platforms require MP3 or M4A/AAC; .webm (the current recorder
 * output) is not supported by Apple Podcasts and is flagged for the
 * upcoming audio-pipeline work.
 */
function audioMimeFromUrl(url: string, fallback?: string | null): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".mp3")) return "audio/mpeg";
  if (clean.endsWith(".m4a") || clean.endsWith(".aac")) return "audio/x-m4a";
  if (clean.endsWith(".ogg") || clean.endsWith(".oga")) return "audio/ogg";
  if (clean.endsWith(".wav")) return "audio/wav";
  if (clean.endsWith(".webm")) return "audio/webm";
  return fallback || "audio/mpeg";
}

export async function GET(request: Request, { params }: Props) {
  const { showId } = await params;

  const { data: show } = await supabase
    .from("shows")
    .select("id, title, description, cover_art_url")
    .eq("id", showId)
    .single();

  if (!show) {
    return new Response("Show not found", { status: 404 });
  }

  const { data: episodesData } = await supabase
    .from("episodes")
    .select(
      "id, title, guest, created_at, cover_art_url, published_audio_url, published_audio_size, published_audio_mime, published_audio_duration, published_artwork_url"
    )
    .eq("show_id", showId)
    .eq("status", "Published")
    .order("created_at", { ascending: false });

  const episodes = episodesData ?? [];

  // Fetch audio (recordings) for all published episodes in one query so we
  // can attach <enclosure> tags. recordings.audio_url is the file location
  // and recordings.duration is the length in seconds.
  const episodeIds = episodes.map((e) => e.id);
  const recordingsByEpisode = new Map<
    string,
    { audio_url: string; duration: number | null }
  >();

  if (episodeIds.length > 0) {
    const { data: recordings } = await supabase
      .from("recordings")
      .select("episode_id, audio_url, duration, created_at")
      .in("episode_id", episodeIds)
      .order("created_at", { ascending: false });

    // Keep the most recent recording per episode (query is desc by created_at,
    // so the first one seen per episode wins).
    for (const rec of recordings ?? []) {
      if (rec.episode_id && !recordingsByEpisode.has(rec.episode_id)) {
        recordingsByEpisode.set(rec.episode_id, {
          audio_url: rec.audio_url,
          duration: rec.duration,
        });
      }
    }
  }

  // Byte length for <enclosure length="...">. The assets table stores
  // file_size + mime_type for uploaded files of type "recording".
  const assetByEpisode = new Map<
    string,
    { file_size: number | null; mime_type: string | null }
  >();

  if (episodeIds.length > 0) {
    const { data: assets } = await supabase
      .from("assets")
      .select("episode_id, file_size, mime_type, created_at")
      .in("episode_id", episodeIds)
      .eq("type", "recording")
      .order("created_at", { ascending: false });

    for (const a of assets ?? []) {
      if (a.episode_id && !assetByEpisode.has(a.episode_id)) {
        assetByEpisode.set(a.episode_id, {
          file_size: a.file_size,
          mime_type: a.mime_type,
        });
      }
    }
  }

  const baseUrl = new URL(request.url).origin;
  const feedUrl = `${baseUrl}/rss/${show.id}`;
  const showLink = `${baseUrl}/public-shows/${show.id}`;

  // ---- Channel-level metadata ----
  // NOTE: The following iTunes fields do not yet have dedicated columns in
  // the schema. Sensible defaults are used and should be replaced by real
  // per-show columns in a future migration (e.g. shows.author,
  // shows.owner_email, shows.category, shows.explicit, shows.language).
  const showTitle = show.title || "Untitled Show";
  const showDescription = show.description || "A SoundStage Live podcast.";
  const showImage = show.cover_art_url || `${baseUrl}/default-cover.png`;
  const author = "SoundStage Live"; // TODO: shows.author
  const ownerEmail = "podcast@soundstage.live"; // TODO: shows.owner_email
  const category = "Society & Culture"; // TODO: shows.category (iTunes category)
  const explicit = "false"; // TODO: shows.explicit
  const language = "en-us"; // TODO: shows.language

  const lastBuildDate = (
    episodes[0]?.created_at
      ? new Date(episodes[0].created_at)
      : new Date()
  ).toUTCString();

  const items = episodes
    .map((episode) => {
      const recording = recordingsByEpisode.get(episode.id);
      const asset = assetByEpisode.get(episode.id);
      const episodeLink = `${baseUrl}/listen/${episode.id}`;
      const pubDate = new Date(episode.created_at).toUTCString();
      const guest = episode.guest ? `Guest: ${episode.guest}` : "";
      const description = guest || showDescription;
      // Prefer the permanent published artwork; fall back to episode/show art.
      const episodeImage =
        episode.published_artwork_url ||
        episode.cover_art_url ||
        showImage;

      // Prefer the PERMANENT published audio URL (public bucket, never expires).
      // Fall back to the recording's (possibly expiring) URL only if the
      // episode has not been through the publish pipeline yet.
      const audioUrl =
        episode.published_audio_url || recording?.audio_url || null;
      const duration = formatDuration(
        episode.published_audio_duration || recording?.duration
      );

      // <enclosure> — only emit when we actually have an audio URL, since a
      // broken/empty enclosure invalidates the item for podcast apps.
      let enclosure = "";
      if (audioUrl) {
        const length =
          episode.published_audio_size ?? asset?.file_size ?? 0;
        const type =
          episode.published_audio_mime ||
          audioMimeFromUrl(audioUrl, asset?.mime_type);
        enclosure = `<enclosure url="${xml(
          audioUrl
        )}" length="${length}" type="${xml(type)}" />`;
      }

      return `
    <item>
      <title>${xml(episode.title)}</title>
      <description>${xml(description)}</description>
      <link>${xml(episodeLink)}</link>
      <guid isPermaLink="false">${xml(episode.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      ${enclosure}
      <itunes:title>${xml(episode.title)}</itunes:title>
      <itunes:summary>${xml(description)}</itunes:summary>
      <itunes:author>${xml(author)}</itunes:author>
      <itunes:image href="${xml(episodeImage)}" />
      <itunes:explicit>${explicit}</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
      ${duration ? `<itunes:duration>${duration}</itunes:duration>` : ""}
    </item>`;
    })
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xml(showTitle)}</title>
    <description>${xml(showDescription)}</description>
    <link>${xml(showLink)}</link>
    <language>${xml(language)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${xml(
      feedUrl
    )}" rel="self" type="application/rss+xml" />
    <image>
      <url>${xml(showImage)}</url>
      <title>${xml(showTitle)}</title>
      <link>${xml(showLink)}</link>
    </image>
    <itunes:author>${xml(author)}</itunes:author>
    <itunes:summary>${xml(showDescription)}</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${xml(author)}</itunes:name>
      <itunes:email>${xml(ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${xml(showImage)}" />
    <itunes:category text="${xml(category)}" />
    <itunes:explicit>${explicit}</itunes:explicit>
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Cache at the edge for 5 min; podcast clients poll infrequently.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
