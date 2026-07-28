import { NextResponse } from "next/server";
import { admin, callerId } from "@/lib/teamServer";
import { applicationUrl, stripe } from "@/lib/stripe/client";
import { stripeReadiness } from "@/lib/stripe/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripeReadiness().configured)
    return NextResponse.json(
      { error: "Payments are not configured yet.", code: "STRIPE_NOT_CONFIGURED" },
      { status: 503 }
    );
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  const userId = await callerId(db, request);
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data } = await db
    .from("billing_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.stripe_customer_id)
    return NextResponse.json({ error: "No billing account found." }, { status: 404 });

  const session = await stripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${applicationUrl(request)}/settings`,
  });
  return NextResponse.json({ url: session.url });
}
