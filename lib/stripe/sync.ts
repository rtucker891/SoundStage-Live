/**
 * lib/stripe/sync.ts — SERVER-ONLY: write Stripe subscription state into our
 * `subscriptions` table. Used by the webhook to keep each user's plan in sync.
 */
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { planForPriceId, intervalForPriceId } from "@/lib/stripe/prices";

/**
 * The current_period_end moved from the subscription to its items in recent API
 * versions. Read whichever is present so we stay correct across versions.
 */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const loose = sub as unknown as {
    current_period_end?: number;
    items?: { data?: { current_period_end?: number }[] };
  };
  const secs =
    loose.current_period_end ??
    loose.items?.data?.[0]?.current_period_end ??
    null;
  return secs ? new Date(secs * 1000).toISOString() : null;
}

/** Resolve our user id for a subscription: prefer metadata, else the existing row. */
async function resolveUserId(
  db: SupabaseClient,
  sub: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = sub.metadata?.user_id;
  if (fromMeta) return fromMeta;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  const { data } = await db
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/**
 * Upsert the user's subscription row from a Stripe Subscription object. Maps the
 * price ID back to a plan; a canceled/incomplete sub resolves to 'free'.
 */
export async function syncSubscription(
  db: SupabaseClient,
  sub: Stripe.Subscription
): Promise<void> {
  const userId = await resolveUserId(db, sub);
  if (!userId) return; // Nothing we can key on — ignore.

  // Manually managed accounts (comp/staff/owner) carry manual_override=true and
  // must NEVER be touched by Stripe — a stray/test event could otherwise knock
  // their plan down (e.g. studio_plus → free). Only humans/DB set this flag, so
  // we never write it here either.
  const { data: existing } = await db
    .from("subscriptions")
    .select("manual_override")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.manual_override === true) {
    console.log(`[stripe/sync] skipping manual_override account ${userId}`);
    return;
  }

  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const status = sub.status;
  const paid = status === "active" || status === "trialing";
  const plan = paid ? planForPriceId(priceId) : "free";
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  await db.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: sub.id,
      plan,
      status,
      price_id: priceId,
      interval: intervalForPriceId(priceId),
      current_period_end: periodEndIso(sub),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
