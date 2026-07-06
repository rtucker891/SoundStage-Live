/**
 * lib/notify.ts — SERVER-ONLY helper to CREATE a notification for a user (#40).
 *
 * Why server-only + service role: some events that should notify a creator are
 * triggered by someone who is NOT that creator — e.g. a logged-out guest
 * clicking "Accept" on an invite. That guest has no permission to insert a row
 * for the creator under normal RLS. So this helper uses the service-role key
 * (which bypasses RLS) and is only ever called from server API routes.
 *
 * Best-effort: never throws. A failed notification must never break the action
 * that triggered it (accepting an invite still succeeds even if the notify row
 * fails to write).
 */
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  const db = admin();
  if (!db) {
    console.log("[notify] service role not configured — skipping notification.");
    return;
  }
  try {
    const { error } = await db.from("notifications").insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
    if (error) console.error("[notify] insert failed:", error.message);
  } catch (err) {
    console.error("[notify] insert threw:", err);
  }
}
