import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getOpenAI } from "@/lib/openai/client";

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    );

    const body = await request.json();

    const transcript = body.transcript;
    const episodeId = body.episodeId;
    const title = body.title || "AI Generated Show Notes";

    if (!transcript || !episodeId) {
      return NextResponse.json(
        { error: "Transcript and episodeId are required" },
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

    const { data, error } = await supabase
      .from("show_notes")
      .insert({
        episode_id: episodeId,
        title,
        summary: showNotesText,
        bullet_points: [],
      })
      .select()
      .single();

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: "Show notes generated but not saved" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      showNotes: showNotesText,
      savedNote: data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to generate show notes" },
      { status: 500 }
    );
  }
}