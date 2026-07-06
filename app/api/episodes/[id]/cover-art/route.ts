import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PUBLIC_BUCKET = "soundstage-public";

type Props = {
  params: Promise<{ id: string }>;
};

function extFromType(type: string): string {
  if (type === "image/png") return ".png";
  if (type === "image/jpeg" || type === "image/jpg") return ".jpg";
  if (type === "image/webp") return ".webp";
  return "";
}

/**
 * Save an episode's cover art to the PUBLIC bucket and return a permanent URL.
 *
 * Two input shapes are supported so the same permanent-storage path is used for
 * BOTH sources of episode artwork:
 *
 *   1. AI-generated art. The browser sends JSON: { base64: "data:image/png;base64,..." }
 *      (or a bare base64 string). We decode it into a real PNG file.
 *   2. Manual uploads. The browser sends multipart FormData with a "file" field.
 *
 * In both cases the image is stored at published/episodes/{episodeId}/cover.{ext}
 * in the public bucket, and the permanent public URL is saved onto the episode
 * row (cover_art_url). Signed/expiring URLs are avoided because artwork must
 * stay reachable for public pages and podcast feeds.
 */
export async function POST(request: Request, { params }: Props) {
  try {
    const { id: episodeId } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error:
            "Server is missing Supabase credentials. Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in the Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    // Figure out which input shape we received and turn it into a raw buffer
    // plus a content type, so the rest of the route is source-agnostic.
    let buffer: Buffer;
    let contentType: string;

    const requestType = request.headers.get("content-type") || "";

    if (requestType.includes("application/json")) {
      const body = await request.json();
      const raw: string = body.base64 || "";

      if (!raw) {
        return NextResponse.json(
          { error: "No image data was provided." },
          { status: 400 }
        );
      }

      // Accept either a full data URL ("data:image/png;base64,AAAA...") or a
      // bare base64 string. Pull out the mime type when present.
      const match = raw.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
      const base64Data = match ? match[2] : raw;
      contentType = match ? match[1] : "image/png";
      buffer = Buffer.from(base64Data, "base64");
    } else {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "No image file was uploaded." },
          { status: 400 }
        );
      }

      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowed.includes(file.type)) {
        return NextResponse.json(
          { error: "Cover art must be a PNG, JPG, or WebP image." },
          { status: 400 }
        );
      }

      contentType = file.type;
      buffer = Buffer.from(await file.arrayBuffer());
    }

    // Reject obviously-wrong images (10 MB ceiling).
    const maxBytes = 10 * 1024 * 1024;
    if (buffer.byteLength > maxBytes) {
      return NextResponse.json(
        { error: "Image is too large. Please use a file under 10 MB." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Confirm the episode exists before writing anything.
    const { data: episode, error: epErr } = await admin
      .from("episodes")
      .select("id")
      .eq("id", episodeId)
      .single();

    if (epErr || !episode) {
      return NextResponse.json(
        { error: "Episode not found" },
        { status: 404 }
      );
    }

    const ext = extFromType(contentType) || ".png";
    const publicPath = `published/episodes/${episodeId}/cover${ext}`;

    const { error: upErr } = await admin.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, buffer, {
        contentType,
        upsert: true,
      });

    if (upErr) {
      return NextResponse.json(
        { error: `Could not upload cover art: ${upErr.message}` },
        { status: 500 }
      );
    }

    const { data: publicData } = admin.storage
      .from(PUBLIC_BUCKET)
      .getPublicUrl(publicPath);

    // Cache-bust so browsers and podcast apps pick up a replaced image.
    const permanentUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const { error: updErr } = await admin
      .from("episodes")
      .update({ cover_art_url: permanentUrl })
      .eq("id", episodeId);

    if (updErr) {
      return NextResponse.json(
        { error: `Could not save cover art URL: ${updErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url: permanentUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Cover art save failed: ${message}` },
      { status: 500 }
    );
  }
}
