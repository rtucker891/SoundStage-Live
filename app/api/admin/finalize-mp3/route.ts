import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PUBLIC_BUCKET = "soundstage-public";

/**
 * One-time / maintenance endpoint used to upload a pre-converted MP3 for an
 * already-published episode and update its metadata to point at the MP3.
 *
 * This exists because the original 5 episodes were recorded as WebM before the
 * browser-side MP3 pipeline existed. We convert them once, off-app, and finalize
 * them here.
 *
 * Protected by ADMIN_MAINTENANCE_TOKEN so it can't be abused publicly.
 * Send the MP3 as multipart/form-data with fields:
 *   token, episodeId, showId, durationSeconds
 *   file (the MP3 binary)
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminToken = process.env.ADMIN_MAINTENANCE_TOKEN;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server missing Supabase credentials." },
        { status: 500 }
      );
    }
    if (!adminToken) {
      return NextResponse.json(
        { error: "Server missing ADMIN_MAINTENANCE_TOKEN." },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const token = form.get("token");
    const episodeId = form.get("episodeId");
    const showId = form.get("showId");
    const durationRaw = form.get("durationSeconds");
    const file = form.get("file");

    if (token !== adminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      typeof episodeId !== "string" ||
      typeof showId !== "string" ||
      !(file instanceof File)
    ) {
      return NextResponse.json(
        { error: "Missing episodeId, showId, or file." },
        { status: 400 }
      );
    }

    const durationSeconds = durationRaw ? Math.round(Number(durationRaw)) : null;

    const admin = createClient(supabaseUrl, serviceKey);

    const buffer = Buffer.from(await file.arrayBuffer());
    const size = buffer.length;
    const publicPath = `published/${showId}/${episodeId}/audio.mp3`;

    const { error: upErr } = await admin.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, buffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (upErr) {
      return NextResponse.json(
        { error: `Upload failed: ${upErr.message}` },
        { status: 500 }
      );
    }

    const { data: pub } = admin.storage
      .from(PUBLIC_BUCKET)
      .getPublicUrl(publicPath);

    const { error: updErr } = await admin
      .from("episodes")
      .update({
        published_audio_url: pub.publicUrl,
        published_audio_size: size,
        published_audio_mime: "audio/mpeg",
        published_audio_duration: durationSeconds,
      })
      .eq("id", episodeId);

    if (updErr) {
      return NextResponse.json(
        { error: `Episode update failed: ${updErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      episodeId,
      publishedAudioUrl: pub.publicUrl,
      publishedAudioSize: size,
      publishedAudioMime: "audio/mpeg",
      publishedAudioDuration: durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Finalize failed: ${message}` },
      { status: 500 }
    );
  }
}
