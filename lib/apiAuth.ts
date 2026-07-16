/**
 * lib/apiAuth.ts — SERVER-ONLY authorization guards for API routes.
 *
 * These wrap the existing, proven pieces so every sensitive route enforces the
 * same rules the team routes already do:
 *   - callerId()  (Bearer token → user id)      from lib/teamServer
 *   - roleOnShow() (membership + role)           from lib/teamServer
 *   - rateLimit()/clientKey() (abuse throttle)   from lib/guard
 *
 * Two families of routes use these:
 *   1. AI routes call requireUser() — any signed-in user may use them, but not
 *      anonymously and not at an abusive rate (cost protection).
 *   2. Service-role routes (which bypass RLS) call requireEpisodeRole()/
 *      requireShowRole() — the caller must be a member of the parent show,
 *      matching how /api/ai/live-to-published gates access.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { admin, callerId, roleOnShow } from "@/lib/teamServer";
import { rateLimit, clientKey } from "@/lib/guard";

/** A denial carries the ready-to-return HTTP response. */
type Deny = { ok: false; response: NextResponse };
type AllowUser = { ok: true; db: SupabaseClient; uid: string };
type AllowEpisode = AllowUser & { showId: string };

/**
 * Require a signed-in caller and apply a best-effort per-client rate limit.
 * Returns the service-role db client + the caller's user id on success, or a
 * Deny with the correct status (500 not configured, 429 throttled, 401 anon).
 */
export async function requireUser(
  request: Request,
  routeName: string,
  limit = 20,
  windowMs = 60_000
): Promise<Deny | AllowUser> {
  const db = admin();
  if (!db)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server not configured." },
        { status: 500 }
      ),
    };

  // Throttle first so anonymous floods can't bypass the limiter.
  const rl = rateLimit(clientKey(request, routeName), limit, windowMs);
  if (!rl.ok)
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        }
      ),
    };

  const uid = await callerId(db, request);
  if (!uid)
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };

  return { ok: true, db, uid };
}

/**
 * Require a signed-in caller who is a member of the show that owns `episodeId`.
 * Resolves the episode's parent show, then applies the same roleOnShow check the
 * team routes use. 401 if anon, 404 if the episode doesn't exist, 403 if the
 * caller has no role on the show.
 */
export async function requireEpisodeRole(
  request: Request,
  episodeId: string,
  routeName: string
): Promise<Deny | AllowEpisode> {
  const base = await requireUser(request, routeName);
  if (!base.ok) return base;
  const { db, uid } = base;

  const { data: episode } = await db
    .from("episodes")
    .select("show_id")
    .eq("id", episodeId)
    .maybeSingle();
  if (!episode)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Episode not found." },
        { status: 404 }
      ),
    };

  const role = await roleOnShow(db, episode.show_id, uid);
  if (!role)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You don't have access to this episode." },
        { status: 403 }
      ),
    };

  return { ok: true, db, uid, showId: episode.show_id };
}

/**
 * Require a signed-in caller who is a member of `showId`. 401 if anon, 403 if
 * the caller has no role on the show.
 */
export async function requireShowRole(
  request: Request,
  showId: string,
  routeName: string
): Promise<Deny | AllowUser> {
  const base = await requireUser(request, routeName);
  if (!base.ok) return base;
  const { db, uid } = base;

  const role = await roleOnShow(db, showId, uid);
  if (!role)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You don't have access to this show." },
        { status: 403 }
      ),
    };

  return { ok: true, db, uid };
}
