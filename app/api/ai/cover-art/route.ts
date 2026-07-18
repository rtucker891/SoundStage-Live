import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

/**
 * Canonical AI cover-art generator. Accepts EITHER shape in the JSON body:
 *   - { prompt }               — a freeform prompt (editor page), used directly.
 *   - { title, show, guest }   — structured fields (episode detail page), from
 *                                which we build a rich, styled prompt.
 * Returns the generated image as a base64 data URL under BOTH `imageUrl` and
 * `image` so either existing caller keeps working.
 */
export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-cover-art");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();

    const freeform =
      typeof body.prompt === "string" && body.prompt.trim()
        ? body.prompt.trim()
        : "";

    let prompt: string;
    if (freeform) {
      prompt = freeform;
    } else if (body.title) {
      prompt = `
Create a square podcast cover image for SoundStage Live.

Episode title: ${body.title}
Show: ${body.show || "SoundStage Live"}
Guest: ${body.guest || "No guest listed"}

Style:
Modern podcast cover art
Professional studio lighting
Bold visual design
No small unreadable text
No website screenshot
No UI elements
Square album-cover format
`;
    } else {
      return NextResponse.json(
        { error: "Provide a prompt, or an episode title." },
        { status: 400 }
      );
    }

    const result = await getOpenAI().images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image was generated" },
        { status: 500 }
      );
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`;

    return NextResponse.json({ imageUrl: dataUrl, image: dataUrl });
  } catch (error) {
    console.error("[ai/cover-art] generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate cover art" },
      { status: 500 }
    );
  }
}
