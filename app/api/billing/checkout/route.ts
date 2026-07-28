import { NextResponse } from "next/server";
import { admin, callerId } from "@/lib/teamServer";
import { clientKey, rateLimit } from "@/lib/guard";
import {
  isBillingInterval,
  isPaidPlan,
  priceIdFor,
  stripeReadiness,
} from "@/lib/stripe/config";
import { applicationUrl, stripe } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "billing-checkout"), 10, 60_000);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many checkout attempts." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );

  const readiness = stripeReadiness();
  if (!readiness.configured)
    return NextResponse.json(
      { error: "Payments are not configured yet.", code: "STRIPE_NOT_CONFIGURED" },
      { status: 503 }
    );

  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  const userId = await callerId(db, request);
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { plan, interval } = await request.json().catch(() => ({}));
  if (!isPaidPlan(plan) || !isBillingInterval(interval))
    return NextResponse.json({ error: "Invalid plan or billing interval." }, { status: 400 });

  const priceId = priceIdFor(plan, interval);
  if (!priceId) return NextResponse.json({ error: "Price is not configured." }, { status: 503 });

  const { data: existing } = await db
    .from("billing_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: userResult } = await db.auth.admin.getUserById(userId);
  const baseUrl = applicationUrl(request);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : { customer_email: userResult.user?.email }),
    client_reference_id: userId,
    allow_promotion_codes: true,
    success_url: `${baseUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing?billing=cancelled`,
    metadata: { soundstage_user_id: userId, soundstage_plan: plan },
    subscription_data: {
      metadata: { soundstage_user_id: userId, soundstage_plan: plan },
    },
  });

  return NextResponse.json({ url: session.url });
}
