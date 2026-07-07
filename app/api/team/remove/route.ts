import { NextResponse } from "next/server";
import { admin, callerId, roleOnShow } from "@/lib/teamServer";

export const dynamic = "force-dynamic";

/**
 * POST /api/team/remove { showId, userId }
 * Owner/producer can remove others. Any member can remove THEMSELVES (leave),
 * except the owner, who can never be removed (protects the show).
 */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const { showId, userId } = await request.json().catch(() => ({}));
  if (!showId || !userId)
    return NextResponse.json({ error: "showId and userId are required." }, { status: 400 });

  const uid = await callerId(db, request);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const myRole = await roleOnShow(db, showId, uid);
  if (!myRole) return NextResponse.json({ error: "No access to this show." }, { status: 403 });

  const targetRole = await roleOnShow(db, showId, userId);
  if (!targetRole)
    return NextResponse.json({ error: "That person isn't a member of this show." }, { status: 404 });

  // The owner can never be removed.
  if (targetRole === "owner")
    return NextResponse.json({ error: "The show owner can't be removed." }, { status: 403 });

  // You may remove others only if you manage the show; you may always remove yourself.
  const removingSelf = userId === uid;
  const canManage = myRole === "owner" || myRole === "producer";
  if (!removingSelf && !canManage)
    return NextResponse.json({ error: "You don't have permission to remove members." }, { status: 403 });

  const { error } = await db
    .from("show_memberships")
    .delete()
    .eq("show_id", showId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
