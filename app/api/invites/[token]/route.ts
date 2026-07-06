import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

/**
 * Public invite endpoint (#20). A guest who was invited isn't logged in, so
 * this route uses the service role to look up and respond to an invite BY
 * TOKEN only — never exposing anything beyond the single matching invite.
 *
 * GET  → return the invite's public details (name, message, status, show/episode title).
 * POST → record the guest's response ({ action: "accept" | "decline" }).
 *
 * (Phase 9 will additionally EMAIL the creator when a guest responds.)
 */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  const db = admin();
  if (!db) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 }
    );
  }

  const { data: invite } = await db
    .from("guest_invites")
    .select("guest_name, message, status, episode_id, created_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // Best-effort episode title for context.
  let episodeTitle: string | null = null;
  if (invite.episode_id) {
    const { data: ep } = await db
      .from("episodes")
      .select("title")
      .eq("id", invite.episode_id)
      .maybeSingle();
    episodeTitle = ep?.title ?? null;
  }

  return NextResponse.json({
    guestName: invite.guest_name,
    message: invite.message,
    status: invite.status,
    episodeTitle,
  });
}

export async function POST(request: Request, { params }: Props) {
  const { token } = await params;
  const db = admin();
  if (!db) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 }
    );
  }

  let action = "";
  try {
    const body = await request.json();
    action = body?.action;
  } catch {
    // ignore
  }
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json(
      { error: "action must be 'accept' or 'decline'." },
      { status: 400 }
    );
  }

  const { data: invite } = await db
    .from("guest_invites")
    .select("id, status, user_id, guest_name, guest_email, episode_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: `This invite was already ${invite.status}.` },
      { status: 409 }
    );
  }

  const newStatus = action === "accept" ? "accepted" : "declined";

  const { error } = await db
    .from("guest_invites")
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* ---- Phase 9: notify + email the CREATOR that the guest responded ---- */
  // Best-effort; these never block the response.
  let episodeTitle: string | null = null;
  if (invite.episode_id) {
    const { data: ep } = await db
      .from("episodes")
      .select("title")
      .eq("id", invite.episode_id)
      .maybeSingle();
    episodeTitle = ep?.title ?? null;
  }
  const context = episodeTitle ? ` for "${episodeTitle}"` : "";
  const verb = newStatus === "accepted" ? "accepted" : "declined";

  // In-app notification (#40) — always works, no external service needed.
  await createNotification({
    userId: invite.user_id,
    type: `invite_${newStatus}`,
    title: `${invite.guest_name} ${verb} your guest invite`,
    body: `${invite.guest_name} ${verb} your invitation${context}.`,
    link: "/guests",
  });

  // Email the creator (#41) — dormant until RESEND_API_KEY is set.
  // We look up the creator's email from their auth record via service role.
  try {
    const { data: creator } = await db.auth.admin.getUserById(invite.user_id);
    const creatorEmail = creator?.user?.email;
    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `${invite.guest_name} ${verb} your guest invite`,
        text: `${invite.guest_name} (${invite.guest_email}) has ${verb} your guest invitation${context}.\n\nView your invites: manage them on the Guests page in SoundStage Live.`,
      });
    }
  } catch (e) {
    console.error("[invite] creator email lookup/send failed:", e);
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
  });
}
