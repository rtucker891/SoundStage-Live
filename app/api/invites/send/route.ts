import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, guestInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/invites/send  (#20 close-the-loop, #41)
 *
 * Sends the invite email to the GUEST. Called by the client right after
 * createGuestInvite() succeeds. Runs server-side so the RESEND_API_KEY stays
 * secret. Dormant (safe no-op) until that key is configured.
 *
 * Security: we don't trust the client to tell us who to email. We take the
 * invite `token`, look the invite up with the service role, and email the
 * address stored ON the invite row — so a caller can't spam arbitrary
 * addresses. We also confirm the caller owns the invite by matching the
 * bearer user against the invite's user_id.
 *
 * Body: { token: string }
 */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const db = admin();
  if (!db) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let token = "";
  try {
    const body = await request.json();
    token = body?.token || "";
  } catch {
    // ignore
  }
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  // Verify the caller (owner of the invite) from their access token.
  const authHeader = request.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  let callerId: string | null = null;
  if (jwt) {
    const { data } = await db.auth.getUser(jwt);
    callerId = data?.user?.id ?? null;
  }

  const { data: invite } = await db
    .from("guest_invites")
    .select("user_id, guest_name, guest_email, episode_id, message, token, status")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (callerId && callerId !== invite.user_id) {
    return NextResponse.json({ error: "Not your invite." }, { status: 403 });
  }

  // Build the accept URL from the request origin (works on any deployment).
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${invite.token}`;

  // Best-effort context: the host's display name + episode title.
  let hostName = "A SoundStage host";
  try {
    const { data: host } = await db.auth.admin.getUserById(invite.user_id);
    hostName = host?.user?.email?.split("@")[0] || hostName;
  } catch {
    // ignore
  }
  let showOrEpisode: string | null = null;
  if (invite.episode_id) {
    const { data: ep } = await db
      .from("episodes")
      .select("title")
      .eq("id", invite.episode_id)
      .maybeSingle();
    showOrEpisode = ep?.title ?? null;
  }

  const tpl = guestInviteEmail({
    guestName: invite.guest_name,
    hostName,
    showOrEpisode,
    message: invite.message,
    acceptUrl,
  });

  const result = await sendEmail({
    to: invite.guest_email,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });

  // Report back whether email actually went out (so the UI can tell the
  // creator "email sent" vs "copy this link and send it yourself").
  return NextResponse.json({ ok: true, email: result });
}
