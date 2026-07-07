import { NextResponse } from "next/server";
import {
  admin,
  callerId,
  roleOnShow,
  findUserIdByEmail,
} from "@/lib/teamServer";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

const ALLOWED = ["producer", "editor", "host"] as const;

/** POST /api/team/add { showId, email, role } — owner/producer only. */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const { showId, email, role } = await request.json().catch(() => ({}));
  if (!showId || !email || !role)
    return NextResponse.json({ error: "showId, email and role are required." }, { status: 400 });
  if (!ALLOWED.includes(role))
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const uid = await callerId(db, request);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Only owner/producer can add members.
  const myRole = await roleOnShow(db, showId, uid);
  if (myRole !== "owner" && myRole !== "producer")
    return NextResponse.json({ error: "Only owners and producers can add members." }, { status: 403 });

  // Resolve the invitee. They must already have an account (email-based invite
  // for brand-new users would piggyback on Phase 9 email — deferred).
  const targetId = await findUserIdByEmail(db, email);
  if (!targetId) {
    return NextResponse.json(
      {
        error:
          "No SoundStage account found for that email. Ask them to sign up first, then add them.",
      },
      { status: 404 }
    );
  }

  // Already a member? Report gracefully.
  const existing = await roleOnShow(db, showId, targetId);
  if (existing) {
    return NextResponse.json(
      { error: `That person is already a ${existing} on this show.` },
      { status: 409 }
    );
  }

  const { error } = await db
    .from("show_memberships")
    .insert({ show_id: showId, user_id: targetId, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tell the new member (in-app notification; email is dormant until #41 key set).
  const { data: show } = await db.from("shows").select("title").eq("id", showId).maybeSingle();
  await createNotification({
    userId: targetId,
    type: "team_added",
    title: `You were added to "${show?.title ?? "a show"}"`,
    body: `You're now a ${role} on this show.`,
    link: "/shows",
  });

  return NextResponse.json({ added: true, email });
}
