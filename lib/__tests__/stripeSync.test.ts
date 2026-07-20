import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { syncSubscription } from "../stripe/sync";

// The subscriptions row's manual_override that maybeSingle() resolves to.
let mockExisting: { manual_override: boolean } | null = null;
const upsertSpy = vi.fn(async (_payload: Record<string, unknown>, _opts?: unknown) => ({
  error: null,
}));

// Minimal fake of the Supabase builder syncSubscription uses:
//  - guard read: from("subscriptions").select("manual_override").eq(...).maybeSingle()
//  - write:      from("subscriptions").upsert(payload, { onConflict })
function fakeDb(): SupabaseClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: mockExisting, error: null }),
    upsert: upsertSpy,
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

// A subscription that resolves straight to a user via metadata (skips the
// customer-id lookup) and maps to a paid plan.
function fakeSub(): Stripe.Subscription {
  return {
    id: "sub_1",
    metadata: { user_id: "u1" },
    status: "active",
    customer: "cus_1",
    items: { data: [{ price: { id: "price_x" } }] },
  } as unknown as Stripe.Subscription;
}

describe("syncSubscription — manual_override protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExisting = null;
  });

  it("does NOT write when the row is manual_override=true", async () => {
    mockExisting = { manual_override: true };
    await syncSubscription(fakeDb(), fakeSub());
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("upserts normally when there is no existing row", async () => {
    mockExisting = null;
    await syncSubscription(fakeDb(), fakeSub());
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it("upserts normally when manual_override=false", async () => {
    mockExisting = { manual_override: false };
    await syncSubscription(fakeDb(), fakeSub());
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it("never includes manual_override in the upsert payload", async () => {
    mockExisting = { manual_override: false };
    await syncSubscription(fakeDb(), fakeSub());
    const [payload] = upsertSpy.mock.calls[0];
    expect(payload).not.toHaveProperty("manual_override");
    expect(payload).toMatchObject({ user_id: "u1", status: "active" });
  });
});
