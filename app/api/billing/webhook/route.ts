import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { admin } from "@/lib/teamServer";
import { stripe } from "@/lib/stripe/client";
import {
  markSubscriptionDeleted,
  syncSubscription,
} from "@/lib/stripe/subscriptions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret)
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const { data: prior } = await db
    .from("billing_webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (prior) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(db, event.data.object);
        break;
      case "customer.subscription.deleted":
        await markSubscriptionDeleted(db, event.data.object);
        break;
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const subscription = await stripe().subscriptions.retrieve(
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
          );
          await syncSubscription(db, subscription);
        }
        break;
      }
      default:
        break;
    }

    const { error } = await db.from("billing_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (error) {
    console.error("Stripe webhook processing failed", event.id, error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
