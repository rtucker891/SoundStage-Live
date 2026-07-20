import { NextResponse } from "next/server";
import Stripe from "stripe";

import { admin, callerId } from "@/lib/teamServer";
import { getStripe, appUrl } from "@/lib/stripe/server";
import {
  priceIdFor,
  type PaidPlan,
  type BillingInterval,
} from "@/lib/stripe/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout { plan: 'creator'|'studio'|'studio_plus', interval: 'month'|'year' }
 *
 * Creates a Stripe Checkout Session (subscription mode) for the signed-in user
 * and returns { url } for the client to redirect to. Reuses the user's existing
 * Stripe customer if we've already created one, so a user never ends up with
 * duplicate customers across repeat checkouts.
 */
export async function POST(request: Request) {
  const db = admin();
  if (!db)
    return NextResponse.json(
      { error: "Server not configured." },
      { status: 500 }
    );

  const uid = await callerId(db, request);
  if (!uid)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const plan = body?.plan;
  const interval = body?.interval ?? "month";
  if (plan !== "creator" && plan !== "studio" && plan !== "studio_plus")
    return NextResponse.json(
      { error: "plan must be 'creator', 'studio', or 'studio_plus'." },
      { status: 400 }
    );
  if (interval !== "month" && interval !== "year")
    return NextResponse.json(
      { error: "interval must be 'month' or 'year'." },
      { status: 400 }
    );

  const priceId = priceIdFor(plan as PaidPlan, interval as BillingInterval);

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 500 }
    );
  }

  try {
    // Reuse an existing customer if we have one on the subscription row.
    const { data: existing } = await db
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", uid)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | undefined;

    // Verify a saved customer still exists in Stripe before reusing it. A stale
    // id (e.g. from a rotated key or a different account) would otherwise crash
    // checkout with "No such customer". If it's missing or deleted, discard it
    // and fall through to creating a fresh one; rethrow any unrelated error.
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if ("deleted" in customer && customer.deleted) customerId = undefined;
      } catch (err) {
        if (
          err instanceof Stripe.errors.StripeInvalidRequestError &&
          (err.code === "resource_missing" || err.statusCode === 404)
        ) {
          customerId = undefined;
        } else {
          throw err;
        }
      }
    }

    if (!customerId) {
      const { data: userData } = await db.auth.admin.getUserById(uid);
      const email = userData?.user?.email ?? undefined;
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: uid },
      });
      customerId = customer.id;

      // Persist the customer id immediately so a repeat checkout reuses it even
      // if the user abandons this session before the webhook fires.
      await db
        .from("subscriptions")
        .upsert(
          { user_id: uid, stripe_customer_id: customerId },
          { onConflict: "user_id" }
        );
    }

    const base = appUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: uid,
      subscription_data: { metadata: { user_id: uid } },
      metadata: { user_id: uid },
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
