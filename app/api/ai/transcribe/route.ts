import { NextResponse } from "next/server";

import { openai } from "@/lib/openai/client";

export async function POST(request: Request) {
  const formData = await request.formData();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "No audio file uploaded" },
      { status: 400 }
    );
  }

  const transcription =
    await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });

  return NextResponse.json({
    text: transcription.text,
  });
}