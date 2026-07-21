import { requireUser } from "@/lib/apiAuth";
import { isUuid } from "@/lib/guard";
import { getPlan, isStudioPlan } from "@/lib/plan";
import { roleOnShow } from "@/lib/teamServer";
import {
  MAX_STUDIO_AUDIO_BYTES,
  STUDIO_ASSET_BUCKET,
  isOwnedStudioStoragePath,
  isSupportedStudioAudio,
  sanitizeStudioFileName,
  soundStageAppUrl,
  studioJson,
  studioOptions,
  withStudioCors,
} from "@/lib/studioBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return studioOptions();
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "studio-finalize", 30, 60_000);
  if (!auth.ok) return withStudioCors(auth.response);
  if (!isStudioPlan(await getPlan(auth.db, auth.uid))) return studioJson({ error: "The Studio plan is required." }, 403);

  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const showId = body?.showId;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";
  const storagePath = body?.storagePath;
  const fileName = sanitizeStudioFileName(body?.fileName);
  const mimeType = body?.mimeType;
  const requestedSize = Number(body?.fileSize);
  const durationSeconds = Math.max(0, Number(body?.durationSeconds) || 0);

  if (!isUuid(showId)) return studioJson({ error: "A valid showId is required." }, 400);
  if (!title) return studioJson({ error: "An episode title is required." }, 400);
  if (!isOwnedStudioStoragePath(storagePath, auth.uid)) return studioJson({ error: "The uploaded audio path is invalid." }, 400);
  if (!isSupportedStudioAudio(mimeType)) return studioJson({ error: "A supported audio file is required." }, 400);
  if (!Number.isFinite(requestedSize) || requestedSize <= 0 || requestedSize > MAX_STUDIO_AUDIO_BYTES) return studioJson({ error: "Audio must be between 1 byte and 500 MB." }, 400);

  const role = await roleOnShow(auth.db, showId, auth.uid);
  if (!role || role === "host") return studioJson({ error: "You do not have permission to add episodes to this show." }, 403);

  const path = storagePath as string;
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const objectName = path.slice(slash + 1);
  const { data: objects, error: listError } = await auth.db.storage.from(STUDIO_ASSET_BUCKET).list(folder, { search: objectName, limit: 10 });
  const object = objects?.find((candidate) => candidate.name === objectName);
  if (listError || !object) return studioJson({ error: "Upload the mix before creating the episode." }, 409);

  const objectSize = Number(object.metadata?.size) || requestedSize;
  if (objectSize > MAX_STUDIO_AUDIO_BYTES) return studioJson({ error: "The uploaded audio exceeds 500 MB." }, 400);

  let episodeId = "";
  try {
    const { data: episode, error: episodeError } = await auth.db
      .from("episodes")
      .insert({ user_id: auth.uid, show_id: showId, title, guest: "", status: "Editing" })
      .select("id, title")
      .single();
    if (episodeError || !episode) throw new Error(episodeError?.message || "Could not create the episode.");
    episodeId = episode.id;

    const { data: signed, error: signedError } = await auth.db.storage.from(STUDIO_ASSET_BUCKET).createSignedUrl(path, 60 * 60);
    if (signedError || !signed?.signedUrl) throw new Error(signedError?.message || "Could not open the uploaded audio.");

    const nowName = `Studio mix · ${title}`;
    const { error: recordingError } = await auth.db.from("recordings").insert({ user_id: auth.uid, episode_id: episodeId, name: nowName, duration: durationSeconds, audio_url: signed.signedUrl });
    if (recordingError) throw new Error(recordingError.message);

    const { error: assetError } = await auth.db.from("assets").insert({ user_id: auth.uid, episode_id: episodeId, name: nowName, type: "recording", file_name: fileName, file_size: objectSize, mime_type: mimeType, url: signed.signedUrl });
    if (assetError) throw new Error(assetError.message);

    return studioJson({ episodeId, episodeUrl: `${soundStageAppUrl()}/episodes/${episodeId}`, title: episode.title });
  } catch (error) {
    if (episodeId) {
      await auth.db.from("assets").delete().eq("episode_id", episodeId);
      await auth.db.from("recordings").delete().eq("episode_id", episodeId);
      await auth.db.from("episodes").delete().eq("id", episodeId);
    }
    await auth.db.storage.from(STUDIO_ASSET_BUCKET).remove([path]);
    return studioJson({ error: error instanceof Error ? error.message : "Could not create the episode." }, 500);
  }
}
