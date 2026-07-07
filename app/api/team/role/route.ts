import { NextResponse } from "next/server";
import { admin, callerId, roleOnShow, emailsFor } from "@/lib/teamServer";
import { recordAudit } from "@/lib/audit";
import { rateLimit, clientKey, isUuid, isOneOf } from "@/lib/guard";

export const dynamic = "force-dynamic";

const ALLOWED = ["producer", "editor", "host"] as const;

/** POST /api/team/role { showId, userId, role } — owner/producer only. Owner is immutable. */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const rl = rateLimit(clientKey(request, "team-role"), 30, 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );

  const { showId, userId, role } = await request.json().catch(() => ({}));
  if (!isUuid(showId) || !isUuid(userId))
    return NextResponse.json({ error: "A valid showId and userId are required." }, { status: 400 });
  if (!isOneOf(role, ALLOWED))
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

  // Audit trail: who changed whose role, from what to what.
  const emails = await emailsFor(db, [uid, userId]);
  await recordAudit(
    {
      showId,
      actorId: uid,
      actorEmail: emails[uid] ?? null,
      action: "member.role_changed",
      target: emails[userId] ?? userId,
      metadata: { from: targetRole, to: role },
    },
    db
  );

  return NextResponse.json({ ok: true });
}
