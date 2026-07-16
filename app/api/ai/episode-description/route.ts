import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-episode-description");
  if (!guard.ok) return guard.response;

  const body = await request.json();

  const content = body.content;

  const response = await getOpenAI().responses.create({
    model: "gpt-4.1-mini",
    input: `
You are a podcast publishing assistant.

Create a polished podcast episode description for Spotify, Apple Podcasts, YouTube, and RSS.

Make it:
- Clear
- Engaging
- Professional
- 1 to 2 paragraphs

Episode content:

${content}
`,
  });

  return NextResponse.json({
    description: response.output_text,
  });
}