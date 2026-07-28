import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { planForPriceId } from "./config";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function syncSubscription(
  db: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id ?? null;
  const mapped = planForPriceId(priceId);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const userId = subscription.metadata.soundstage_user_id || null;

  const payload = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan: mapped?.plan ?? "free",
    billing_interval: mapped?.interval ?? null,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_end: firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("billing_subscriptions")
    .upsert(payload, { onConflict: "stripe_subscription_id" });
  if (error) throw error;
}

export async function markSubscriptionDeleted(
  db: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const { error } = await db
    .from("billing_subscriptions")
    .update({
      plan: "free",
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
  if (error) throw error;
}

export function hasPaidAccess(status: string | null | undefined) {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}
