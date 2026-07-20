import { NextResponse } from "next/server";

import { admin, callerId } from "@/lib/teamServer";
import { getPlan } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A WAV mixdown can be large; give the upload a generous time budget.
export const maxDuration = 300;

/**
 * POST /api/episodes/from-studio — the "Send to Live" bridge (Studio → Live).
 *
 * The separate SoundStage Studio app flattens a project to a single WAV mixdown
 * and POSTs it here (cross-origin, multipart/form-data, with the user's Bearer
 * token). We create a NEW DRAFT episode ("Planning") in a show the caller owns
 * and attach the mixdown as that episode's recording. We do NOT publish — that
 * stays a separate user action in Live.
 *
 * Studio Plus only — same gate as /api/access/studio.
 */

const PRIVATE_BUCKET = "soundstage-assets";

// Origins permitted to call this cross-origin (mirrors /api/access/studio).
const ALLOWED_ORIGINS = [
  "https://soundstage-studio.vercel.app",
  "http://localhost:5173", // Vite dev default
  "http://localhost:3000",
];

/** CORS headers for an allowed origin; echoes the origin only if allow-listed. */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    return await handleFromStudio(request, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Send to Live failed: ${message}` },
      { status: 500, headers: cors }
    );
  }
}

async function handleFromStudio(request: Request, cors: Record<string, string>) {
  const db = admin();
  if (!db)
    return NextResponse.json(
      { error: "Server not configured." },
      { status: 500, headers: cors }
    );

  const uid = await callerId(db, request);
  if (!uid)
    return NextResponse.json(
      { error: "Not signed in." },
      { status: 401, headers: cors }
    );

  // Studio Plus only — same gate the Studio app itself uses.
  const plan = await getPlan(db, uid);
  if (plan !== "studio_plus")
    return NextResponse.json(
      { error: "SoundStage Studio requires the Studio Plus plan.", plan },
      { status: 403, headers: cors }
    );

  // Parse the multipart upload.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400, headers: cors }
    );
  }

  const showId = String(form.get("showId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const audio = form.get("audio");
  const durationRaw = form.get("durationSeconds");

  if (!showId)
    return NextResponse.json(
      { error: "showId is required." },
      { status: 400, headers: cors }
    );
  if (!title)
    return NextResponse.json(
      { error: "title is required." },
      { status: 400, headers: cors }
    );
  if (!(audio instanceof File))
    return NextResponse.json(
      { error: "audio file is required." },
      { status: 400, headers: cors }
    );

  const durationSeconds =
    durationRaw != null && String(durationRaw).trim() !== ""
      ? Number(durationRaw)
      : null;

  // Verify the show belongs to the caller (owned, not deleted).
  const { data: show } = await db
    .from("shows")
    .select("id")
    .eq("id", showId)
    .eq("user_id", uid)
    .is("deleted_at", null)
    .maybeSingle();
  if (!show)
    return NextResponse.json(
      { error: "Show not found or not yours." },
      { status: 404, headers: cors }
    );

  // 1) Create the DRAFT episode ("Planning" — NOT published).
  const { data: episode, error: epErr } = await db
    .from("episodes")
    .insert({ user_id: uid, show_id: showId, title, status: "Planning" })
    .select("id")
    .single();
  if (epErr || !episode)
    return NextResponse.json(
      { error: epErr?.message || "Failed to create the episode." },
      { status: 500, headers: cors }
    );
  const episodeId = episode.id as string;

  // 2) Upload the mixdown to the PRIVATE bucket at a stable path.
  const buffer = Buffer.from(await audio.arrayBuffer());
  const path = `studio-imports/${uid}/${episodeId}/mixdown.wav`;
  const { error: upErr } = await db.storage
    .from(PRIVATE_BUCKET)
    .upload(path, buffer, { contentType: "audio/wav", upsert: true });
  if (upErr)
    return NextResponse.json(
      { error: `Could not upload audio: ${upErr.message}` },
      { status: 500, headers: cors }
    );

  // 3) Sign the private object (1-year expiry) — same signed-URL shape the rest
  // of the app stores in recordings.audio_url (publish re-derives the path).
  const { data: signed, error: signErr } = await db.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !signed?.signedUrl)
    return NextResponse.json(
      { error: `Could not sign audio URL: ${signErr?.message ?? "unknown"}` },
      { status: 500, headers: cors }
    );

  // 4) Attach the recording to the new episode.
  const { error: recErr } = await db.from("recordings").insert({
    user_id: uid,
    episode_id: episodeId,
    name: title,
    duration: durationSeconds,
    audio_url: signed.signedUrl,
  });
  if (recErr)
    return NextResponse.json(
      { error: `Could not attach recording: ${recErr.message}` },
      { status: 500, headers: cors }
    );

  const origin = new URL(request.url).origin;
  const episodeUrl = `${origin}/episodes/${episodeId}`;

  return NextResponse.json(
    { episodeId, showId, title, status: "Planning", episodeUrl },
    { status: 200, headers: cors }
  );
}
