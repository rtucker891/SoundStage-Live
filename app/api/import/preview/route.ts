import { NextResponse } from "next/server";
import { admin, callerId } from "@/lib/teamServer";
import { fetchAndParseFeed } from "@/lib/rssImport";

export const dynamic = "force-dynamic";

/**
 * POST /api/import/preview  { feedUrl }
 *
 * Fetches and parses an external podcast RSS feed and returns a lightweight
 * PREVIEW — show title/description/artwork + episode count + the first few
 * episode titles. It writes NOTHING to the database, so the user can review
 * before committing the import.
 *
 * Requires a signed-in caller (any account) — this is a read-only network
 * fetch, so no per-show permission is involved yet.
 */
export async function POST(request: Request) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const uid = await callerId(db, request);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { feedUrl } = await request.json().catch(() => ({}));
  if (!feedUrl || typeof feedUrl !== "string") {
    return NextResponse.json({ error: "feedUrl required." }, { status: 400 });
  }

  try {
    const feed = await fetchAndParseFeed(feedUrl);
    const withAudio = feed.episodes.filter((e) => e.audioUrl).length;
    return NextResponse.json({
      preview: {
        title: feed.title,
        description: feed.description,
        author: feed.author,
        imageUrl: feed.imageUrl,
        language: feed.language,
        explicit: feed.explicit,
        itunesCategory: feed.itunesCategory,
        itunesSubcategory: feed.itunesSubcategory,
        episodeCount: feed.episodes.length,
        episodesWithAudio: withAudio,
        sampleTitles: feed.episodes.slice(0, 5).map((e) => e.title),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that feed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
