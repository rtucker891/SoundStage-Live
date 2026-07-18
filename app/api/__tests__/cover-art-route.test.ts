import { describe, it, expect, vi } from "vitest";

// A signed-in caller so requireUser passes (admin() truthy, callerId -> uid).
// The merged cover-art route must then reject a body that carries neither a
// prompt nor a title with a 400, BEFORE ever touching OpenAI.
vi.mock("@/lib/teamServer", () => ({
  admin: () => ({}),
  callerId: async () => "user-123",
  roleOnShow: async () => "producer",
}));

// If we reach the model call, the input validation failed — make that loud.
vi.mock("@/lib/openai/client", () => ({
  getOpenAI: () => {
    throw new Error("OpenAI should not be called when input validation fails");
  },
}));

import { POST as coverArtRoute } from "@/app/api/ai/cover-art/route";

function signedInRequest(body: unknown): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("cover-art route input validation", () => {
  it("returns 400 when neither prompt nor title is provided", async () => {
    const res = await coverArtRoute(signedInRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when prompt is an empty/whitespace string and no title", async () => {
    const res = await coverArtRoute(signedInRequest({ prompt: "   " }));
    expect(res.status).toBe(400);
  });
});
