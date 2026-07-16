import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

// AI episode-title generator (used by the Live-to-Published Studio pipeline).
//
// Given a transcript (and optional show notes), proposes a handful of strong,
// clickable episode title options the creator can pick from. Returns STRUCTURED
// JSON so the review UI can render each as a selectable choice.
export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-title-options");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();

    const transcript = body.transcript;
    const showNotes = body.showNotes;

    if (!transcript && !showNotes) {
      return NextResponse.json(
        { error: "A transcript or show notes are required" },
        { status: 400 }
      );
    }

    const response = await getOpenAI().responses.create({
      model: "gpt-4.1-mini",
      input: `
You are a podcast producer writing episode titles.

From the content below, propose 5 strong episode title options. Vary the angle:
some curiosity-driven, some benefit-driven, some featuring the guest or a key
quote. Keep them concise (ideally under 70 characters) and free of clickbait.

Respond with ONLY a JSON object in this exact shape, and nothing else:

{
  "titles": [
    "First title option",
    "Second title option"
  ]
}

Rules:
- Base the titles on the actual content below — do not invent facts.
- Do not number the titles or add quotes inside them.
- Do not wrap the JSON in markdown code fences.

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

    let titles: string[] = [];

    try {
      const parsed = JSON.parse(cleaned);
      const list = Array.isArray(parsed?.titles) ? parsed.titles : [];
      titles = list
        .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
        .filter((t: string) => t.length > 0);
    } catch {
      titles = [];
    }

    return NextResponse.json({ titles });
  } catch (error) {
    console.error("[ai/title-options] generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate title options" },
      { status: 500 }
    );
  }
}
