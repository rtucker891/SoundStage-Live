"use client";

import { useState } from "react";

type ShareButtonProps = {
  // The path or full URL to share (e.g. "/listen/abc" or an absolute URL).
  url: string;
  title: string;
  // Optional extra classes so each page can style the button to match.
  className?: string;
  label?: string;
};

// A small reusable "Share" button. On devices that support the native share
// sheet (most phones) it opens that; everywhere else it copies the link to the
// clipboard and briefly shows a "Copied!" confirmation.
export default function ShareButton({
  url,
  title,
  className = "",
  label = "Share",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Resolve to an absolute URL so the shared link works off-site.
    const absoluteUrl =
      url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;

    // Prefer the native share sheet when the browser supports it.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: absoluteUrl });
        return;
      } catch {
        // User dismissed the sheet, or share failed — fall through to copy.
      }
    }

    // Fallback: copy the link to the clipboard.
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (rare) — show the URL so the user can copy manually.
      window.prompt("Copy this link:", absoluteUrl);
    }
  }

  return (
    <button type="button" onClick={handleShare} className={className}>
      {copied ? "Copied!" : label}
    </button>
  );
}
