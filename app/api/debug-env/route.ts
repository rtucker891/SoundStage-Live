import { NextResponse } from "next/server";

// TEMPORARY diagnostic endpoint — remove after diagnosing the Stripe env issue.
// Reports the PRESENCE of Stripe-related env vars (never their values) so we can
// confirm what the live production runtime actually sees.

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Vars we inspect with a short prefix (safe: "sk_live_", "price_1T", "whsec_"…).
const CHECK_WITH_PREFIX = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_CREATOR_MONTH",
  "STRIPE_PRICE_CREATOR_YEAR",
  "STRIPE_PRICE_STUDIO_MONTH",
  "STRIPE_PRICE_STUDIO_YEAR",
] as const;

function describe(value: string | undefined) {
  return {
    present: typeof value === "string" && value.length > 0,
    length: value?.length ?? 0,
    prefix: value ? value.slice(0, 8) : null,
  };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const expected = process.env.ADMIN_MAINTENANCE_TOKEN;

  // Guard: require the shared secret. If the secret itself is missing from the
  // runtime, allow the call but flag it (that alone tells us the env is empty).
  const adminTokenMissing = !expected;
  if (!adminTokenMissing && token !== expected) {
    return new NextResponse("Not found", { status: 404 });
  }

  const vars: Record<string, ReturnType<typeof describe>> = {};
  for (const name of CHECK_WITH_PREFIX) {
    vars[name] = describe(process.env[name]);
  }

  // Presence + length only for the admin token (no prefix — it's the guard).
  const adminTokenValue = process.env.ADMIN_MAINTENANCE_TOKEN;
  const adminToken = {
    present: typeof adminTokenValue === "string" && adminTokenValue.length > 0,
    length: adminTokenValue?.length ?? 0,
  };

  // Every env var NAME (keys only) that looks Stripe/price related, so a
  // misnamed variable (e.g. "Stripe_Secret_Key1") shows up here.
  const matchingKeys = Object.keys(process.env)
    .filter((k) => /stripe/i.test(k) || /price/i.test(k))
    .sort();

  return NextResponse.json({
    note: adminTokenMissing
      ? "ADMIN_MAINTENANCE_TOKEN is NOT set in this runtime — auth was skipped."
      : "authorized",
    adminTokenMissing,
    vars,
    ADMIN_MAINTENANCE_TOKEN: adminToken,
    matchingEnvKeys: matchingKeys,
    deployment: {
      VERCEL_ENV: process.env.VERCEL_ENV ?? null,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
  });
}
