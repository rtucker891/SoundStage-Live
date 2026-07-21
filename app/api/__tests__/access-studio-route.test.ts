import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "@/lib/plan";

// Mutable state driving the mocked auth + plan lookup, so a single mock can
// simulate anonymous vs. each paid/free tier across tests.
let mockUid: string | null = "user-1";
let mockPlan: Plan = "free";

vi.mock("@/lib/teamServer", () => ({
  admin: () => ({}),
  callerId: async () => mockUid,
}));

vi.mock("@/lib/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan")>();
  return { ...actual, getPlan: async () => mockPlan };
});

import { GET, OPTIONS } from "@/app/api/access/studio/route";

const STUDIO_ORIGIN = "https://soundstage-studio.vercel.app";

function req(origin?: string): Request {
  return new Request("http://localhost/api/access/studio", {
    headers: origin ? { origin } : {},
  });
}

describe("GET /api/access/studio", () => {
  beforeEach(() => {
    mockUid = "user-1";
    mockPlan = "free";
  });

  it("returns allowed:false, reason not_signed_in for an anonymous caller (HTTP 200)", async () => {
    mockUid = null;
    const res = await GET(req(STUDIO_ORIGIN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      allowed: false,
      plan: null,
      reason: "not_signed_in",
    });
  });

  it("grants access for studio_plus", async () => {
    mockUid = "user-1";
    mockPlan = "studio_plus";
    const res = await GET(req(STUDIO_ORIGIN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: true, plan: "studio_plus" });
  });

  it("grants access for the Studio plan", async () => {
    mockPlan = "studio";
    const res = await GET(req(STUDIO_ORIGIN));
    expect(await res.json()).toEqual({ allowed: true, plan: "studio" });
  });

  it("denies free and creator", async () => {
    mockPlan = "free";
    expect(await (await GET(req())).json()).toEqual({
      allowed: false,
      plan: "free",
      reason: "Upgrade to the Studio plan to use the desktop editor.",
    });
    mockPlan = "creator";
    expect(await (await GET(req())).json()).toEqual({
      allowed: false,
      plan: "creator",
      reason: "Upgrade to the Studio plan to use the desktop editor.",
    });
  });

  it("allows the authenticated desktop client origin", async () => {
    mockPlan = "studio_plus";
    const res = await GET(req(STUDIO_ORIGIN));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("supports packaged desktop requests with a non-HTTP origin", async () => {
    const res = await GET(req("https://evil.example.com"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("OPTIONS /api/access/studio (preflight)", () => {
  it("returns 204 with CORS headers for an allowed origin", async () => {
    const res = await OPTIONS(req(STUDIO_ORIGIN));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, content-type"
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("returns the same packaged-app-safe CORS policy on preflight", async () => {
    const res = await OPTIONS(req("https://evil.example.com"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
