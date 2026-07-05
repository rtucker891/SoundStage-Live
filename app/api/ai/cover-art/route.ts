import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai/client";

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const prompt =
      body.prompt ||
      "Professional podcast cover art";

    const image = await getOpenAI().images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${image.data?.[0]?.b64_json}`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to generate cover art",
      },
      {
        status: 500,
      }
    );
  }
}