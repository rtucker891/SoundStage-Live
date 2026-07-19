import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable mocks: each test reconfigures the underlying pieces to exercise a
// specific branch of the guards. clientKey is inert (guards only pass its
// result to rateLimit, which we mock).
vi.mock("@/lib/teamServer", () => ({
  admin: vi.fn(),
  callerId: vi.fn(),
  roleOnShow: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  rateLimit: vi.fn(),
  clientKey: vi.fn(() => "key"),
}));

import { admin, callerId, roleOnShow } from "@/lib/teamServer";
import { rateLimit } from "@/lib/guard";
import {
  requireUser,
  requireShowRole,
  requireEpisodeRole,
} from "@/lib/apiAuth";

const mAdmin = vi.mocked(admin);
const mCallerId = vi.mocked(callerId);
const mRoleOnShow = vi.mocked(roleOnShow);
const mRateLimit = vi.mocked(rateLimit);

function req(): Request {
  return new Request("http://localhost/test", { method: "POST" });
}

// A minimal service-role db stub. `episode` configures what
// from("episodes").select().eq().maybeSingle() resolves to.
function dbStub(episode: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: episode }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible happy defaults; individual tests override as needed.
  mRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  mCallerId.mockResolvedValue("user-123");
  mRoleOnShow.mockResolvedValue("producer");
});

describe("requireUser", () => {
  it("returns 500 when admin() is not configured", async () => {
    mAdmin.mockReturnValue(null as never);
    const res = await requireUser(req(), "route");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(500);
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    mAdmin.mockReturnValue({} as never);
    mRateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 });
    const res = await requireUser(req(), "route");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(429);
      expect(res.response.headers.get("Retry-After")).toBe("42");
    }
  });

  it("returns 401 when the caller is anonymous", async () => {
    mAdmin.mockReturnValue({} as never);
    mCallerId.mockResolvedValue(null);
    const res = await requireUser(req(), "route");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
  });

  it("allows a signed-in caller and returns db + uid", async () => {
    const db = {};
    mAdmin.mockReturnValue(db as never);
    const res = await requireUser(req(), "route");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.uid).toBe("user-123");
      expect(res.db).toBe(db);
    }
  });
});

describe("requireShowRole", () => {
  it("propagates a 401 denial from requireUser (anon)", async () => {
    mAdmin.mockReturnValue({} as never);
    mCallerId.mockResolvedValue(null);
    const res = await requireShowRole(req(), "show-1", "route");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
  });

  it("returns 403 when the caller has no role on the show", async () => {
    mAdmin.mockReturnValue({} as never);
    mRoleOnShow.mockResolvedValue(null);
    const res = await requireShowRole(req(), "show-1", "route");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  it("allows a member of the show", async () => {
    mAdmin.mockReturnValue({} as never);
    const res = await requireShowRole(req(), "show-1", "route");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.uid).toBe("user-123");
  });
});

describe("requireEpisodeRole", () => {
  it("returns 404 when the episode does not exist", async () => {
    mAdmin.mockReturnValue(dbStub(null) as never);
    const res = await requireEpisodeRole(req(), "ep-1", "route");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(404);
  });

  it("returns 403 when the caller has no role on the episode's show", async () => {
    mAdmin.mockReturnValue(dbStub({ show_id: "show-1" }) as never);
    mRoleOnShow.mockResolvedValue(null);
    const res = await requireEpisodeRole(req(), "ep-1", "route");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  it("allows a member and returns the episode's show_id", async () => {
    mAdmin.mockReturnValue(dbStub({ show_id: "show-1" }) as never);
    const res = await requireEpisodeRole(req(), "ep-1", "route");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.showId).toBe("show-1");
  });
});
