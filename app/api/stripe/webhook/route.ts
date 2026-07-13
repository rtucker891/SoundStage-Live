import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { admin } from "@/lib/teamServer";
import { getStripe } from "@/lib/stripe/server";
import { syncSubscription } from "@/lib/stripe/sync";

// MUST run on Node.js (not edge): signature verification needs the raw body and
// the Stripe SDK's crypto. Never let this route be statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook
 *
 * Stripe calls this on subscription lifecycle events. We verify the signature
 * against the RAW request body (read via req.text(), never JSON-parsed first),
 * then upsert the user's plan into the `subscriptions` table. We always return
 * 200 for handled/ignored events so Stripe doesn't retry needlessly; only a
 * signature/verification failure returns 4xx.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 500 }
    );

  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  // Raw body is required for signature verification.
  const rawBody = await request.text();

  let stripe: ReturnType<typeof getStripe>;
  let event: Stripe.Event;
  try {
    stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Signature verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const db = admin();
  if (!db)
    return NextResponse.json(
      { error: "Server not configured." },
      { status: 500 }
    );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          // Carry the user id through in case the sub lacks its own metadata.
          if (!sub.metadata?.user_id) {
            const uid =
              session.client_reference_id ?? session.metadata?.user_id;
            if (uid) sub.metadata = { ...sub.metadata, user_id: uid };
          }
          await syncSubscription(db, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(db, sub);
        break;
      }
      default:
        // Ignore unhandled event types.
        break;
    }
  } catch (err) {
    // Log and 500 so Stripe retries — the event was valid, our handling failed.
    console.error("[stripe/webhook] handler error:", err);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
