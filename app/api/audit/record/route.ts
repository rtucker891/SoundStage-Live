import { NextResponse } from "next/server";
import { admin, callerId, roleOnShow, emailsFor } from "@/lib/teamServer";
import { recordAudit, type AuditAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/audit/record  { showId, action, target?, metadata? }
 *
 * Lets the CLIENT record an audit entry for a sensitive action that happens
 * client-side (e.g. deleting a show or publishing an episode via the browser
 * Supabase client). We can't fully trust the client, so this route:
 *   - requires a signed-in caller,
 *   - confirms the caller actually has a role on the show (can't forge entries
 *     for shows they don't belong to),
 *   - only accepts a known, whitelisted set of client-reportable actions,
 *   - stamps the entry with the SERVER's idea of who the caller is (not a
 *     client-supplied actor), so the "who" can't be spoofed.
 *
 * Everything else about the log stays server-authoritative and append-only.
 */
const CLIENT_ALLOWED: AuditAction[] = [
  "show.deleted",
  "episode.published",
  "episode.unpublished",
];

export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const uid = await callerId(db, request);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { showId, action, target } = body ?? {};
  const metadata =
    body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!showId || !action) {
    return NextResponse.json({ error: "showId and action are required." }, { status: 400 });
  }
  if (!CLIENT_ALLOWED.includes(action)) {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  // The caller must belong to the show to log against it.
  const role = await roleOnShow(db, showId, uid);
  if (!role) return NextResponse.json({ error: "No access to this show." }, { status: 403 });

  const emails = await emailsFor(db, [uid]);
  await recordAudit(
    {
      showId,
      actorId: uid,
      actorEmail: emails[uid] ?? null,
      action,
      target: typeof target === "string" ? target : null,
      metadata,
    },
    db
  );

  return NextResponse.json({ ok: true });
}
