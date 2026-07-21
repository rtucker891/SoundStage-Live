import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/teamServer", () => ({
  admin: () => ({}),
  callerId: async () => null,
  roleOnShow: async () => null,
}));

import { GET as accessStudio } from "@/app/api/access/studio/route";
import { GET as listStudioShows } from "@/app/api/shows/mine/route";
import { POST as createUploadTicket } from "@/app/api/episodes/from-studio/upload/route";
import { POST as finalizeStudioEpisode } from "@/app/api/episodes/from-studio/route";
import { GET as getStudioEpisodeAudio } from "@/app/api/episodes/[id]/audio/route";

const request = (method = "GET") => new Request("http://localhost/api/studio-test", {
  method,
  headers: method === "POST" ? { "content-type": "application/json" } : undefined,
  body: method === "POST" ? "{}" : undefined,
});

describe("Studio bridge authentication", () => {
  it("reports an expired or missing desktop session without exposing data", async () => {
    const response = await accessStudio(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ allowed: false, plan: null, reason: "not_signed_in" });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("rejects anonymous show listing and upload creation", async () => {
    const shows = await listStudioShows(request());
    const upload = await createUploadTicket(request("POST"));
    const finalize = await finalizeStudioEpisode(request("POST"));
    expect(shows.status).toBe(401);
    expect(upload.status).toBe(401);
    expect(finalize.status).toBe(401);
    expect(upload.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("rejects anonymous episode-audio imports", async () => {
    const response = await getStudioEpisodeAudio(request(), { params: Promise.resolve({ id: "episode-1" }) });
    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
