import { requireEpisodeRole } from "@/lib/apiAuth";
import { getPlan, isStudioPlan } from "@/lib/plan";
import {
  STUDIO_ASSET_BUCKET,
  storagePathFromUrl,
  studioJson,
  studioOptions,
  withStudioCors,
} from "@/lib/studioBridge";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return studioOptions();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireEpisodeRole(request, id, "studio-episode-audio");
  if (!auth.ok) return withStudioCors(auth.response);
  if (!isStudioPlan(await getPlan(auth.db, auth.uid))) return studioJson({ error: "The Studio plan is required." }, 403);

  const [{ data: episode }, { data: recording }, { data: asset }] = await Promise.all([
    auth.db.from("episodes").select("id, title, published_audio_url, published_audio_mime, published_audio_size, published_audio_duration").eq("id", id).maybeSingle(),
    auth.db.from("recordings").select("audio_url, duration, created_at").eq("episode_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    auth.db.from("assets").select("url, mime_type, file_size, created_at").eq("episode_id", id).eq("type", "recording").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!episode) return studioJson({ error: "Episode not found." }, 404);
  if (!episode.published_audio_url && !recording?.audio_url && !asset?.url) return studioJson({ error: "This episode has no audio to import." }, 409);

  const storedUrl = asset?.url || recording?.audio_url || episode.published_audio_url;
  const storagePath = storagePathFromUrl(storedUrl);
  let audioUrl = storedUrl as string;
  if (storagePath) {
    const { data, error } = await auth.db.storage.from(STUDIO_ASSET_BUCKET).createSignedUrl(storagePath, 15 * 60);
    if (error || !data?.signedUrl) return studioJson({ error: "Could not create a fresh audio link." }, 500);
    audioUrl = data.signedUrl;
  }

  return studioJson({
    episodeId: episode.id,
    title: episode.title,
    audioUrl,
    mime: asset?.mime_type || episode.published_audio_mime || null,
    size: Number(asset?.file_size || episode.published_audio_size) || 0,
    duration: Number(recording?.duration || episode.published_audio_duration) || 0,
  });
}
