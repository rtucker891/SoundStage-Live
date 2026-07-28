import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function stripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  stripeClient ??= new Stripe(secretKey, { appInfo: { name: "SoundStage Live" } });
  return stripeClient;
}

export function applicationUrl(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}
