import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "@/lib/plan";

// Mutable state driving the mocked auth + plan + shows list so one set of mocks
// covers every case (anon, wrong plan, success).
let mockUid: string | null = "user-1";
let mockPlan: Plan = "studio_plus";
let mockOwnedShows: Array<{ id: string; title: string }> = [];
let mockMemberShows: Array<{ id: string; title: string }> = [];
let mockMemberships: Array<{ show_id: string }> = [];

vi.mock("@/lib/teamServer", () => ({
  admin: () => ({
    from: (table: string) => {
      let memberLookup = false;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => { memberLookup = true; return chain },
        is: () => chain,
        order: async () => ({ data: memberLookup ? mockMemberShows : mockOwnedShows, error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: table === "show_memberships" ? mockMemberships : [], error: null }),
      };
      return chain;
    },
  }),
  callerId: async () => mockUid,
}));

vi.mock("@/lib/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan")>();
  return { ...actual, getPlan: async () => mockPlan };
});

import { GET } from "@/app/api/shows/mine/route";

function req(): Request {
  return new Request("http://localhost/api/shows/mine", {
    headers: { authorization: "Bearer token" },
  });
}

describe("GET /api/shows/mine", () => {
  beforeEach(() => {
    mockUid = "user-1";
    mockPlan = "studio_plus";
    mockOwnedShows = [
      { id: "show-1", title: "Alpha" },
    ];
    mockMemberShows = [
      { id: "show-2", title: "Beta" },
    ];
    mockMemberships = [{ show_id: "show-2" }];
  });

  it("401s an anonymous caller", async () => {
    mockUid = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("allows the Studio plan", async () => {
    mockPlan = "studio";
    const res = await GET(req());
    expect(res.status).toBe(200);
  });

  it("returns owned and collaborative shows without duplicates", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      shows: [
        { id: "show-1", title: "Alpha" },
        { id: "show-2", title: "Beta" },
      ],
    });
  });
});
