import { NextResponse } from "next/server";

import { admin, callerId } from "@/lib/teamServer";
import { getPlan, type Plan } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/access/studio — the single source of truth the separate SoundStage
 * Studio web app calls to ask "may this signed-in user use Studio?".
 *
 * Access is granted ONLY to the top tier: `plan === "studio_plus"`. Note this is
 * deliberately stricter than `isStudioPlan()` (which also allows plain "studio")
 * — the Studio app is a Studio-Plus-exclusive benefit.
 *
 * Returns HTTP 200 with a clean boolean even for anonymous callers so Studio can
 * treat the answer as a simple `{ allowed }` flag without special-casing 401.
 */

// Origins permitted to call this cross-origin. The Studio app runs on a
// different origin than Live, so its browser calls need an explicit allow.
const ALLOWED_ORIGINS = [
  "https://soundstage-studio.vercel.app",
  "http://localhost:5173", // Vite dev default
  "http://localhost:3000",
];

/** Pure access rule: only the Studio Plus tier may use the Studio app. */
export function studioAccessAllowed(plan: Plan): boolean {
  return plan === "studio_plus";
}

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
      { allowed: false, plan: null, reason: "not_signed_in" },
      { status: 200, headers: cors }
    );

  const plan = await getPlan(db, uid);
  return NextResponse.json(
    { allowed: studioAccessAllowed(plan), plan },
    { status: 200, headers: cors }
  );
}
