import { NextResponse } from "next/server";
import { admin, callerId } from "@/lib/teamServer";
import { fetchAndParseFeed, type ParsedEpisode } from "@/lib/rssImport";

export const dynamic = "force-dynamic";
// Copying audio for many episodes can take a while; allow a generous budget.
export const maxDuration = 300;

const PUBLIC_BUCKET = "soundstage-public";
// Safety caps so a giant feed can't run away with time/storage.
const MAX_EPISODES = 100;
// Skip copying any single file larger than this (500 MB) — link to it instead.
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;

/** Best-effort file extension from an audio URL or MIME type. */
function audioExt(url: string, mime: string | null): string {
  const clean = url.split("?")[0].toLowerCase();
  const dot = clean.lastIndexOf(".");
  if (dot !== -1 && clean.length - dot <= 5) return clean.slice(dot);
  if (mime?.includes("mpeg")) return ".mp3";
  if (mime?.includes("m4a") || mime?.includes("aac") || mime?.includes("mp4")) return ".m4a";
  if (mime?.includes("wav")) return ".wav";
  if (mime?.includes("ogg")) return ".ogg";
  return ".mp3";
}

/**
 * Download an episode's audio from its original host and re-upload it into our
 * PUBLIC storage bucket so we own a permanent copy (never expires). Returns the
 * public URL + size + mime, or null if the copy couldn't be made (we then fall
 * back to linking the original URL so the episode still plays).
 */
async function copyAudioToPublic(
  db: ReturnType<typeof admin>,
  showId: string,
  episodeId: string,
  ep: ParsedEpisode
): Promise<{ url: string; size: number; mime: string } | null> {
  if (!db || !ep.audioUrl) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const res = await fetch(ep.audioUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "SoundStageLive/1.0 (+podcast import)" },
      redirect: "follow",
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) return null;

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared && declared > MAX_AUDIO_BYTES) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_AUDIO_BYTES) return null;

    const mime =
      ep.audioMime || res.headers.get("content-type") || "audio/mpeg";
    const ext = audioExt(ep.audioUrl, mime);
    const path = `imported/${showId}/${episodeId}${ext}`;

    const { error: upErr } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: true });
    if (upErr) return null;

    const { data } = db.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, size: buffer.byteLength, mime };
  } catch {
    return null;
  }
}

/**
 * POST /api/import  { feedUrl, copyAudio }
 *
 * Creates a NEW show from an external RSS feed and backfills its episodes.
 *  - The caller becomes the show's owner (the DB trigger creates the
 *    show_memberships row automatically).
 *  - Episodes are created immediately with metadata + a link to their original
 *    audio, so the import returns fast.
 *  - When copyAudio is true, we then download each episode's audio into our
 *    public bucket so the user owns a permanent copy. This is best-effort:
 *    any file that fails simply keeps its original link.
 */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const uid = await callerId(db, request);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const feedUrl: string | undefined = body?.feedUrl;
  const copyAudio: boolean = body?.copyAudio !== false; // default: copy
  if (!feedUrl || typeof feedUrl !== "string") {
    return NextResponse.json({ error: "feedUrl required." }, { status: 400 });
  }

  let feed;
  try {
    feed = await fetchAndParseFeed(feedUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that feed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 1) Create the show. The AFTER INSERT trigger grants the caller ownership.
  const { data: show, error: showErr } = await db
    .from("shows")
    .insert({
      user_id: uid,
      title: feed.title,
      description: feed.description,
      status: "Active",
      author: feed.author,
      owner_name: feed.ownerName,
      owner_email: feed.ownerEmail,
      language: feed.language || "en-us",
      explicit: feed.explicit,
      itunes_category: feed.itunesCategory,
      itunes_subcategory: feed.itunesSubcategory,
      cover_art_url: feed.imageUrl,
      published_cover_art_url: feed.imageUrl, // feed images are already public URLs
    })
    .select("id")
    .single();

  if (showErr || !show) {
    return NextResponse.json(
      { error: showErr?.message || "Failed to create the show." },
      { status: 500 }
    );
  }
  const showId = show.id as string;

  // 2) Create episodes (newest first in the feed → keep feed order).
  const toImport = feed.episodes.slice(0, MAX_EPISODES);
  let created = 0;
  let audioCopied = 0;
  let audioLinked = 0;

  for (const ep of toImport) {
    const { data: episode, error: epErr } = await db
      .from("episodes")
      .insert({
        user_id: uid,
        show_id: showId,
        title: ep.title,
        status: "Published", // imported episodes are already live elsewhere
        created_at: ep.pubDate ? new Date(ep.pubDate).toISOString() : undefined,
        cover_art_url: ep.imageUrl,
        published_artwork_url: ep.imageUrl,
        published_audio_duration: ep.durationSeconds,
        published_at: ep.pubDate ? new Date(ep.pubDate).toISOString() : new Date().toISOString(),
      })
      .select("id")
      .single();
    if (epErr || !episode) continue;
    created++;
    const episodeId = episode.id as string;

    // Attach audio. Copy into our bucket when asked; otherwise link original.
    let finalUrl = ep.audioUrl;
    let finalMime = ep.audioMime;
    let finalSize = ep.audioSize;

    if (ep.audioUrl && copyAudio) {
      const copied = await copyAudioToPublic(db, showId, episodeId, ep);
      if (copied) {
        finalUrl = copied.url;
        finalMime = copied.mime;
        finalSize = copied.size;
        audioCopied++;
      } else {
        audioLinked++; // copy failed/too big → keep original link
      }
    } else if (ep.audioUrl) {
      audioLinked++;
    }

    if (finalUrl) {
      // Save the audio on the episode (used by the RSS generator + player).
      await db
        .from("episodes")
        .update({
          published_audio_url: finalUrl,
          published_audio_mime: finalMime,
          published_audio_size: finalSize,
        })
        .eq("id", episodeId);

      // Also record a recording row so the studio/player finds the audio.
      await db.from("recordings").insert({
        user_id: uid,
        episode_id: episodeId,
        name: ep.title,
        audio_url: finalUrl,
        duration: ep.durationSeconds,
      });
    }

    // Store the episode description as a show note so it surfaces in the app.
    if (ep.description) {
      await db.from("show_notes").insert({
        user_id: uid,
        episode_id: episodeId,
        title: ep.title,
        summary: ep.description,
        bullet_points: [],
      });
    }
  }

  return NextResponse.json({
    showId,
    showTitle: feed.title,
    totalInFeed: feed.episodes.length,
    imported: created,
    cappedAt: feed.episodes.length > MAX_EPISODES ? MAX_EPISODES : null,
    audioCopied,
    audioLinked,
  });
}
