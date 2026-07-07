import { describe, it, expect } from "vitest";
import { isUuid, isEmail, cleanString, isOneOf, rateLimit } from "../guard";

describe("isUuid", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUuid("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUuid("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("f47ac10b58cc4372a5670e02b2c3d479")).toBe(false); // no dashes
    expect(isUuid("f47ac10b-58cc-4372-a567-0e02b2c3d47")).toBe(false); // too short
  });

  it("rejects a bad version/variant nibble", () => {
    // version nibble '6' is out of the 1-5 range this regex allows
    expect(isUuid("f47ac10b-58cc-6372-a567-0e02b2c3d479")).toBe(false);
    // variant nibble 'c' is out of the 8/9/a/b range
    expect(isUuid("f47ac10b-58cc-4372-c567-0e02b2c3d479")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

describe("isEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isEmail("user@example.com")).toBe(true);
    expect(isEmail("first.last+tag@sub.domain.io")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isEmail("  user@example.com  ")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isEmail("no-at-sign")).toBe(false);
    expect(isEmail("missing@domain")).toBe(false); // no TLD dot
    expect(isEmail("a@b@c.com")).toBe(false);
    expect(isEmail("spaces in@example.com")).toBe(false);
  });

  it("rejects overly long addresses", () => {
    const long = "a".repeat(250) + "@x.io";
    expect(isEmail(long)).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isEmail(null)).toBe(false);
    expect(isEmail(42)).toBe(false);
  });
});

describe("cleanString", () => {
  it("trims and returns the value", () => {
    expect(cleanString("  hello  ")).toBe("hello");
  });

  it("returns null for empty/whitespace-only strings", () => {
    expect(cleanString("")).toBeNull();
    expect(cleanString("   ")).toBeNull();
  });

  it("enforces the max length after trimming", () => {
    expect(cleanString("abcdef", 3)).toBeNull();
    expect(cleanString("  abc  ", 3)).toBe("abc"); // length checked post-trim
  });

  it("uses a default max length of 2000", () => {
    expect(cleanString("x".repeat(2000))).toBe("x".repeat(2000));
    expect(cleanString("x".repeat(2001))).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(cleanString(undefined)).toBeNull();
    expect(cleanString(123)).toBeNull();
  });
});

describe("isOneOf", () => {
  const roles = ["producer", "editor", "host"] as const;

  it("accepts allowed values", () => {
    expect(isOneOf("editor", roles)).toBe(true);
  });

  it("rejects values outside the set", () => {
    expect(isOneOf("owner", roles)).toBe(false);
    expect(isOneOf("", roles)).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isOneOf(null, roles)).toBe(false);
    expect(isOneOf(1, roles)).toBe(false);
  });
});

describe("rateLimit", () => {
  it("allows requests up to the limit then blocks", () => {
    const key = `test-block-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    // b has its own fresh bucket
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("resets the window after it expires", () => {
    const key = `test-reset-${Math.random()}`;
    expect(rateLimit(key, 1, 1).ok).toBe(true); // 1ms window
    // Busy-wait past the tiny window without relying on fake timers.
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }
    expect(rateLimit(key, 1, 1).ok).toBe(true);
  });
});
