import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "@/lib/plan";

// Mutable state driving the mocked auth + plan + show-ownership + insert results
// so one set of mocks covers every case (anon, wrong plan, foreign show, ok).
let mockUid: string | null = "user-1";
let mockPlan: Plan = "studio_plus";
let mockShow: { id: string } | null = { id: "show-1" };

const EP_ID = "22222222-2222-4222-8222-222222222222";
const SIGNED_URL =
  "https://ref.supabase.co/storage/v1/object/sign/soundstage-assets/studio-imports/user-1/" +
  EP_ID +
  "/mixdown.wav?token=abc";

vi.mock("@/lib/teamServer", () => ({
  admin: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        insert: () => chain,
        maybeSingle: async () => ({ data: mockShow, error: null }),
        single: async () => ({ data: { id: EP_ID }, error: null }),
        // recordings insert is awaited directly (no .select chain).
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: null, error: null }),
      };
      void table;
      return chain;
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: SIGNED_URL },
          error: null,
        }),
      }),
    },
  }),
  callerId: async () => mockUid,
}));

vi.mock("@/lib/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan")>();
  return { ...actual, getPlan: async () => mockPlan };
});

import { POST } from "@/app/api/episodes/from-studio/route";

function req(fields?: Partial<{ showId: string; title: string; audio: boolean }>): Request {
  const f = { showId: "show-1", title: "My Mixdown", audio: true, ...fields };
  const body = new FormData();
  if (f.showId) body.set("showId", f.showId);
  if (f.title) body.set("title", f.title);
  if (f.audio)
    body.set("audio", new File([new Uint8Array([1, 2, 3])], "mixdown.wav", { type: "audio/wav" }));
  body.set("durationSeconds", "123");
  return new Request("http://localhost/api/episodes/from-studio", {
    method: "POST",
    headers: { authorization: "Bearer token" },
    body,
  });
}

describe("POST /api/episodes/from-studio", () => {
  beforeEach(() => {
    mockUid = "user-1";
    mockPlan = "studio_plus";
    mockShow = { id: "show-1" };
  });

  it("401s an anonymous caller", async () => {
    mockUid = null;
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("403s a non-studio_plus caller", async () => {
    mockPlan = "studio";
    const res = await POST(req());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.plan).toBe("studio");
  });

  it("404s when the show is not owned by the caller", async () => {
    mockShow = null;
    const res = await POST(req());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Show not found or not yours.");
  });

  it("creates a draft episode + recording for a studio_plus owner", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      episodeId: EP_ID,
      showId: "show-1",
      title: "My Mixdown",
      status: "Planning",
      episodeUrl: `http://localhost/episodes/${EP_ID}`,
    });
  });
});
