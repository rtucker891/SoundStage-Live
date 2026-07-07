import { NextResponse } from "next/server";
import { admin, callerId, roleOnShow, emailsFor } from "@/lib/teamServer";

export const dynamic = "force-dynamic";

/** POST /api/team/list  { showId } → members (with emails). Any member may view. */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const { showId } = await request.json().catch(() => ({}));
  if (!showId) return NextResponse.json({ error: "showId required." }, { status: 400 });

  const uid = await callerId(db, request);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Caller must belong to the show to see its roster.
  const myRole = await roleOnShow(db, showId, uid);
  if (!myRole) return NextResponse.json({ error: "No access to this show." }, { status: 403 });

  const { data: rows, error } = await db
    .from("show_memberships")
    .select("id, user_id, role, created_at")
    .eq("show_id", showId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const emails = await emailsFor(db, (rows ?? []).map((r) => r.user_id));
  const roleRank: Record<string, number> = { owner: 0, producer: 1, editor: 2, host: 3 };

  const members = (rows ?? [])
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      email: emails[r.user_id] ?? null,
      role: r.role,
      createdAt: r.created_at,
      isYou: r.user_id === uid,
    }))
    .sort((a, b) => (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9));

  return NextResponse.json({ members, myRole });
}
