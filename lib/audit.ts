/**
 * lib/audit.ts — SERVER-ONLY helper to append to the immutable audit log (#58).
 *
 * The audit log is a tamper-proof record of sensitive actions (deleting a show,
 * changing someone's role, adding/removing a team member, importing a show,
 * publishing an episode). Rows can only be INSERTed by the service role and can
 * never be updated or deleted — that's what makes the trail trustworthy.
 *
 * Best-effort, like notifications: recording an action must NEVER break the
 * action itself. If the audit write fails, we log and move on.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Known action names, kept as a union so callers can't typo an event. */
export type AuditAction =
  | "show.deleted"
  | "show.imported"
  | "member.added"
  | "member.removed"
  | "member.role_changed"
  | "episode.published"
  | "episode.unpublished";

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Append one entry to the audit log. All fields except action are optional so
 * callers only pass what they have.
 *
 * @param db      optional existing service-role client (reuse to save a client)
 */
export async function recordAudit(
  input: {
    showId?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    action: AuditAction;
    target?: string | null;
    metadata?: Record<string, unknown>;
  },
  db?: SupabaseClient | null
): Promise<void> {
  const client = db ?? admin();
  if (!client) {
    console.log("[audit] service role not configured — skipping audit entry.");
    return;
  }
  try {
    const { error } = await client.from("audit_log").insert({
      show_id: input.showId ?? null,
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      target: input.target ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.error("[audit] insert failed:", error.message);
  } catch (err) {
    console.error("[audit] insert threw:", err);
  }
}
