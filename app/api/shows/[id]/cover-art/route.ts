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
 * Upload a show's cover art to the PUBLIC bucket and return a permanent URL.
 *
 * Podcast directories (Apple, Spotify) require artwork at a stable, public
 * address — signed/expiring URLs break. This route stores the image under
 * published/{showId}/cover.{ext} in the public bucket and saves the permanent
 * public URL onto the show row (published_cover_art_url).
 */
export async function POST(request: Request, { params }: Props) {
  try {
    const { id: showId } = await params;

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
        {
          error:
            "Cover art must be a PNG or JPG image. Apple recommends a square JPG or PNG between 1400x1400 and 3000x3000 pixels.",
        },
        { status: 400 }
      );
    }

    // Apple's max artwork file size is 512 KB–3 MB depending on source; keep a
    // generous 10 MB ceiling to reject obviously-wrong uploads.
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: "Image is too large. Please use a file under 10 MB." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Confirm the show exists.
    const { data: show, error: showErr } = await admin
      .from("shows")
      .select("id")
      .eq("id", showId)
      .single();

    if (showErr || !show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    const ext = extFromType(file.type) || ".png";
    const publicPath = `published/${showId}/cover${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, buffer, {
        contentType: file.type,
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

    // Cache-bust so podcast apps and browsers pick up a replaced image.
    const permanentUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const { error: updErr } = await admin
      .from("shows")
      .update({ published_cover_art_url: permanentUrl })
      .eq("id", showId);

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
      { error: `Cover art upload failed: ${message}` },
      { status: 500 }
    );
  }
}
