import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-show-notes");
  if (!guard.ok) return guard.response;

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
You are a podcast production assistant.

Create:

1. Episode Summary
2. Key Discussion Points
3. Main Takeaways

Transcript:

${transcript}
`,
    });

    const showNotesText = response.output_text || "";

    // This route only GENERATES the notes text. Saving happens on the client
    // via createShowNote(), which correctly stamps the note with the signed-in
    // user's id (this route uses the service-role key and has no user context,
    // so a save here would leave user_id null and the note would never show up
    // in the user's list). Keeping generation and saving separate also avoids
    // the double-save that happened before.
    return NextResponse.json({ showNotes: showNotesText });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to generate show notes" },
      { status: 500 }
    );
  }
}