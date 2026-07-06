import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";

// #27 AI highlight generator.
//
// Takes a transcript and asks the model to pick out the most shareable
// moments — the punchy quotes, surprising bits, and "clip this" moments.
//
// Unlike the show-notes route (which returns one blob of prose), this route
// asks the model to reply with STRUCTURED JSON: a list of highlights, each
// with a quote, a short reason it stands out, and an approximate timestamp.
// Structured output means the app can render each highlight as its own card
// and (later) jump the audio player to that moment.
export async function POST(request: Request) {
  try {
    const body = await request.json();

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
You are a podcast production assistant that finds the best shareable moments
in an episode.

From the transcript below, pick the 3 to 6 strongest highlight moments — the
memorable quotes, surprising statements, or emotionally resonant lines that a
creator would want to clip and promote.

Respond with ONLY a JSON object in this exact shape, and nothing else:

{
  "highlights": [
    {
      "quote": "the exact or lightly-trimmed quote from the transcript",
      "reason": "one short sentence on why this moment stands out",
      "timestamp": 123
    }
  ]
}

Rules:
- "timestamp" is the approximate start time in whole seconds, taken from the
  transcript timing when available. If you cannot tell, use 0.
- Keep each quote punchy — trim filler, but do not invent words.
- Order highlights from strongest to weakest.
- Do not wrap the JSON in markdown code fences.

Transcript:

${transcript}
`,
    });

    const raw = response.output_text || "";

    // The model was asked for pure JSON, but be defensive: strip any stray
    // markdown code fences before parsing so a wrapped response still works.
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let highlights: unknown = [];

    try {
      const parsed = JSON.parse(cleaned);
      highlights = Array.isArray(parsed?.highlights) ? parsed.highlights : [];
    } catch {
      // If parsing fails, return an empty list rather than crashing — the UI
      // will simply show "no highlights" instead of an error.
      highlights = [];
    }

    return NextResponse.json({ highlights });
  } catch (error) {
    console.error("[ai/highlights] generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate highlights" },
      { status: 500 }
    );
  }
}
