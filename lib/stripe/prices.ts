/**
 * lib/stripe/prices.ts — the single source of truth mapping our paid plans to
 * Stripe price IDs, and back again.
 *
 * The price IDs are the EXISTING test-mode prices (created in the Stripe
 * dashboard). They can be overridden per-environment via env vars so the same
 * code works against live-mode price IDs later without a code change.
 *
 * This module is PURE (no Stripe SDK, no I/O) so the mapping logic can be
 * unit-tested directly.
 */
import type { Plan } from "@/lib/plan";

export type PaidPlan = "creator" | "studio" | "studio_plus";
export type BillingInterval = "month" | "year";

/** Documented test-mode price IDs (fallbacks when env overrides are absent). */
const DEFAULT_PRICE_IDS = {
  creator: {
    month: "price_1Tsl5KHGpczA907HeuLzXKY7",
    year: "price_1Tsl5KHGpczA907H3b6PEPLf",
  },
  studio: {
    month: "price_1Tsl5LHGpczA907H5bOxJPlt",
    year: "price_1Tsl5LHGpczA907HTSU6MhgR",
  },
  // No test-mode price exists for Studio Plus; these placeholders never match a
  // real Stripe ID, so the mapping only resolves via the env overrides below.
  studio_plus: {
    month: "price_studio_plus_month_unset",
    year: "price_studio_plus_year_unset",
  },
} as const;

/**
 * Resolve the price ID for a plan + interval, preferring an env override and
 * falling back to the documented test-mode ID.
 */
export function priceIdFor(plan: PaidPlan, interval: BillingInterval): string {
  const env = process.env;
  const overrides: Record<PaidPlan, Record<BillingInterval, string | undefined>> =
    {
      creator: {
        month: env.STRIPE_PRICE_CREATOR_MONTH,
        year: env.STRIPE_PRICE_CREATOR_YEAR,
      },
      studio: {
        month: env.STRIPE_PRICE_STUDIO_MONTH,
        year: env.STRIPE_PRICE_STUDIO_YEAR,
      },
      studio_plus: {
        month: env.STRIPE_PRICE_STUDIO_PLUS_MONTH,
        year: env.STRIPE_PRICE_STUDIO_PLUS_YEAR,
      },
    };
  return overrides[plan][interval] || DEFAULT_PRICE_IDS[plan][interval];
}

/**
 * Map a Stripe price ID back to the plan it grants. Checks env overrides first
 * (so live-mode IDs resolve) then the documented defaults. Returns "free" for
 * any unknown price (e.g. a legacy or deleted price) so an unexpected sub can
 * never silently unlock a paid tier.
 */
export function planForPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "free";
  for (const plan of ["creator", "studio", "studio_plus"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (priceId === priceIdFor(plan, interval)) return plan;
    }
  }
  return "free";
}

/** Interval implied by a price ID ("month"/"year"), or null if unknown. */
export function intervalForPriceId(
  priceId: string | null | undefined
): BillingInterval | null {
  if (!priceId) return null;
  for (const plan of ["creator", "studio", "studio_plus"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (priceId === priceIdFor(plan, interval)) return interval;
    }
  }
  return null;
}

/** Stripe subscription statuses we treat as granting the paid plan. */
export const ACTIVE_STATUSES = ["active", "trialing"] as const;

export function isActiveStatus(status: string | null | undefined): boolean {
  return (
    !!status && (ACTIVE_STATUSES as readonly string[]).includes(status)
  );
}
