import { NextResponse } from "next/server";
import {
  admin,
  callerId,
  roleOnShow,
  findUserIdByEmail,
} from "@/lib/teamServer";
import { createNotification } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import { emailsFor } from "@/lib/teamServer";
import { rateLimit, clientKey, isUuid, isEmail, isOneOf } from "@/lib/guard";
import { getPlan, canAddMember, seatLimitFor } from "@/lib/plan";

export const dynamic = "force-dynamic";

const ALLOWED = ["producer", "editor", "host"] as const;

/** POST /api/team/add { showId, email, role } — owner/producer only. */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  // Throttle member-adds (each scans the user list): 30/min per client.
  const rl = rateLimit(clientKey(request, "team-add"), 30, 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );

  const { showId, email, role } = await request.json().catch(() => ({}));
  if (!isUuid(showId))
    return NextResponse.json({ error: "A valid showId is required." }, { status: 400 });
  if (!isEmail(email))
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (!isOneOf(role, ALLOWED))
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

  // Seat limit: enforce the SHOW OWNER's plan (not the caller's). Counts only
  // COLLABORATORS (non-owner members); the owner never consumes a seat.
  const { data: ownerRow } = await db
    .from("show_memberships")
    .select("user_id")
    .eq("show_id", showId)
    .eq("role", "owner")
    .maybeSingle();
  let ownerId = ownerRow?.user_id as string | undefined;
  if (!ownerId) {
    // Fall back to the show's creator if no explicit owner membership row.
    const { data: show } = await db
      .from("shows")
      .select("user_id")
      .eq("id", showId)
      .maybeSingle();
    ownerId = show?.user_id as string | undefined;
  }
  const ownerPlan = ownerId ? await getPlan(db, ownerId) : "free";

  const { count: collaboratorCount } = await db
    .from("show_memberships")
    .select("*", { count: "exact", head: true })
    .eq("show_id", showId)
    .neq("role", "owner");

  if (!canAddMember(ownerPlan, collaboratorCount ?? 0))
    return NextResponse.json(
      {
        error: "This show has reached its team-member limit for the current plan.",
        limit: seatLimitFor(ownerPlan),
        plan: ownerPlan,
      },
      { status: 403 }
    );

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

  // Audit trail: who added whom, with what role.
  const emails = await emailsFor(db, [uid]);
  await recordAudit(
    {
      showId,
      actorId: uid,
      actorEmail: emails[uid] ?? null,
      action: "member.added",
      target: email,
      metadata: { role },
    },
    db
  );

  return NextResponse.json({ added: true, email });
}
