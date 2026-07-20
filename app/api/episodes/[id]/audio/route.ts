import { NextResponse } from "next/server";

import { getPlan } from "@/lib/plan";
import { requireEpisodeRole } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/episodes/[id]/audio — the "Open in Studio" bridge.
 *
 * The separate SoundStage Studio app calls this (cross-origin, with the user's
 * Bearer token) to fetch a Live episode's finished audio so it can be re-edited.
 * Gated to `studio_plus` only — identical to how the Studio app itself is gated
 * by /api/access/studio — AND to callers who have a role on the parent show.
 */

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
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Copy CORS headers onto an already-built response (e.g. an auth denial). */
function withCors(res: NextResponse, cors: Record<string, string>): NextResponse {
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

type Props = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request, { params }: Props) {
  const cors = corsHeaders(request);
  const { id } = await params;

  // Auth + episode access (401 anon, 404 missing episode, 403 no role).
  const gate = await requireEpisodeRole(request, id, "episode-audio");
  if (!gate.ok) return withCors(gate.response, cors);
  const { db, uid } = gate;

  // Studio Plus only — same gate the Studio app itself uses.
  const plan = await getPlan(db, uid);
  if (plan !== "studio_plus")
    return NextResponse.json(
      { error: "SoundStage Studio requires the Studio Plus plan.", plan },
      { status: 403, headers: cors }
    );

  const { data: episode, error } = await db
    .from("episodes")
    .select(
      "id, title, published_audio_url, published_audio_mime, published_audio_size, published_audio_duration"
    )
    .eq("id", id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: cors }
    );

  if (!episode?.published_audio_url)
    return NextResponse.json(
      { error: "This episode has no finished audio to open in Studio yet." },
      { status: 409, headers: cors }
    );

  return NextResponse.json(
    {
      episodeId: episode.id,
      title: episode.title,
      audioUrl: episode.published_audio_url,
      mime: episode.published_audio_mime ?? null,
      size: episode.published_audio_size ?? null,
      duration: episode.published_audio_duration ?? null,
    },
    { status: 200, headers: cors }
  );
}
