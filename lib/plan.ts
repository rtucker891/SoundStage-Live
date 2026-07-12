/**
 * lib/plan.ts — SERVER-ONLY subscription-tier gating for the premium
 * "Live-to-Published AI Episode Studio" (flagship, Studio-tier only).
 *
 * SINGLE SOURCE OF TRUTH for "is this user Studio tier?". Everything that gates
 * the AI Studio (the orchestration endpoint + the /api/plan lookup the UI uses
 * to show locked vs. unlocked) resolves the plan through getPlan() here.
 *
 * ⚠️ Billing (Stripe) is NOT built yet. Real enforcement — webhooks writing the
 * plan on checkout/cancel — lands with the Stripe build. Until then the plan is
 * resolved, in priority order, from:
 *   1. A `profiles.plan` column, IF that table/column exists (best-effort read;
 *      any error, e.g. the table not existing, is swallowed and we fall through).
 *   2. The STUDIO_USER_IDS env var (comma-separated user ids) — lets us mark a
 *      user 'studio' for testing without any billing wired up.
 *   3. Default: 'free'.
 *
 * When Stripe arrives, point step 1 at whatever table the webhook updates
 * (e.g. `subscriptions.plan`) and keep the rest of the app unchanged.
 */
import { type SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "studio";

/** True if the given plan unlocks the premium AI Studio pipeline. */
export function isStudioPlan(plan: Plan): boolean {
  return plan === "studio";
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
 * used for the best-effort profile read; pass null to skip the DB lookup.
 * Never throws — always resolves to a concrete plan.
 */
export async function getPlan(
  db: SupabaseClient | null,
  userId: string
): Promise<Plan> {
  // 1. Best-effort: a `profiles.plan` column, if the table exists.
  if (db) {
    try {
      const { data, error } = await db
        .from("profiles")
        .select("plan")
        .eq("id", userId)
        .maybeSingle();
      if (!error && data?.plan === "studio") return "studio";
    } catch {
      // Table/column may not exist yet (pre-Stripe) — fall through.
    }
  }

  // 2. Env override for testing without billing.
  if (studioIdsFromEnv().has(userId)) return "studio";

  // 3. Default.
  return "free";
}
