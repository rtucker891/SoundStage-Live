import { NextResponse } from "next/server";

import { openai } from "@/lib/openai/client";

export async function POST(
  request: Request
) {
  const body = await request.json();

  const transcript = body.transcript;

  const response =
    await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
You are a podcast production assistant.

Create:

1. Episode Summary
2. Key Discussion Points
3. Main Takeaways

Transcript:

${transcript}
`,
    });

  return NextResponse.json({
    showNotes: response.output_text,
  });
}