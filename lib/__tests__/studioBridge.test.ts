import { describe, expect, it } from "vitest";

import {
  isOwnedStudioStoragePath,
  isSupportedStudioAudio,
  sanitizeStudioFileName,
  storagePathFromUrl,
  studioDeepLink,
  studioStoragePath,
} from "@/lib/studioBridge";

describe("Studio bridge helpers", () => {
  it("builds an installed-app deep link for an episode", () => {
    expect(studioDeepLink("episode 1")).toBe("soundstage://open?import=episode+1");
  });

  it("keeps signed uploads inside the caller's Studio folder", () => {
    const path = studioStoragePath("user-1", "My / Mix.wav", "upload-1");
    expect(path).toBe("user-1/studio-imports/upload-1-My - Mix.wav");
    expect(isOwnedStudioStoragePath(path, "user-1")).toBe(true);
    expect(isOwnedStudioStoragePath("user-2/studio-imports/file.wav", "user-1")).toBe(false);
    expect(isOwnedStudioStoragePath("user-1/studio-imports/../file.wav", "user-1")).toBe(false);
  });

  it("recognizes supported audio and cleans unsafe filenames", () => {
    expect(isSupportedStudioAudio("audio/wav")).toBe(true);
    expect(isSupportedStudioAudio("text/html")).toBe(false);
    expect(sanitizeStudioFileName("mix<script>.wav")).toBe("mix-script-.wav");
  });

  it("recovers an object path from signed and public Supabase URLs", () => {
    expect(storagePathFromUrl("https://db.test/storage/v1/object/sign/soundstage-assets/user%2Fmix.wav?token=x")).toBe("user/mix.wav");
    expect(storagePathFromUrl("https://db.test/storage/v1/object/public/soundstage-assets/user/mix.wav")).toBe("user/mix.wav");
    expect(storagePathFromUrl("https://example.com/audio.wav")).toBeNull();
  });
});
