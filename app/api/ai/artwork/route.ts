import { NextResponse } from "next/server";

import { openai } from "@/lib/openai/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title = body.title;
    const show = body.show;
    const guest = body.guest;

    if (!title) {
      return NextResponse.json(
        { error: "Episode title is required" },
        { status: 400 }
      );
    }

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `
Create a square podcast cover image for SoundStage Live.

Episode title: ${title}
Show: ${show || "SoundStage Live"}
Guest: ${guest || "No guest listed"}

Style:
Modern podcast cover art
Professional studio lighting
Bold visual design
No small unreadable text
No website screenshot
No UI elements
Square album-cover format
`,
      size: "1024x1024",
    });

    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image was generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to generate artwork" },
      { status: 500 }
    );
  }
}