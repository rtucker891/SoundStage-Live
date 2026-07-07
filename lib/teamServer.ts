/**
 * lib/teamServer.ts — SERVER-ONLY helpers for team management (#35-39).
 *
 * All team writes flow through API routes (not direct browser calls) because:
 *  - We resolve users by EMAIL, which needs the auth admin (service role).
 *  - We enforce protection rules (never remove/demote the owner) in one place.
 *  - We double-check the CALLER is allowed (owner/producer) server-side, even
 *    though RLS also guards the tables — defense in depth.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Resolve the caller's user id from their Bearer token. Null if not signed in. */
export async function callerId(
  db: SupabaseClient,
  req: Request
): Promise<string | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await db.auth.getUser(jwt);
  return data?.user?.id ?? null;
}

/** The caller's role on a show (via service role, bypassing RLS). Null if none. */
export async function roleOnShow(
  db: SupabaseClient,
  showId: string,
  userId: string
): Promise<string | null> {
  const { data } = await db
    .from("show_memberships")
    .select("role")
    .eq("show_id", showId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

/** Look up a user id by email. Paginates through the auth users list. */
export async function findUserIdByEmail(
  db: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  // getUserByEmail isn't in all versions; scan pages (fine for small teams).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const hit = data.users.find(
      (u) => (u.email || "").toLowerCase() === target
    );
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Map user ids → emails for display. */
export async function emailsFor(
  db: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data } = await db.auth.admin.getUserById(id);
        out[id] = data?.user?.email ?? null;
      } catch {
        out[id] = null;
      }
    })
  );
  return out;
}
