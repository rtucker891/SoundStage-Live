import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "@/lib/plan";

// Mutable state driving the mocked auth + plan + show count, so one mock covers
// the "at cap" and "under cap" cases across tests.
let mockUid: string | null = "user-1";
let mockPlan: Plan = "free";
let mockCount = 0;

vi.mock("@/lib/teamServer", () => ({
  admin: () => makeDb(),
  callerId: async () => mockUid,
}));

vi.mock("@/lib/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan")>();
  return { ...actual, getPlan: async () => mockPlan };
});

// A tiny fake of the Supabase query builder the route uses:
//   count:  db.from("shows").select("id",{count,head}).eq(...).is(...)  -> { count }
//   insert: db.from("shows").insert(...).select().single()             -> { data }
function makeDb() {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    insert: () => chain,
    single: async () => ({
      data: {
        id: "show-123",
        title: "My Show",
        description: "desc",
        status: "Draft",
      },
      error: null,
    }),
    then: (resolve: (v: unknown) => void) =>
      resolve({ count: mockCount, error: null }),
  };
  return { from: () => chain };
}

import { POST } from "@/app/api/shows/route";

function req(body: unknown = { title: "My Show", description: "desc" }): Request {
  return new Request("http://localhost/api/shows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/shows — per-tier show limit", () => {
  beforeEach(() => {
    mockUid = "user-1";
    mockPlan = "free";
    mockCount = 0;
  });

  it("403s a free user already at their 1-show cap", async () => {
    mockPlan = "free";
    mockCount = 1;
    const res = await POST(req());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Show limit reached for your plan.");
    expect(json.limit).toBe(1);
    expect(json.plan).toBe("free");
  });

  it("creates the show for a free user under the cap", async () => {
    mockPlan = "free";
    mockCount = 0;
    const res = await POST(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      id: "show-123",
      title: "My Show",
      description: "desc",
      status: "Draft",
      episodes: 0,
    });
  });

  it("never blocks an unlimited (studio_plus) tier even with many shows", async () => {
    mockPlan = "studio_plus";
    mockCount = 999;
    const res = await POST(req());
    expect(res.status).toBe(200);
  });

  it("401s an anonymous caller", async () => {
    mockUid = null;
    const res = await POST(req());
    expect(res.status).toBe(401);
  });
});
