import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "@/lib/plan";

// Mutable state driving the mocked auth + plan + shows list so one set of mocks
// covers every case (anon, wrong plan, success).
let mockUid: string | null = "user-1";
let mockPlan: Plan = "studio_plus";
let mockShows: Array<{ id: string; title: string }> = [];

vi.mock("@/lib/teamServer", () => ({
  admin: () => ({
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: async () => ({ data: mockShows, error: null }),
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
    mockShows = [
      { id: "show-1", title: "Alpha" },
      { id: "show-2", title: "Beta" },
    ];
  });

  it("401s an anonymous caller", async () => {
    mockUid = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("403s a non-studio_plus caller", async () => {
    mockPlan = "studio";
    const res = await GET(req());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.plan).toBe("studio");
  });

  it("returns 200 with the caller's shows for a studio_plus caller", async () => {
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
