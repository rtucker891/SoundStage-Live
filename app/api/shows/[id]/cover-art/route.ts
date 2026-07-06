import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PRIVATE_BUCKET = "soundstage-assets";
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

function extFromPath(path: string): string {
  const clean = path.split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot);
}

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  return "image/png";
}

/**
 * Extract the storage object path from a Supabase signed URL.
 * Signed URLs look like:
 *   https://<ref>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
 * We want just "<path>" (everything after the bucket segment, before "?").
 */
function pathFromSignedUrl(url: string, bucket: string): string | null {
  try {
    const marker = `/object/sign/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const afterBucket = url.slice(idx + marker.length);
    const path = afterBucket.split("?")[0];
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

/**
 * Upload/copy a show's cover art to the PUBLIC bucket and save a permanent URL
 * onto the show row (published_cover_art_url).
 *
 * Two modes:
 *  1) A file is included in the multipart form body → upload that new image.
 *  2) No file (plain POST / empty body) → copy the show's EXISTING cover art
 *     (stored as a signed/expiring private URL in cover_art_url) into the
 *     public bucket. This is what "publish" and backfill use, so creators
 *     never have to re-upload artwork they already have.
 *
 * Podcast directories (Apple, Spotify) and social preview images require
 * artwork at a stable, public address — signed/expiring URLs break after ~1h.
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

    const admin = createClient(supabaseUrl, serviceKey);

    // Confirm the show exists and grab its current (private) cover art URL.
    const { data: show, error: showErr } = await admin
      .from("shows")
      .select("id, cover_art_url")
      .eq("id", showId)
      .single();

    if (showErr || !show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    // Figure out whether this request carries a new file upload.
    let uploadedFile: File | null = null;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (file instanceof File) {
        uploadedFile = file;
      }
    }

    // ---- Resolve the image bytes + extension from one of the two modes ----
    let buffer: Buffer;
    let ext: string;
    let mime: string;

    if (uploadedFile) {
      // Mode 1: brand-new upload.
      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowed.includes(uploadedFile.type)) {
        return NextResponse.json(
          {
            error:
              "Cover art must be a PNG or JPG image. Apple recommends a square JPG or PNG between 1400x1400 and 3000x3000 pixels.",
          },
          { status: 400 }
        );
      }
      const maxBytes = 10 * 1024 * 1024;
      if (uploadedFile.size > maxBytes) {
        return NextResponse.json(
          { error: "Image is too large. Please use a file under 10 MB." },
          { status: 400 }
        );
      }
      buffer = Buffer.from(await uploadedFile.arrayBuffer());
      ext = extFromType(uploadedFile.type) || ".png";
      mime = mimeFromExt(ext);
    } else {
      // Mode 2: copy the show's existing private cover art into public.
      if (!show.cover_art_url) {
        return NextResponse.json(
          {
            error:
              "This show has no cover art to publish. Upload a cover image first.",
          },
          { status: 400 }
        );
      }
      const privatePath = pathFromSignedUrl(show.cover_art_url, PRIVATE_BUCKET);
      if (!privatePath) {
        return NextResponse.json(
          { error: "Could not resolve the existing cover art file path." },
          { status: 400 }
        );
      }
      const { data: blob, error: dlErr } = await admin.storage
        .from(PRIVATE_BUCKET)
        .download(privatePath);
      if (dlErr || !blob) {
        return NextResponse.json(
          {
            error: `Could not read existing cover art: ${dlErr?.message ?? "unknown"}`,
          },
          { status: 500 }
        );
      }
      buffer = Buffer.from(await blob.arrayBuffer());
      ext = extFromPath(privatePath) || ".png";
      mime = mimeFromExt(ext);
    }

    // ---- Upload to the public bucket at a stable path ----
    const publicPath = `published/${showId}/cover${ext}`;

    const { error: upErr } = await admin.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, buffer, {
        contentType: mime,
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
