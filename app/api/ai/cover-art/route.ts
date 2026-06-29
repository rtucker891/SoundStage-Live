import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const prompt =
      body.prompt ||
      "Professional podcast cover art";

    const image = await openai.images.generate({
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