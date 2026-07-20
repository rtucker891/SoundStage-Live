import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getPlan,
  isStudioPlan,
  showLimitFor,
  canCreateShow,
} from "../plan";

/**
 * A minimal fake of the Supabase query builder chain getPlan uses:
 *   db.from("subscriptions").select(...).eq(...).maybeSingle()
 * `result` is what maybeSingle() resolves to. If `throwOn` is set, the chain
 * throws to simulate the table not existing (pre-migration).
 */
function fakeDb(result: {
  data: { plan: string; status: string } | null;
  error: unknown;
}): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

function throwingDb(): SupabaseClient {
  return {
    from: () => {
      throw new Error("relation \"subscriptions\" does not exist");
    },
  } as unknown as SupabaseClient;
}

const USER = "11111111-1111-4111-8111-111111111111";

describe("isStudioPlan", () => {
  it("'studio' and 'studio_plus' unlock the premium pipeline", () => {
    expect(isStudioPlan("studio")).toBe(true);
    expect(isStudioPlan("studio_plus")).toBe(true);
    expect(isStudioPlan("creator")).toBe(false);
    expect(isStudioPlan("free")).toBe(false);
  });
});

describe("showLimitFor", () => {
  it("returns the numeric cap for limited tiers and null for unlimited", () => {
    expect(showLimitFor("free")).toBe(1);
    expect(showLimitFor("creator")).toBe(5);
    expect(showLimitFor("studio")).toBeNull();
    expect(showLimitFor("studio_plus")).toBeNull();
  });
});

describe("canCreateShow", () => {
  it("gates free at 1 show", () => {
    expect(canCreateShow("free", 0)).toBe(true);
    expect(canCreateShow("free", 1)).toBe(false);
  });

  it("gates creator at 5 shows", () => {
    expect(canCreateShow("creator", 4)).toBe(true);
    expect(canCreateShow("creator", 5)).toBe(false);
  });

  it("never blocks unlimited tiers", () => {
    expect(canCreateShow("studio", 999)).toBe(true);
    expect(canCreateShow("studio_plus", 999)).toBe(true);
  });
});

describe("getPlan", () => {
  const originalEnv = process.env.STUDIO_USER_IDS;
  beforeEach(() => {
    delete process.env.STUDIO_USER_IDS;
  });
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.STUDIO_USER_IDS;
    else process.env.STUDIO_USER_IDS = originalEnv;
  });

  it("returns the row's plan when the subscription is active", async () => {
    const db = fakeDb({ data: { plan: "studio", status: "active" }, error: null });
    expect(await getPlan(db, USER)).toBe("studio");
  });

  it("honors trialing as active", async () => {
    const db = fakeDb({ data: { plan: "creator", status: "trialing" }, error: null });
    expect(await getPlan(db, USER)).toBe("creator");
  });

  it("normalizes a 'studio_plus' subscription to 'studio_plus'", async () => {
    const db = fakeDb({ data: { plan: "studio_plus", status: "active" }, error: null });
    expect(await getPlan(db, USER)).toBe("studio_plus");
  });

  it("falls back to 'free' when the subscription is not active", async () => {
    const db = fakeDb({ data: { plan: "studio", status: "canceled" }, error: null });
    expect(await getPlan(db, USER)).toBe("free");
  });

  it("normalizes an unknown stored plan to 'free'", async () => {
    const db = fakeDb({ data: { plan: "enterprise", status: "active" }, error: null });
    expect(await getPlan(db, USER)).toBe("free");
  });

  it("returns 'free' when there is no subscription row", async () => {
    const db = fakeDb({ data: null, error: null });
    expect(await getPlan(db, USER)).toBe("free");
  });

  it("swallows a DB error (pre-migration) and returns 'free'", async () => {
    expect(await getPlan(throwingDb(), USER)).toBe("free");
  });

  it("applies the STUDIO_USER_IDS env override when no active sub", async () => {
    process.env.STUDIO_USER_IDS = `someone-else, ${USER}`;
    const db = fakeDb({ data: null, error: null });
    expect(await getPlan(db, USER)).toBe("studio");
  });

  it("prefers the active subscription over the env override", async () => {
    process.env.STUDIO_USER_IDS = USER;
    const db = fakeDb({ data: { plan: "creator", status: "active" }, error: null });
    expect(await getPlan(db, USER)).toBe("creator");
  });

  it("returns 'free' with a null db and no env override", async () => {
    expect(await getPlan(null, USER)).toBe("free");
  });
});
