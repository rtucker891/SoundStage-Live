import { createClient } from "@supabase/supabase-js";

const PRIVATE_BUCKET = "soundstage-assets";
const PUBLIC_BUCKET = "soundstage-public";

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

function pathFromSignedUrl(url: string, bucket: string): string | null {
  try {
    const marker = `/object/sign/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const afterBucket = url.slice(idx + marker.length);
    return decodeURIComponent(afterBucket.split("?")[0]);
  } catch {
    return null;
  }
}

/**
 * Make sure a show's cover art has a PERMANENT public URL, and return the best
 * URL to display right now.
 *
 * Background (plain English): a show's `cover_art_url` is a *signed* link into
 * the private storage bucket. Signed links self-destruct after about an hour,
 * so any public page or podcast/social preview that relied on it would go
 * blank. The permanent home for public artwork is the public bucket, saved on
 * the show as `published_cover_art_url`.
 *
 * This helper "self-heals" the first time a public page needs the art:
 *   - If a permanent URL already exists, just return it (no work).
 *   - Otherwise, if a private cover exists, copy the image into the public
 *     bucket, save the permanent URL on the show, and return it.
 *   - If anything fails, fall back to the private URL so the page still shows
 *     something (best-effort — never throw, never break the page).
 *
 * @param showId               the show's id
 * @param publishedCoverArtUrl current permanent URL (may be empty)
 * @param coverArtUrl          current private/signed URL (may be empty)
 * @returns the best available artwork URL (permanent if we could make one)
 */
export async function ensurePublicCover(
  showId: string,
  publishedCoverArtUrl?: string | null,
  coverArtUrl?: string | null
): Promise<string> {
  // Already permanent — nothing to do.
  if (publishedCoverArtUrl) return publishedCoverArtUrl;

  // No art at all.
  if (!coverArtUrl) return "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Without service credentials we can't copy; fall back to the private URL.
  if (!supabaseUrl || !serviceKey) return coverArtUrl;

  try {
    const privatePath = pathFromSignedUrl(coverArtUrl, PRIVATE_BUCKET);
    if (!privatePath) return coverArtUrl;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: blob, error: dlErr } = await admin.storage
      .from(PRIVATE_BUCKET)
      .download(privatePath);
    if (dlErr || !blob) return coverArtUrl;

    const ext = extFromPath(privatePath) || ".png";
    const publicPath = `published/${showId}/cover${ext}`;
    const buffer = Buffer.from(await blob.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, buffer, {
        contentType: mimeFromExt(ext),
        upsert: true,
      });
    if (upErr) return coverArtUrl;

    const { data: publicData } = admin.storage
      .from(PUBLIC_BUCKET)
      .getPublicUrl(publicPath);
    const permanentUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    // Save it so future loads skip all of the above.
    await admin
      .from("shows")
      .update({ published_cover_art_url: permanentUrl })
      .eq("id", showId);

    return permanentUrl;
  } catch {
    // Best effort: never break the public page over artwork.
    return coverArtUrl;
  }
}
