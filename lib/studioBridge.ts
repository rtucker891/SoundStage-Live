import { NextResponse } from "next/server";

export const STUDIO_ASSET_BUCKET = "soundstage-assets";
export const MAX_STUDIO_AUDIO_BYTES = 500 * 1024 * 1024;

const AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
]);

export const studioCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function studioJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: studioCorsHeaders });
}

export function withStudioCors(response: NextResponse) {
  for (const [name, value] of Object.entries(studioCorsHeaders)) response.headers.set(name, value);
  return response;
}

export function studioOptions() {
  return new NextResponse(null, { status: 204, headers: studioCorsHeaders });
}

export function isSupportedStudioAudio(mimeType: unknown) {
  return typeof mimeType === "string" && AUDIO_MIME_TYPES.has(mimeType.toLowerCase());
}

export function sanitizeStudioFileName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return (name || "SoundStage Mix.wav").replace(/[^a-zA-Z0-9._ -]+/g, "-").slice(0, 140);
}

export function studioStoragePath(userId: string, fileName: string, id = crypto.randomUUID()) {
  return `${userId}/studio-imports/${id}-${sanitizeStudioFileName(fileName)}`;
}

export function isOwnedStudioStoragePath(path: unknown, userId: string) {
  return typeof path === "string" && path.startsWith(`${userId}/studio-imports/`) && !path.includes("..") && path.length <= 500;
}

export function storagePathFromUrl(value: unknown, bucket = STUDIO_ASSET_BUCKET) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    const markers = [`/storage/v1/object/sign/${bucket}/`, `/storage/v1/object/public/${bucket}/`];
    const marker = markers.find((candidate) => url.pathname.includes(candidate));
    if (!marker) return null;
    const encodedPath = url.pathname.split(marker)[1];
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

export function studioDeepLink(episodeId: string) {
  const url = new URL("soundstage://open");
  url.searchParams.set("import", episodeId);
  return url.toString();
}

export function soundStageAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://sound-stage-live.vercel.app").replace(/\/$/, "");
}
