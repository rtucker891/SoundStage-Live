import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "@/lib/plan";

// Mutable state driving the mocked auth + plan + episode row so one set of mocks
// covers every case (anon, wrong plan, no audio, success).
let mockUid: string | null = "user-1";
let mockRole: string | null = "owner";
let mockPlan: Plan = "studio_plus";
let mockEpisode: Record<string, unknown> | null = null;

vi.mock("@/lib/teamServer", () => ({
  admin: () => ({
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: mockEpisode, error: null }),
      };
      return chain;
    },
  }),
  callerId: async () => mockUid,
  roleOnShow: async () => mockRole,
}));

vi.mock("@/lib/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan")>();
  return { ...actual, getPlan: async () => mockPlan };
});

import { GET } from "@/app/api/episodes/[id]/audio/route";

const EP_ID = "11111111-1111-4111-8111-111111111111";

function req(auth = true): Request {
  return new Request(`http://localhost/api/episodes/${EP_ID}/audio`, {
    headers: auth ? { authorization: "Bearer token" } : {},
  });
}

function call() {
  return GET(req(), { params: Promise.resolve({ id: EP_ID }) });
}

describe("GET /api/episodes/[id]/audio", () => {
  beforeEach(() => {
    mockUid = "user-1";
    mockRole = "owner";
    mockPlan = "studio_plus";
    mockEpisode = {
      id: EP_ID,
      title: "My Episode",
      show_id: "show-1",
      published_audio_url: "https://cdn.example.com/ep.mp3",
      published_audio_mime: "audio/mpeg",
      published_audio_size: 12345,
      published_audio_duration: 678,
    };
  });

  it("401s an anonymous caller", async () => {
    mockUid = null;
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("403s a non-studio_plus caller (even a plain studio owner)", async () => {
    mockPlan = "studio";
    const res = await call();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("SoundStage Studio requires the Studio Plus plan.");
    expect(json.plan).toBe("studio");
  });

  it("returns 200 with the audio payload for a studio_plus owner with published audio", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      episodeId: EP_ID,
      title: "My Episode",
      audioUrl: "https://cdn.example.com/ep.mp3",
      mime: "audio/mpeg",
      size: 12345,
      duration: 678,
    });
  });

  it("409s when the episode has no published audio yet", async () => {
    mockEpisode = {
      id: EP_ID,
      title: "My Episode",
      show_id: "show-1",
      published_audio_url: null,
    };
    const res = await call();
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe(
      "This episode has no finished audio to open in Studio yet."
    );
  });
});
