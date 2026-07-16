import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-publish-package");
  if (!guard.ok) return guard.response;

  const body = await request.json();

  const transcript = body.transcript;
  const showNotes = body.showNotes;

  const response = await getOpenAI().responses.create({
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