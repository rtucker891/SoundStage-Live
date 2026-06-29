import { NextResponse } from "next/server";

import { openai } from "@/lib/openai/client";

export async function POST(request: Request) {
  const body = await request.json();

  const content = body.content;

  const response = await openai.responses.create({
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