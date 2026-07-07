import { NextResponse } from "next/server";
import { admin, callerId, roleOnShow } from "@/lib/teamServer";

export const dynamic = "force-dynamic";

const ALLOWED = ["producer", "editor", "host"] as const;

/** POST /api/team/role { showId, userId, role } — owner/producer only. Owner is immutable. */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const { showId, userId, role } = await request.json().catch(() => ({}));
  if (!showId || !userId || !role)
    return NextResponse.json({ error: "showId, userId and role are required." }, { status: 400 });
  if (!ALLOWED.includes(role))
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const uid = await callerId(db, request);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const myRole = await roleOnShow(db, showId, uid);
  if (myRole !== "owner" && myRole !== "producer")
    return NextResponse.json({ error: "Only owners and producers can change roles." }, { status: 403 });

  // Protect the owner: their role can never be changed here.
  const targetRole = await roleOnShow(db, showId, userId);
  if (targetRole === "owner")
    return NextResponse.json({ error: "The owner's role can't be changed." }, { status: 403 });
  if (!targetRole)
    return NextResponse.json({ error: "That person isn't a member of this show." }, { status: 404 });

  const { error } = await db
    .from("show_memberships")
    .update({ role })
    .eq("show_id", showId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
