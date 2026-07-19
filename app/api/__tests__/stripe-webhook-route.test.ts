import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Fake Stripe surface used by the webhook handler.
const constructEvent = vi.fn();
const subscriptionsRetrieve = vi.fn();
const fakeStripe = {
  webhooks: { constructEvent },
  subscriptions: { retrieve: subscriptionsRetrieve },
};

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => fakeStripe,
}));

vi.mock("@/lib/teamServer", () => ({
  admin: vi.fn(),
}));

vi.mock("@/lib/stripe/sync", () => ({
  syncSubscription: vi.fn(),
}));

import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { admin } from "@/lib/teamServer";
import { syncSubscription } from "@/lib/stripe/sync";

const mAdmin = vi.mocked(admin);
const mSync = vi.mocked(syncSubscription);

const ORIGINAL_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function webhookRequest(opts: { signature?: string; body?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.signature !== undefined) headers["stripe-signature"] = opts.signature;
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body: opts.body ?? "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  mAdmin.mockReturnValue({} as never);
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

describe("stripe webhook", () => {
  it("returns 500 when the webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(500);
    expect(mSync).not.toHaveBeenCalled();
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await webhook(webhookRequest());
    expect(res.status).toBe(400);
    expect(mSync).not.toHaveBeenCalled();
  });

  it("returns 400 when signature verification throws", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("bad signature");
    expect(mSync).not.toHaveBeenCalled();
  });

  it("returns 500 when admin() is not configured", async () => {
    mAdmin.mockReturnValue(null as never);
    constructEvent.mockReturnValue({ type: "invoice.paid", data: { object: {} } });
    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(500);
    expect(mSync).not.toHaveBeenCalled();
  });

  it("handles checkout.session.completed and carries user id into sub metadata", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          subscription: "sub_123",
          client_reference_id: "user-xyz",
        },
      },
    });
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_123", metadata: {} });

    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_123");
    expect(mSync).toHaveBeenCalledTimes(1);
    const [, subArg] = mSync.mock.calls[0];
    expect(subArg.metadata?.user_id).toBe("user-xyz");
  });

  it("handles customer.subscription.updated", async () => {
    const sub = { id: "sub_up", metadata: { user_id: "u1" } };
    constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: sub },
    });
    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(200);
    expect(mSync).toHaveBeenCalledTimes(1);
    expect(mSync.mock.calls[0][1]).toBe(sub);
  });

  it("handles customer.subscription.deleted", async () => {
    const sub = { id: "sub_del", metadata: { user_id: "u1" } };
    constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: sub },
    });
    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(200);
    expect(mSync).toHaveBeenCalledTimes(1);
    expect(mSync.mock.calls[0][1]).toBe(sub);
  });

  it("ignores unhandled event types with a 200 and no sync", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: {} },
    });
    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mSync).not.toHaveBeenCalled();
  });

  it("returns 500 when the handler throws on a valid event", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_x", metadata: { user_id: "u1" } } },
    });
    mSync.mockRejectedValue(new Error("db down"));
    const res = await webhook(webhookRequest({ signature: "sig" }));
    expect(res.status).toBe(500);
    expect(mSync).toHaveBeenCalledTimes(1);
  });
});
