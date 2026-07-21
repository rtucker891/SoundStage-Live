import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "@/lib/plan";

let mockUid: string | null = "user-1";
let mockPlan: Plan = "studio_plus";
let mockRole: string | null = "owner";

const SHOW_ID = "11111111-1111-4111-8111-111111111111";
const EP_ID = "22222222-2222-4222-8222-222222222222";
const STORAGE_PATH = "user-1/studio-imports/upload-mixdown.wav";
const SIGNED_URL = `https://ref.supabase.co/storage/v1/object/sign/soundstage-assets/${STORAGE_PATH}?token=abc`;

vi.mock("@/lib/teamServer", () => ({
  admin: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        insert: () => chain,
        select: () => chain,
        single: async () => ({ data: table === "episodes" ? { id: EP_ID, title: "My Mixdown" } : null, error: null }),
        delete: () => chain,
        eq: () => chain,
        then: (resolve: (value: unknown) => void) => resolve({ data: null, error: null }),
      };
      return chain;
    },
    storage: {
      from: () => ({
        list: async () => ({ data: [{ name: "upload-mixdown.wav", metadata: { size: 4 } }], error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: SIGNED_URL }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  }),
  callerId: async () => mockUid,
  roleOnShow: async () => mockRole,
}));

vi.mock("@/lib/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan")>();
  return { ...actual, getPlan: async () => mockPlan };
});

import { POST } from "@/app/api/episodes/from-studio/route";

function req(): Request {
  return new Request("http://localhost/api/episodes/from-studio", {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({
      showId: SHOW_ID,
      title: "My Mixdown",
      storagePath: STORAGE_PATH,
      fileName: "mixdown.wav",
      mimeType: "audio/wav",
      fileSize: 4,
      durationSeconds: 123,
    }),
  });
}

describe("POST /api/episodes/from-studio", () => {
  beforeEach(() => {
    mockUid = "user-1";
    mockPlan = "studio_plus";
    mockRole = "owner";
  });

  it("401s an anonymous caller", async () => {
    mockUid = null;
    expect((await POST(req())).status).toBe(401);
  });

  it("allows the Studio plan", async () => {
    mockPlan = "studio";
    expect((await POST(req())).status).toBe(200);
  });

  it("403s when the caller cannot edit the show", async () => {
    mockRole = null;
    expect((await POST(req())).status).toBe(403);
  });

  it("creates a draft episode after the direct upload", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      episodeId: EP_ID,
      episodeUrl: `https://sound-stage-live.vercel.app/episodes/${EP_ID}`,
      title: "My Mixdown",
    });
  });
});
