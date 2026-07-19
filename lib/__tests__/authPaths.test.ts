import { describe, it, expect, vi, beforeEach } from "vitest";

import { isProtectedPath, PROTECTED_PREFIXES } from "../authPaths";

// --- Mock the Supabase server client so the proxy handler's auth decision is
// driven entirely by the value we set here (no network, no cookies needed).
let mockUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
  }),
}));

import { proxy } from "../../proxy";
import { NextRequest } from "next/server";

function request(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`));
}

describe("isProtectedPath", () => {
  it("treats each protected prefix (exact match) as protected", () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(isProtectedPath(prefix)).toBe(true);
    }
  });

  it("treats sub-paths of a protected prefix as protected", () => {
    expect(isProtectedPath("/dashboard/overview")).toBe(true);
    expect(isProtectedPath("/settings/billing")).toBe(true);
    expect(isProtectedPath("/episodes/abc-123/studio")).toBe(true);
  });

  it("treats public paths as NOT protected", () => {
    for (const p of [
      "/",
      "/login",
      "/pricing",
      "/about",
      "/contact",
      "/browse",
      "/search",
      "/listen/xyz",
      "/rss",
    ]) {
      expect(isProtectedPath(p)).toBe(false);
    }
  });

  it("does not treat a prefix collision as protected", () => {
    // "/homepage" merely starts with "/home" as a string, but it is a distinct
    // path — it must NOT be protected.
    expect(isProtectedPath("/homepage")).toBe(false);
    expect(isProtectedPath("/studios-showcase")).toBe(false);
  });
});

describe("proxy() route guard", () => {
  beforeEach(() => {
    mockUser = null;
  });

  it("redirects an anonymous request to a protected path to /login, preserving next", async () => {
    mockUser = null;
    for (const path of ["/dashboard", "/settings", "/studio"]) {
      const res = await proxy(request(path));
      expect(res.status).toBe(307); // NextResponse.redirect default
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(path);
    }
  });

  it("preserves the original query string in the next param", async () => {
    mockUser = null;
    const res = await proxy(request("/episodes/42?tab=edit"));
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/episodes/42?tab=edit");
  });

  it("does NOT redirect an anonymous request to a public path", async () => {
    mockUser = null;
    for (const path of ["/", "/login", "/pricing", "/listen/xyz"]) {
      const res = await proxy(request(path));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("allows an authenticated request to a protected path through", async () => {
    mockUser = { id: "user-1" };
    const res = await proxy(request("/dashboard"));
    expect(res.headers.get("location")).toBeNull();
  });
});
