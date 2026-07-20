import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  priceIdFor,
  planForPriceId,
  intervalForPriceId,
  isActiveStatus,
} from "../stripe/prices";

// The documented test-mode price IDs (fallbacks used when no env override set).
const CREATOR_MONTH = "price_1Tsl5KHGpczA907HeuLzXKY7";
const CREATOR_YEAR = "price_1Tsl5KHGpczA907H3b6PEPLf";
const STUDIO_MONTH = "price_1Tsl5LHGpczA907H5bOxJPlt";
const STUDIO_YEAR = "price_1Tsl5LHGpczA907HTSU6MhgR";

describe("priceIdFor", () => {
  it("returns the documented default price IDs", () => {
    expect(priceIdFor("creator", "month")).toBe(CREATOR_MONTH);
    expect(priceIdFor("creator", "year")).toBe(CREATOR_YEAR);
    expect(priceIdFor("studio", "month")).toBe(STUDIO_MONTH);
    expect(priceIdFor("studio", "year")).toBe(STUDIO_YEAR);
  });

  describe("with an env override", () => {
    const original = process.env.STRIPE_PRICE_CREATOR_MONTH;
    beforeEach(() => {
      process.env.STRIPE_PRICE_CREATOR_MONTH = "price_env_override";
    });
    afterEach(() => {
      if (original === undefined) delete process.env.STRIPE_PRICE_CREATOR_MONTH;
      else process.env.STRIPE_PRICE_CREATOR_MONTH = original;
    });

    it("prefers the env override over the default", () => {
      expect(priceIdFor("creator", "month")).toBe("price_env_override");
    });

    it("still resolves the override back to its plan/interval", () => {
      expect(planForPriceId("price_env_override")).toBe("creator");
      expect(intervalForPriceId("price_env_override")).toBe("month");
    });
  });

  describe("studio_plus (env-driven, no test-mode default)", () => {
    const originalMonth = process.env.STRIPE_PRICE_STUDIO_PLUS_MONTH;
    const originalYear = process.env.STRIPE_PRICE_STUDIO_PLUS_YEAR;
    beforeEach(() => {
      process.env.STRIPE_PRICE_STUDIO_PLUS_MONTH = "price_sp_month_live";
      process.env.STRIPE_PRICE_STUDIO_PLUS_YEAR = "price_sp_year_live";
    });
    afterEach(() => {
      if (originalMonth === undefined)
        delete process.env.STRIPE_PRICE_STUDIO_PLUS_MONTH;
      else process.env.STRIPE_PRICE_STUDIO_PLUS_MONTH = originalMonth;
      if (originalYear === undefined)
        delete process.env.STRIPE_PRICE_STUDIO_PLUS_YEAR;
      else process.env.STRIPE_PRICE_STUDIO_PLUS_YEAR = originalYear;
    });

    it("reads STRIPE_PRICE_STUDIO_PLUS_MONTH / _YEAR", () => {
      expect(priceIdFor("studio_plus", "month")).toBe("price_sp_month_live");
      expect(priceIdFor("studio_plus", "year")).toBe("price_sp_year_live");
    });

    it("resolves a studio_plus price back to its plan and interval", () => {
      expect(planForPriceId("price_sp_month_live")).toBe("studio_plus");
      expect(intervalForPriceId("price_sp_year_live")).toBe("year");
    });
  });
});

describe("planForPriceId", () => {
  it("maps known price IDs to their plan", () => {
    expect(planForPriceId(CREATOR_MONTH)).toBe("creator");
    expect(planForPriceId(CREATOR_YEAR)).toBe("creator");
    expect(planForPriceId(STUDIO_MONTH)).toBe("studio");
    expect(planForPriceId(STUDIO_YEAR)).toBe("studio");
  });

  it("returns 'free' for unknown, null, or empty price IDs", () => {
    expect(planForPriceId("price_does_not_exist")).toBe("free");
    expect(planForPriceId(null)).toBe("free");
    expect(planForPriceId(undefined)).toBe("free");
    expect(planForPriceId("")).toBe("free");
  });
});

describe("intervalForPriceId", () => {
  it("maps known price IDs to their interval", () => {
    expect(intervalForPriceId(CREATOR_MONTH)).toBe("month");
    expect(intervalForPriceId(CREATOR_YEAR)).toBe("year");
    expect(intervalForPriceId(STUDIO_MONTH)).toBe("month");
    expect(intervalForPriceId(STUDIO_YEAR)).toBe("year");
  });

  it("returns null for unknown or missing price IDs", () => {
    expect(intervalForPriceId("nope")).toBeNull();
    expect(intervalForPriceId(null)).toBeNull();
  });
});

describe("isActiveStatus", () => {
  it("is true for active and trialing", () => {
    expect(isActiveStatus("active")).toBe(true);
    expect(isActiveStatus("trialing")).toBe(true);
  });

  it("is false for other statuses", () => {
    expect(isActiveStatus("canceled")).toBe(false);
    expect(isActiveStatus("past_due")).toBe(false);
    expect(isActiveStatus("incomplete")).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
    expect(isActiveStatus(undefined)).toBe(false);
  });
});
