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

import { GET, OPTIONS, studioAccessAllowed } from "@/app/api/access/studio/route";

const STUDIO_ORIGIN = "https://soundstage-studio.vercel.app";

function req(origin?: string): Request {
  return new Request("http://localhost/api/access/studio", {
    headers: origin ? { origin } : {},
  });
}

describe("studioAccessAllowed", () => {
  it("is true only for studio_plus", () => {
    expect(studioAccessAllowed("studio_plus")).toBe(true);
    expect(studioAccessAllowed("studio")).toBe(false);
    expect(studioAccessAllowed("creator")).toBe(false);
    expect(studioAccessAllowed("free")).toBe(false);
  });
});

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

  it("DENIES plain studio (key case)", async () => {
    mockPlan = "studio";
    const res = await GET(req(STUDIO_ORIGIN));
    expect(await res.json()).toEqual({ allowed: false, plan: "studio" });
  });

  it("denies free and creator", async () => {
    mockPlan = "free";
    expect(await (await GET(req())).json()).toEqual({
      allowed: false,
      plan: "free",
    });
    mockPlan = "creator";
    expect(await (await GET(req())).json()).toEqual({
      allowed: false,
      plan: "creator",
    });
  });

  it("echoes the CORS origin for an allow-listed origin", async () => {
    mockPlan = "studio_plus";
    const res = await GET(req(STUDIO_ORIGIN));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(STUDIO_ORIGIN);
  });

  it("omits the CORS origin header for a non-allow-listed origin", async () => {
    const res = await GET(req("https://evil.example.com"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("OPTIONS /api/access/studio (preflight)", () => {
  it("returns 204 with CORS headers for an allowed origin", async () => {
    const res = await OPTIONS(req(STUDIO_ORIGIN));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(STUDIO_ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET,OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization,content-type"
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not echo a disallowed origin on preflight", async () => {
    const res = await OPTIONS(req("https://evil.example.com"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
