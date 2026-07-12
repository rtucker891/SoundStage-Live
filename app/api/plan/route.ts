import { NextResponse } from "next/server";
import { admin, callerId } from "@/lib/teamServer";
import { getPlan } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * GET /api/plan — returns the signed-in caller's subscription plan so the UI can
 * show the AI Studio as unlocked (Studio) or locked-with-upgrade (free).
 *
 * This is a convenience/UX signal only. The AUTHORITATIVE gate lives in the
 * orchestration endpoint (/api/ai/live-to-published), which re-checks the plan
 * server-side — the UI can't bypass the feature by lying about its plan.
 */
export async function GET(request: Request) {
  const db = admin();
  if (!db)
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const uid = await callerId(db, request);
  if (!uid)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const plan = await getPlan(db, uid);
  return NextResponse.json({ plan });
}
