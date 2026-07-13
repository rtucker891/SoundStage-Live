/**
 * lib/stripe/server.ts — SERVER-ONLY Stripe SDK client.
 *
 * The secret key comes exclusively from STRIPE_SECRET_KEY (never hardcoded).
 * getStripe() throws if it's missing so misconfiguration surfaces as a clean
 * 500 in the route rather than a confusing SDK error. The apiVersion is pinned
 * to the version bundled with the installed `stripe` package.
 */
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  if (!client) {
    client = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      appInfo: { name: "SoundStage Live" },
    });
  }
  return client;
}

/** Base URL for building checkout/portal redirect URLs. */
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://sound-stage-live.vercel.app"
  ).replace(/\/$/, "");
}
