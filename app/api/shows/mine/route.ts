import { NextResponse } from "next/server";

import { admin, callerId } from "@/lib/teamServer";
import { getPlan } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shows/mine — the "Send to Live" show picker.
 *
 * The separate SoundStage Studio app calls this (cross-origin, with the user's
 * Bearer token) to list the shows a studio_plus user owns, so they can pick one
 * to drop a flattened mixdown into as a new draft episode.
 *
 * Studio Plus only — same gate as /api/access/studio.
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

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const cors = corsHeaders(request);

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

  const { data: shows, error } = await db
    .from("shows")
    .select("id, title")
    .eq("user_id", uid)
    .is("deleted_at", null)
    .order("title");
  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: cors }
    );

  return NextResponse.json({ shows: shows ?? [] }, { status: 200, headers: cors });
}
