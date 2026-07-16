import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-transcribe");
  if (!guard.ok) return guard.response;

  let file: FormDataEntryValue | null;
  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    // Malformed/absent multipart body — respond with JSON 400 instead of a
    // bare 500 so the client's parser always has JSON to work with.
    return NextResponse.json(
      { message: "Invalid form data" },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "No audio file uploaded" },
      { status: 400 }
    );
  }

  try {
    const transcription =
      await getOpenAI().audio.transcriptions.create({
        file,
        model: "gpt-4o-mini-transcribe",
      });

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (err) {
    // Never let this route return non-JSON: on any OpenAI/SDK failure, respond
    // with a JSON error so the client's parser always has JSON to work with.
    const message =
      err instanceof Error ? err.message : "Transcription failed.";
    return NextResponse.json({ message }, { status: 502 });
  }
}