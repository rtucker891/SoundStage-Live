import { requireUser } from "@/lib/apiAuth";
import { isUuid } from "@/lib/guard";
import { getPlan, isStudioPlan } from "@/lib/plan";
import { roleOnShow } from "@/lib/teamServer";
import {
  MAX_STUDIO_AUDIO_BYTES,
  STUDIO_ASSET_BUCKET,
  isSupportedStudioAudio,
  sanitizeStudioFileName,
  studioJson,
  studioOptions,
  studioStoragePath,
  withStudioCors,
} from "@/lib/studioBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return studioOptions();
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "studio-upload-ticket", 30, 60_000);
  if (!auth.ok) return withStudioCors(auth.response);
  if (!isStudioPlan(await getPlan(auth.db, auth.uid))) return studioJson({ error: "The Studio plan is required." }, 403);

  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const showId = body?.showId;
  const fileName = sanitizeStudioFileName(body?.fileName);
  const mimeType = body?.mimeType;
  const fileSize = Number(body?.fileSize);
  if (!isUuid(showId)) return studioJson({ error: "A valid showId is required." }, 400);
  if (!isSupportedStudioAudio(mimeType)) return studioJson({ error: "A supported audio file is required." }, 400);
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_STUDIO_AUDIO_BYTES) return studioJson({ error: "Audio must be between 1 byte and 500 MB." }, 400);

  const role = await roleOnShow(auth.db, showId, auth.uid);
  if (!role || role === "host") return studioJson({ error: "You do not have permission to add episodes to this show." }, 403);

  const path = studioStoragePath(auth.uid, fileName);
  const { data, error } = await auth.db.storage.from(STUDIO_ASSET_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return studioJson({ error: error?.message || "Could not prepare the audio upload." }, 500);

  return studioJson({ bucket: STUDIO_ASSET_BUCKET, path, storagePath: path, token: data.token, signedUrl: data.signedUrl });
}
