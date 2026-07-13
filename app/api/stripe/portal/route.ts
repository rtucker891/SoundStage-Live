import { NextResponse } from "next/server";

import { admin, callerId } from "@/lib/teamServer";
import { getStripe, appUrl } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Billing Portal session for the signed-in user so they can
 * manage or cancel their subscription, and returns { url } to redirect to.
 * If the user has never checked out (no Stripe customer yet), returns 400 with
 * a clear message so the UI can point them at /pricing instead.
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

  const { data: sub } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", uid)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id as string | undefined;
  if (!customerId)
    return NextResponse.json(
      { error: "No billing account yet. Choose a plan first." },
      { status: 400 }
    );

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
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
