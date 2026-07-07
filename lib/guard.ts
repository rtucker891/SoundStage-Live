/**
 * lib/guard.ts — small server-side security helpers (#59).
 *
 * Two things live here:
 *   1. rateLimit() — a lightweight in-memory rate limiter to blunt abuse and
 *      runaway loops (e.g. someone hammering the import endpoint).
 *   2. Input validation helpers — tiny, dependency-free checks so routes
 *      validate consistently (valid UUID, email shape, safe string length).
 *
 * About the rate limiter's scope (important, honest limitation):
 * This counter lives in the memory of ONE serverless instance. On Vercel there
 * can be several instances, and they don't share this counter, so it is a
 * best-effort throttle — great for stopping a single client's runaway loop or
 * casual abuse, but NOT a hard global guarantee. For strict global limits we'd
 * back it with a shared store (e.g. Upstash Redis). This is noted in the
 * security runbook as a known follow-up.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so the map can't grow without bound.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Allow up to `limit` requests per `windowMs` for a given `key`.
 * Returns { ok } — ok=false means the caller has exceeded the limit.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Build a rate-limit key from the request + a route name. Uses the best
 * available client identifier: the forwarded IP header, falling back to a
 * constant so the limiter still functions (just coarser) if none is present.
 */
export function clientKey(request: Request, route: string): string {
  const fwd =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${route}:${fwd}`;
}

// ---- Input validation helpers ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True if the value is a syntactically valid UUID. */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True if the value looks like an email address (shape check, not delivery). */
export function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v.trim());
}

/**
 * A non-empty string within a max length. Trims first. Returns the trimmed
 * value or null if it fails.
 */
export function cleanString(v: unknown, maxLen = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > maxLen) return null;
  return t;
}

/** True if `v` is one of the allowed literal values. */
export function isOneOf<T extends readonly string[]>(
  v: unknown,
  allowed: T
): v is T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}
