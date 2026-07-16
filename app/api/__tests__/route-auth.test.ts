import { describe, it, expect, vi } from "vitest";

// The service-role + AI routes must never run their privileged work for an
// anonymous caller. We stub teamServer so the server client exists but no user
// can be resolved from the request (callerId -> null), which is exactly the
// "not signed in" case the guards in lib/apiAuth must reject with 401.
vi.mock("@/lib/teamServer", () => ({
  admin: () => ({}),
  callerId: async () => null,
  roleOnShow: async () => null,
}));

// Keep the OpenAI client inert — these tests must fail auth long before any
// model call, and we never want a real client constructed during a test run.
vi.mock("@/lib/openai/client", () => ({
  getOpenAI: () => {
    throw new Error("OpenAI should not be called for an unauthenticated request");
  },
}));

import { POST as publishRoute } from "@/app/api/episodes/[id]/publish/route";
import { POST as showNotesRoute } from "@/app/api/ai/show-notes/route";

function anonRequest(body: unknown = {}): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("service-role route auth", () => {
  it("returns 401 when publishing without a signed-in caller", async () => {
    const res = await publishRoute(anonRequest(), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("AI route auth", () => {
  it("returns 401 when calling show-notes without a signed-in caller", async () => {
    const res = await showNotesRoute(anonRequest({ transcript: "hello" }));
    expect(res.status).toBe(401);
  });
});
