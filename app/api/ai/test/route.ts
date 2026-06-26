import { NextResponse } from "next/server";

import { openai } from "@/lib/openai/client";

export async function GET() {
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: "Say SoundStage Live AI is connected.",
  });

  return NextResponse.json({
    message: response.output_text,
  });
}