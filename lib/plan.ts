/**
 * lib/plan.ts — SERVER-ONLY subscription-tier gating.
 *
 * SINGLE SOURCE OF TRUTH for "what plan is this user on?". Everything that gates
 * features (the AI Studio orchestration endpoint + the /api/plan lookup the UI
 * uses to show locked vs. unlocked) resolves the plan through getPlan() here.
 *
 * Plans are now backed by REAL Stripe subscriptions (see lib/stripe/* and the
 * `subscriptions` table). getPlan resolves, in priority order:
 *   1. The `subscriptions` row for the user, IF it exists and the subscription
 *      is active/trialing — the row's `plan` is authoritative. Any error (e.g.
 *      the table not existing before the migration is applied) is swallowed and
 *      we fall through, so the app keeps working pre-migration.
 *   2. The STUDIO_USER_IDS env var (comma-separated user ids) — a manual bypass
 *      that marks a user 'studio' for testing without touching billing.
 *   3. Default: 'free'.
 */
import { type SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "creator" | "studio" | "studio_plus";

/** True if the given plan unlocks the premium AI Studio pipeline. */
export function isStudioPlan(plan: Plan): boolean {
  return plan === "studio" || plan === "studio_plus";
}

/** Paid plans backed by a real Stripe subscription. */
const PAID_PLANS = new Set<Plan>(["creator", "studio", "studio_plus"]);

/** Subscription statuses that grant the row's paid plan. */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Normalize an arbitrary stored plan string to a known Plan. */
function normalizePlan(value: unknown): Plan {
  return typeof value === "string" && PAID_PLANS.has(value as Plan)
    ? (value as Plan)
    : "free";
}

/** User ids marked Studio via env config (test/manual override, no billing). */
function studioIdsFromEnv(): Set<string> {
  const raw = process.env.STUDIO_USER_IDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Resolve a user's plan. `db` is a service-role client (from teamServer.admin())
 * used to read the subscription row; pass null to skip the DB lookup.
 * Never throws — always resolves to a concrete plan.
 */
export async function getPlan(
  db: SupabaseClient | null,
  userId: string
): Promise<Plan> {
  // 1. Authoritative: the user's Stripe-backed subscription row.
  if (db) {
    try {
      const { data, error } = await db
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", userId)
        .maybeSingle();
      if (!error && data && ACTIVE_STATUSES.has(String(data.status))) {
        return normalizePlan(data.plan);
      }
    } catch {
      // Table may not exist yet (pre-migration) — fall through.
    }
  }

  // 2. Env override for manual testing without billing.
  if (studioIdsFromEnv().has(userId)) return "studio";

  // 3. Default.
  return "free";
}
