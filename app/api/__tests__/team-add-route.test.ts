import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "@/lib/plan";

// Mutable state driving the mocked auth + roles + owner lookup + collaborator
// count, so one set of mocks covers the seat-limit cases.
let mockUid: string | null = "caller-1";
let mockCallerRole: string | null = "owner";
let mockExistingRole: string | null = null; // invitee's current role (null = not a member)
let mockOwnerRow: { user_id: string } | null = { user_id: "owner-1" };
let mockCollabCount = 0;
// Plan resolved per user id — lets us prove the OWNER's plan gates, not the caller's.
let mockPlanByUser: Record<string, Plan> = { "owner-1": "free" };

vi.mock("@/lib/teamServer", () => ({
  admin: () => makeDb(),
  callerId: async () => mockUid,
  roleOnShow: async (_db: unknown, _showId: string, userId: string) =>
    userId === mockUid ? mockCallerRole : mockExistingRole,
  findUserIdByEmail: async () => "target-1",
  emailsFor: async () => ({}),
}));

vi.mock("@/lib/notify", () => ({ createNotification: async () => {} }));
vi.mock("@/lib/audit", () => ({ recordAudit: async () => {} }));

vi.mock("@/lib/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan")>();
  return { ...actual, getPlan: async (_db: unknown, uid: string) => mockPlanByUser[uid] ?? "free" };
});

// Fake Supabase builder covering the route's queries:
//  - owner lookup:  from("show_memberships").select("user_id").eq.eq.maybeSingle
//  - shows fallback/title: from("shows").select(...).eq.maybeSingle
//  - collaborator count: from("show_memberships").select("*",{head}).eq.neq  (awaited)
//  - insert: from("show_memberships").insert(...)  (awaited)
function makeDb() {
  return {
    from: (table: string) => {
      const state = { head: false, sel: "" };
      const chain: Record<string, unknown> = {
        select: (sel: string, opts?: { head?: boolean }) => {
          state.sel = sel;
          if (opts?.head) state.head = true;
          return chain;
        },
        insert: () => chain,
        eq: () => chain,
        neq: () => chain,
        maybeSingle: async () => {
          if (table === "show_memberships") return { data: mockOwnerRow, error: null };
          if (table === "shows" && state.sel === "user_id")
            return { data: mockOwnerRow, error: null };
          return { data: { title: "My Show" }, error: null };
        },
        then: (resolve: (v: unknown) => void) =>
          resolve(state.head ? { count: mockCollabCount, error: null } : { error: null }),
      };
      return chain;
    },
  };
}

import { POST } from "@/app/api/team/add/route";

const SHOW = "33333333-3333-4333-8333-333333333333";

function req(): Request {
  return new Request("http://localhost/api/team/add", {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({ showId: SHOW, email: "new@example.com", role: "editor" }),
  });
}

describe("POST /api/team/add — per-show seat limit", () => {
  beforeEach(() => {
    mockUid = "caller-1";
    mockCallerRole = "owner";
    mockExistingRole = null;
    mockOwnerRow = { user_id: "owner-1" };
    mockCollabCount = 0;
    mockPlanByUser = { "owner-1": "free" };
  });

  it("403s when a free owner's show is already at its 1-seat limit", async () => {
    mockPlanByUser = { "owner-1": "free" };
    mockCollabCount = 1;
    const res = await POST(req());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe(
      "This show has reached its team-member limit for the current plan."
    );
    expect(json.limit).toBe(1);
    expect(json.plan).toBe("free");
  });

  it("adds the member when a studio owner has room", async () => {
    mockPlanByUser = { "owner-1": "studio" };
    mockCollabCount = 5;
    const res = await POST(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ added: true, email: "new@example.com" });
  });

  it("keys the limit off the OWNER's plan, not the caller's", async () => {
    // Caller is a producer on a high tier, but the owner is free and at cap.
    mockUid = "caller-1";
    mockCallerRole = "producer";
    mockPlanByUser = { "caller-1": "studio_plus", "owner-1": "free" };
    mockCollabCount = 1;
    const res = await POST(req());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.plan).toBe("free");
    expect(json.limit).toBe(1);
  });
});
