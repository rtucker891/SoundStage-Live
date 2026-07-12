import { NextResponse } from "next/server";

import { admin, callerId, roleOnShow, emailsFor } from "@/lib/teamServer";
import { getPlan, isStudioPlan } from "@/lib/plan";
import { recordAudit } from "@/lib/audit";

// Reuse the EXISTING AI endpoints' logic by invoking their route handlers
// directly (no HTTP round-trip, no duplicated prompts). Each is a plain
// POST(request) function, so we hand it a synthesized Request and read the JSON.
import { POST as transcribeRoute } from "@/app/api/ai/transcribe/route";
import { POST as titleOptionsRoute } from "@/app/api/ai/title-options/route";
import { POST as showNotesRoute } from "@/app/api/ai/show-notes/route";
import { POST as chaptersRoute } from "@/app/api/ai/chapters/route";
import { POST as highlightsRoute } from "@/app/api/ai/highlights/route";
import { POST as socialPostsRoute } from "@/app/api/ai/social-posts/route";
import { POST as episodeDescriptionRoute } from "@/app/api/ai/episode-description/route";

// This pipeline runs several sequential OpenAI calls (transcription can be slow
// for long audio), so give it the same generous ceiling as the import route.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRIVATE_BUCKET = "soundstage-assets";

// --- small helpers (mirrors the publish route's signed-URL path parsing) ---

function pathFromSignedUrl(url: string, bucket: string): string | null {
  try {
    const marker = `/object/sign/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  } catch {
    return null;
  }
}

function extFromPath(path: string): string {
  const clean = path.split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot);
}

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".mp3") return "audio/mpeg";
  if (e === ".m4a" || e === ".aac") return "audio/x-m4a";
  if (e === ".ogg" || e === ".oga") return "audio/ogg";
  if (e === ".wav") return "audio/wav";
  if (e === ".webm") return "audio/webm";
  return "application/octet-stream";
}

/** Invoke a JSON route handler with a synthesized Request and return its body. */
async function callJsonRoute<T>(
  handler: (req: Request) => Promise<Response>,
  payload: unknown
): Promise<{ ok: boolean; data: T }> {
  const res = await handler(
    new Request("http://internal.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  const data = (await res.json()) as T;
  return { ok: res.ok, data };
}

type EpisodePackage = {
  ok: true;
  episodeId: string;
  recordingId: string | null;
  transcript: string | null;
  titleOptions: string[];
  showNotes: string | null;
  description: string | null;
  chapters: { startTime: number; title: string }[];
  highlights: { quote: string; reason: string; timestamp: number }[];
  socialPosts: { platform: string; content: string }[];
  audiogram: {
    // Best-effort inputs for the client-rendered waveform/social clip. Full
    // video render is a documented follow-up (see the feature summary).
    highlight: { quote: string; reason: string; timestamp: number } | null;
    caption: string | null;
  };
  // Per-step error flags — a failed step never fails the whole pipeline.
  errors: Record<string, string>;
};

/**
 * POST /api/ai/live-to-published  { episodeId, recordingId? }
 *
 * Orchestrates the existing AI endpoints into a single review-ready "episode
 * package". Studio-tier only. Best-effort: any step can fail and we still
 * return partial results with per-field error flags — we never 500 the pipeline
 * for a single failed step (only for auth/setup failures).
 */
export async function POST(request: Request) {
  const db = admin();
  if (!db)
    return NextResponse.json(
      { error: "Server not configured." },
      { status: 500 }
    );

  // 1) Authn/authz: signed-in caller with a role on the episode's show.
  const uid = await callerId(db, request);
  if (!uid)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const episodeId: unknown = body?.episodeId;
  const requestedRecordingId: unknown = body?.recordingId;
  if (typeof episodeId !== "string" || !episodeId)
    return NextResponse.json(
      { error: "episodeId is required." },
      { status: 400 }
    );

  const { data: episode } = await db
    .from("episodes")
    .select("id, title, show_id")
    .eq("id", episodeId)
    .maybeSingle();
  if (!episode)
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });

  const role = await roleOnShow(db, episode.show_id, uid);
  if (!role)
    return NextResponse.json(
      { error: "You don't have access to this episode." },
      { status: 403 }
    );

  // 2) Studio-tier gate (authoritative — the UI's lock state is only cosmetic).
  const plan = await getPlan(db, uid);
  if (!isStudioPlan(plan))
    return NextResponse.json(
      {
        error: "The AI Episode Studio is a Studio-tier feature.",
        upgrade: true,
        plan,
      },
      { status: 402 }
    );

  // 3) Locate the recording to process (explicit id, else latest for episode).
  let recordingQuery = db
    .from("recordings")
    .select("id, audio_url, duration, created_at")
    .eq("episode_id", episodeId);
  recordingQuery =
    typeof requestedRecordingId === "string" && requestedRecordingId
      ? recordingQuery.eq("id", requestedRecordingId)
      : recordingQuery.order("created_at", { ascending: false });
  const { data: recording } = await recordingQuery.limit(1).maybeSingle();

  if (!recording?.audio_url)
    return NextResponse.json(
      { error: "No recording found for this episode. Add audio first." },
      { status: 400 }
    );

  const pkg: EpisodePackage = {
    ok: true,
    episodeId,
    recordingId: recording.id,
    transcript: null,
    titleOptions: [],
    showNotes: null,
    description: null,
    chapters: [],
    highlights: [],
    socialPosts: [],
    audiogram: { highlight: null, caption: null },
    errors: {},
  };

  // 4) Transcribe. Everything downstream needs the transcript, so if this fails
  // we return early with the error flag set (still a 200 with partial package).
  try {
    const audioPath = pathFromSignedUrl(recording.audio_url, PRIVATE_BUCKET);
    if (!audioPath) throw new Error("Could not resolve the recording path.");

    const { data: audioBlob, error: dlErr } = await db.storage
      .from(PRIVATE_BUCKET)
      .download(audioPath);
    if (dlErr || !audioBlob)
      throw new Error(`Could not read audio: ${dlErr?.message ?? "unknown"}`);

    const ext = extFromPath(audioPath) || ".mp3";
    const file = new File([audioBlob], `audio${ext}`, {
      type: mimeFromExt(ext),
    });
    const fd = new FormData();
    fd.append("file", file);

    const res = await transcribeRoute(
      new Request("http://internal.local", { method: "POST", body: fd })
    );
    const data = (await res.json()) as { text?: string; message?: string };
    if (!res.ok || !data.text)
      throw new Error(data.message || "Transcription failed.");
    pkg.transcript = data.text;
  } catch (err) {
    pkg.errors.transcript =
      err instanceof Error ? err.message : "Transcription failed.";
    // No transcript → nothing else can run. Return the partial package.
    await auditGenerated(db, uid, episode, pkg);
    return NextResponse.json(pkg);
  }

  const transcript = pkg.transcript;

  // 5) Fan out the text-derived steps. show-notes first (title/social reuse it),
  // then the rest in parallel. Each step is best-effort and isolated.
  try {
    const { ok, data } = await callJsonRoute<{
      showNotes?: string;
      error?: string;
    }>(showNotesRoute, { transcript });
    if (!ok) throw new Error(data.error || "Show-notes generation failed.");
    pkg.showNotes = data.showNotes ?? null;
  } catch (err) {
    pkg.errors.showNotes =
      err instanceof Error ? err.message : "Show-notes generation failed.";
  }

  const results = await Promise.allSettled([
    callJsonRoute<{ titles?: string[]; error?: string }>(titleOptionsRoute, {
      transcript,
      showNotes: pkg.showNotes,
    }),
    callJsonRoute<{
      chapters?: { startTime: number; title: string }[];
      error?: string;
    }>(chaptersRoute, { transcript }),
    callJsonRoute<{
      highlights?: { quote: string; reason: string; timestamp: number }[];
      error?: string;
    }>(highlightsRoute, { transcript }),
    callJsonRoute<{
      posts?: { platform: string; content: string }[];
      error?: string;
    }>(socialPostsRoute, {
      transcript,
      showNotes: pkg.showNotes,
      episodeTitle: episode.title,
    }),
    callJsonRoute<{ description?: string; error?: string }>(
      episodeDescriptionRoute,
      { content: pkg.showNotes || transcript }
    ),
  ]);

  const [titleRes, chapterRes, highlightRes, socialRes, descriptionRes] =
    results;

  if (titleRes.status === "fulfilled" && titleRes.value.ok)
    pkg.titleOptions = titleRes.value.data.titles ?? [];
  else pkg.errors.titleOptions = "Title generation failed.";

  if (chapterRes.status === "fulfilled" && chapterRes.value.ok)
    pkg.chapters = chapterRes.value.data.chapters ?? [];
  else pkg.errors.chapters = "Chapter generation failed.";

  if (highlightRes.status === "fulfilled" && highlightRes.value.ok)
    pkg.highlights = highlightRes.value.data.highlights ?? [];
  else pkg.errors.highlights = "Highlight generation failed.";

  if (socialRes.status === "fulfilled" && socialRes.value.ok)
    pkg.socialPosts = socialRes.value.data.posts ?? [];
  else pkg.errors.socialPosts = "Social-post generation failed.";

  if (descriptionRes.status === "fulfilled" && descriptionRes.value.ok)
    pkg.description = descriptionRes.value.data.description ?? null;
  else pkg.errors.description = "Description generation failed.";

  // 6) Audiogram inputs: pick the strongest highlight for the clip snippet and
  // a caption from the social posts (prefer Instagram/X). The waveform image /
  // video is rendered client-side; full video export is a follow-up.
  pkg.audiogram.highlight = pkg.highlights[0] ?? null;
  const caption =
    pkg.socialPosts.find((p) => /instagram/i.test(p.platform))?.content ||
    pkg.socialPosts.find((p) => /(^|\b)x(\b|$)|twitter/i.test(p.platform))
      ?.content ||
    pkg.socialPosts[0]?.content ||
    null;
  pkg.audiogram.caption = caption;

  await auditGenerated(db, uid, episode, pkg);

  return NextResponse.json(pkg);
}

/** Append a best-effort audit entry recording that the AI package was generated. */
async function auditGenerated(
  db: ReturnType<typeof admin>,
  uid: string,
  episode: { show_id: string; title: string },
  pkg: EpisodePackage
) {
  try {
    const emails = await emailsFor(db!, [uid]);
    await recordAudit(
      {
        showId: episode.show_id,
        actorId: uid,
        actorEmail: emails[uid] ?? null,
        action: "episode.ai_generated",
        target: episode.title,
        metadata: {
          recordingId: pkg.recordingId,
          steps: {
            transcript: Boolean(pkg.transcript),
            titleOptions: pkg.titleOptions.length,
            showNotes: Boolean(pkg.showNotes),
            chapters: pkg.chapters.length,
            highlights: pkg.highlights.length,
            socialPosts: pkg.socialPosts.length,
          },
          errors: Object.keys(pkg.errors),
        },
      },
      db
    );
  } catch {
    // Auditing must never break the pipeline.
  }
}
