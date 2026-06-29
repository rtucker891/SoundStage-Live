import { NextResponse } from "next/server";

import { openai } from "@/lib/openai/client";

export async function POST(request: Request) {
  const body = await request.json();

  const transcript = body.transcript;
  const showNotes = body.showNotes;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: `
You are a podcast publishing assistant.

Create a complete publish package.

Return:

1. Episode Title
2. Episode Description
3. SEO Keywords
4. Social Media Post
5. YouTube Description

Transcript:
${transcript}

Show Notes:
${showNotes}
`,
  });

  return NextResponse.json({
    publishPackage: response.output_text,
  });
}