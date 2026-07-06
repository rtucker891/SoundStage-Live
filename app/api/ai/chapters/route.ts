import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";

// #31 AI chapter markers.
//
// Reads the transcript (with per-segment timings) and groups the episode into
// a handful of chapters, each with a start time and a short title — like
// "0:00 Intro", "4:30 Guest backstory", "22:10 Q&A".
//
// Returns STRUCTURED JSON. These chapters are later embedded in the show's RSS
// feed (via the <podcast:chapters> namespace / per-episode chapter data) so
// podcast apps can show clickable chapter navigation.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Expect the transcript already formatted with timings, e.g.
    // "[12s] Alex: ...". This gives the model the timing context it needs to
    // place chapter start times.
    const transcript = body.transcript;

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    const response = await getOpenAI().responses.create({
      model: "gpt-4.1-mini",
      input: `
You are a podcast production assistant that divides an episode into chapters.

Using the timed transcript below, group the episode into 3 to 8 logical
chapters. Each chapter marks where a new topic or segment begins.

Respond with ONLY a JSON object in this exact shape, and nothing else:

{
  "chapters": [
    { "startTime": 0, "title": "Introduction" },
    { "startTime": 270, "title": "Guest backstory" }
  ]
}

Rules:
- "startTime" is the start of the chapter in WHOLE SECONDS, taken from the
  transcript timing markers.
- The first chapter must start at 0.
- Chapters must be in ascending time order with no duplicates.
- Titles are short (2-5 words), descriptive, and in Title Case.
- Do not wrap the JSON in markdown code fences.

Timed transcript:

${transcript}
`,
    });

    const raw = response.output_text || "";

    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let chapters: Array<{ startTime: number; title: string }> = [];

    try {
      const parsed = JSON.parse(cleaned);
      const list = Array.isArray(parsed?.chapters) ? parsed.chapters : [];

      // Normalize + sort defensively: coerce startTime to a number, drop
      // anything malformed, sort by time, and ensure the feed always has a
      // clean, ordered list to embed.
      chapters = list
        .map((c: { startTime?: unknown; title?: unknown }) => ({
          startTime: Number(c?.startTime) || 0,
          title: typeof c?.title === "string" ? c.title.trim() : "",
        }))
        .filter((c: { title: string }) => c.title.length > 0)
        .sort(
          (a: { startTime: number }, b: { startTime: number }) =>
            a.startTime - b.startTime
        );
    } catch {
      chapters = [];
    }

    return NextResponse.json({ chapters });
  } catch (error) {
    console.error("[ai/chapters] generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate chapters" },
      { status: 500 }
    );
  }
}
