import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PRIVATE_BUCKET = "soundstage-assets";
const PUBLIC_BUCKET = "soundstage-public";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Extract the storage object path from a Supabase signed URL.
 * Signed URLs look like:
 *   https://<ref>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
 * We want just "<path>" (everything after the bucket segment, before "?").
 */
function pathFromSignedUrl(url: string, bucket: string): string | null {
  try {
    const marker = `/object/sign/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const afterBucket = url.slice(idx + marker.length);
    const path = afterBucket.split("?")[0];
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

function extFromPath(path: string): string {
  const clean = path.split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot);
}

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".mp3") return "audio/mpeg";
  if (e === ".m4a" || e === ".aac") return "audio/x-m4a";
  if (e === ".ogg" || e === ".oga") return "audio/ogg";
  if (e === ".wav") return "audio/wav";
  if (e === ".webm") return "audio/webm";
  return "application/octet-stream";
}

export async function POST(_request: Request, { params }: Props) {
  const { id: episodeId } = await params;

  // Server-only admin client (service role) so we can copy between buckets
  // and read private objects during publish. Never exposed to the browser.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );

  // 1) Load the episode.
  const { data: episode, error: epErr } = await admin
    .from("episodes")
    .select("id, title, cover_art_url, show_id")
    .eq("id", episodeId)
    .single();

  if (epErr || !episode) {
    return NextResponse.json(
      { error: "Episode not found" },
      { status: 404 }
    );
  }

  // 2) Find the most recent recording for this episode (the audio to publish).
  const { data: recording } = await admin
    .from("recordings")
    .select("audio_url, duration, created_at")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!recording?.audio_url) {
    return NextResponse.json(
      { error: "No recording found for this episode. Add audio before publishing." },
      { status: 400 }
    );
  }

  const audioPath = pathFromSignedUrl(recording.audio_url, PRIVATE_BUCKET);
  if (!audioPath) {
    return NextResponse.json(
      { error: "Could not resolve the audio file path." },
      { status: 400 }
    );
  }

  // 3) Copy the audio into the public bucket under a stable, published path.
  const audioExt = extFromPath(audioPath) || ".webm";
  const publicAudioPath = `published/${episode.show_id}/${episodeId}/audio${audioExt}`;

  // Download from private, then upload to public (copy() only works within a
  // single bucket, so we round-trip through memory).
  const { data: audioBlob, error: dlErr } = await admin.storage
    .from(PRIVATE_BUCKET)
    .download(audioPath);

  if (dlErr || !audioBlob) {
    return NextResponse.json(
      { error: `Could not read audio file: ${dlErr?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
  const audioSize = audioBuffer.length;
  const audioMime = mimeFromExt(audioExt);

  const { error: upErr } = await admin.storage
    .from(PUBLIC_BUCKET)
    .upload(publicAudioPath, audioBuffer, {
      contentType: audioMime,
      upsert: true,
    });

  if (upErr) {
    return NextResponse.json(
      { error: `Could not publish audio: ${upErr.message}` },
      { status: 500 }
    );
  }

  const { data: audioPublic } = admin.storage
    .from(PUBLIC_BUCKET)
    .getPublicUrl(publicAudioPath);

  // 4) Copy artwork into the public bucket too (best effort — don't fail
  // publish if artwork is missing or unreadable).
  let publishedArtworkUrl: string | null = null;
  if (episode.cover_art_url) {
    const artPath = pathFromSignedUrl(episode.cover_art_url, PRIVATE_BUCKET);
    if (artPath) {
      const artExt = extFromPath(artPath) || ".png";
      const publicArtPath = `published/${episode.show_id}/${episodeId}/artwork${artExt}`;
      const { data: artBlob } = await admin.storage
        .from(PRIVATE_BUCKET)
        .download(artPath);
      if (artBlob) {
        const artBuffer = Buffer.from(await artBlob.arrayBuffer());
        await admin.storage
          .from(PUBLIC_BUCKET)
          .upload(publicArtPath, artBuffer, {
            contentType: "image/png",
            upsert: true,
          });
        publishedArtworkUrl = admin.storage
          .from(PUBLIC_BUCKET)
          .getPublicUrl(publicArtPath).data.publicUrl;
      }
    }
  }

  // 5) Save the permanent public metadata + mark Published.
  const { error: updErr } = await admin
    .from("episodes")
    .update({
      status: "Published",
      published_audio_url: audioPublic.publicUrl,
      published_audio_size: audioSize,
      published_audio_mime: audioMime,
      published_audio_duration: recording.duration || null,
      published_artwork_url: publishedArtworkUrl,
      published_at: new Date().toISOString(),
    })
    .eq("id", episodeId);

  if (updErr) {
    return NextResponse.json(
      { error: `Could not update episode: ${updErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    episodeId,
    publishedAudioUrl: audioPublic.publicUrl,
    publishedAudioSize: audioSize,
    publishedAudioMime: audioMime,
    publishedArtworkUrl,
    note:
      audioExt === ".webm"
        ? "Audio published as WebM. Apple Podcasts requires MP3 — MP3 conversion is the next step."
        : undefined,
  });
}
