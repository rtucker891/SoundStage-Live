export const PAID_PLAN_KEYS = ["creator", "studio"] as const;
export const BILLING_INTERVALS = ["monthly", "annual"] as const;

export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number];
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

type PriceEnvironmentKey =
  | "STRIPE_PRICE_CREATOR_MONTHLY"
  | "STRIPE_PRICE_CREATOR_ANNUAL"
  | "STRIPE_PRICE_STUDIO_MONTHLY"
  | "STRIPE_PRICE_STUDIO_ANNUAL";

const priceEnvironmentKeys: Record<
  PaidPlanKey,
  Record<BillingInterval, PriceEnvironmentKey>
> = {
  creator: {
    monthly: "STRIPE_PRICE_CREATOR_MONTHLY",
    annual: "STRIPE_PRICE_CREATOR_ANNUAL",
  },
  studio: {
    monthly: "STRIPE_PRICE_STUDIO_MONTHLY",
    annual: "STRIPE_PRICE_STUDIO_ANNUAL",
  },
};

export function isPaidPlan(value: unknown): value is PaidPlanKey {
  return typeof value === "string" && PAID_PLAN_KEYS.includes(value as PaidPlanKey);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return (
    typeof value === "string" &&
    BILLING_INTERVALS.includes(value as BillingInterval)
  );
}

export function priceIdFor(plan: PaidPlanKey, interval: BillingInterval) {
  return process.env[priceEnvironmentKeys[plan][interval]] || null;
}

export function planForPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  for (const plan of PAID_PLAN_KEYS) {
    for (const interval of BILLING_INTERVALS) {
      if (priceIdFor(plan, interval) === priceId) return { plan, interval };
    }
  }
  return null;
}

export function stripeReadiness() {
  const missing = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    ...Object.values(priceEnvironmentKeys).flatMap((entry) =>
      Object.values(entry)
    ),
  ].filter((key) => !process.env[key]);

  return { configured: missing.length === 0, missing };
}
