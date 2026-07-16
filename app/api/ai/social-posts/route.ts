import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

// #28 AI social post generator.
//
// Turns an episode into ready-to-post social captions, one tailored per
// platform (each platform has its own tone and length norms). Returns
// STRUCTURED JSON so the UI can render one copy-ready card per platform.
export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-social-posts");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();

    const transcript = body.transcript;
    const showNotes = body.showNotes;
    const episodeTitle = body.episodeTitle;

    if (!transcript && !showNotes) {
      return NextResponse.json(
        { error: "A transcript or show notes are required" },
        { status: 400 }
      );
    }

    const response = await getOpenAI().responses.create({
      model: "gpt-4.1-mini",
      input: `
You are a social media manager promoting a podcast episode.

Write one promotional post for each platform below, tuned to that platform's
tone, length, and conventions.

Respond with ONLY a JSON object in this exact shape, and nothing else:

{
  "posts": [
    { "platform": "X", "content": "..." },
    { "platform": "LinkedIn", "content": "..." },
    { "platform": "Instagram", "content": "..." }
  ]
}

Platform guidance:
- "X": under 280 characters, punchy, 1-2 relevant hashtags.
- "LinkedIn": professional and value-driven, 2-3 short paragraphs, a light
  call to action to listen.
- "Instagram": warm and conversational, a few tasteful emojis are fine, end
  with 3-5 hashtags on their own line.

Rules:
- Base the posts on the actual content below — do not invent facts.
- Do not wrap the JSON in markdown code fences.

Episode title: ${episodeTitle || "Untitled episode"}

Show notes:
${showNotes || "(none provided)"}

Transcript:
${transcript || "(none provided)"}
`,
    });

    const raw = response.output_text || "";

    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let posts: unknown = [];

    try {
      const parsed = JSON.parse(cleaned);
      posts = Array.isArray(parsed?.posts) ? parsed.posts : [];
    } catch {
      posts = [];
    }

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("[ai/social-posts] generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate social posts" },
      { status: 500 }
    );
  }
}
