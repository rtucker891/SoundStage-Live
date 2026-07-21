import { describe, expect, it } from "vitest";

import { creatorNavigation, isCreatorNavItemActive } from "@/lib/navigation";

describe("creator navigation", () => {
  it("contains every destination in the unified product plan", () => {
    const labels = creatorNavigation.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toEqual([
      "Dashboard",
      "Shows",
      "Episodes",
      "Record / Edit",
      "Publish",
      "Analytics",
      "Team",
      "Settings / Billing",
    ]);
  });

  it("keeps nested creator tools under their primary navigation destination", () => {
    expect(isCreatorNavItemActive("/episodes/episode-1/editor", "/studio")).toBe(true);
    expect(isCreatorNavItemActive("/episodes/episode-1/edit", "/studio")).toBe(true);
    expect(isCreatorNavItemActive("/episodes/episode-1/live-studio", "/studio")).toBe(true);
    expect(isCreatorNavItemActive("/episodes/episode-1/publish", "/publish")).toBe(true);
    expect(isCreatorNavItemActive("/shows/show-1/team", "/team")).toBe(true);
    expect(isCreatorNavItemActive("/episodes/episode-1", "/studio")).toBe(false);
  });
});
