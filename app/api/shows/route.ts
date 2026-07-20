import { NextResponse } from "next/server";

import { admin, callerId } from "@/lib/teamServer";
import { getPlan, canCreateShow, showLimitFor } from "@/lib/plan";
import { cleanString } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shows { title, description } — create a show for the signed-in user.
 *
 * AUTHORITATIVE per-tier limit enforcement lives here (service-role db): the
 * client path cannot be trusted. We count the caller's own non-deleted shows and
 * reject with 403 when they're at their plan's cap (free 1, creator 5; studio /
 * studio_plus unlimited).
 */
export async function POST(request: Request) {
  const db = admin();
  if (!db)
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const uid = await callerId(db, request);
  if (!uid)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = cleanString(body?.title, 200);
  if (!title)
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  const description = cleanString(body?.description, 5000) ?? "";

  const plan = await getPlan(db, uid);

  // Count the caller's OWN, non-soft-deleted shows.
  const { count, error: countError } = await db
    .from("shows")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .is("deleted_at", null);
  if (countError)
    return NextResponse.json({ error: countError.message }, { status: 500 });

  if (!canCreateShow(plan, count ?? 0))
    return NextResponse.json(
      {
        error: "Show limit reached for your plan.",
        limit: showLimitFor(plan),
        plan,
      },
      { status: 403 }
    );

  const { data: createdShow, error } = await db
    .from("shows")
    .insert({
      user_id: uid,
      title,
      description,
      status: "Draft",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: createdShow.id,
    title: createdShow.title,
    description: createdShow.description || "",
    status: createdShow.status || "Draft",
    episodes: 0,
  });
}
