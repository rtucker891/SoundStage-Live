import { supabase } from "@/lib/supabaseClient";
import type { ShowNote } from "@/types/show-note";
import type { Asset } from "@/types/asset";
import type { Show } from "@/types/show";
import type {
  Episode,
  EpisodeStatus,
} from "@/types/episode";
import type { Recording } from "@/types/recording";
import type { Transcript } from "@/types/transcript";

export async function getShows(): Promise<Show[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Phase 8: a user sees every show they are a MEMBER of (owner OR invited
  // team member), not just shows they created. We read their membership rows
  // (RLS returns only their own), then load those shows and tag each with the
  // user's role so the UI can show/hide controls.
  const { data: memberships, error: mErr } = await supabase
    .from("show_memberships")
    .select("show_id, role")
    .eq("user_id", user.id);

  if (mErr) throw new Error(mErr.message);

  const roleByShow = new Map<string, string>();
  for (const m of (memberships ?? []) as { show_id: string; role: string }[]) {
    roleByShow.set(m.show_id, m.role);
  }
  const showIds = Array.from(roleByShow.keys());
  if (showIds.length === 0) return [];

  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .in("id", showIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((show) => ({
    id: show.id,
    title: show.title,
    description: show.description || "",
    status: show.status || "Draft",
    episodes: 0,
    myRole: (roleByShow.get(show.id) as Show["myRole"]) ?? undefined,
  }));
}

/**
 * Soft-delete a show: sets deleted_at so it disappears from the app and
 * the public RSS feed, but the row (and its data) stays in the database.
 * Episodes belonging to the show are also soft-deleted so they vanish too.
 */
export async function deleteShow(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const now = new Date().toISOString();

  // Soft-delete the show's episodes first.
  const { error: epError } = await supabase
    .from("episodes")
    .update({ deleted_at: now })
    .eq("show_id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (epError) {
    throw new Error(epError.message);
  }

  // Soft-delete the show itself.
  const { error } = await supabase
    .from("shows")
    .update({ deleted_at: now })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  // Best-effort audit entry (fire-and-forget; never blocks the delete).
  void logAudit(id, "show.deleted");

  return { id };
}

/**
 * Soft-delete a single episode: sets deleted_at so it disappears from the
 * app and the public RSS feed, but the row stays in the database.
 */
export async function deleteEpisode(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { error } = await supabase
    .from("episodes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { id };
}

export async function createShow(data: {
  title: string;
  description: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: createdShow, error } = await supabase
    .from("shows")
    .insert({
      user_id: user.id,
      title: data.title,
      description: data.description,
      status: "Draft",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: createdShow.id,
    title: createdShow.title,
    description: createdShow.description || "",
    status: createdShow.status || "Draft",
    episodes: 0,
  };
}

  


// ---- Podcast (show) settings ----
// These map to the iTunes/RSS channel fields required for directory submission
// (Apple Podcasts, Spotify). Stored on the shows table.
export type PodcastSettings = {
  id: string;
  title: string;
  description: string;
  author: string;
  ownerName: string;
  ownerEmail: string;
  itunesCategory: string;
  itunesSubcategory: string;
  explicit: boolean;
  language: string;
  publishedCoverArtUrl: string;
};

/**
 * Load the podcast settings for a single show owned by the current user.
 * Returns null if the show doesn't exist or isn't owned by the user.
 */
export async function getShowSettings(
  id: string
): Promise<PodcastSettings | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("shows")
    .select(
      "id, title, description, author, owner_name, owner_email, itunes_category, itunes_subcategory, explicit, language, published_cover_art_url"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    // Not found / not owned — surface as null so the page can 404 gracefully.
    return null;
  }

  return {
    id: data.id,
    title: data.title || "",
    description: data.description || "",
    author: data.author || "",
    ownerName: data.owner_name || "",
    ownerEmail: data.owner_email || "",
    itunesCategory: data.itunes_category || "",
    itunesSubcategory: data.itunes_subcategory || "",
    explicit: Boolean(data.explicit),
    language: data.language || "en-us",
    publishedCoverArtUrl: data.published_cover_art_url || "",
  };
}

/**
 * Save the podcast settings for a show owned by the current user.
 * Only the podcast-metadata fields are updated (not title/description here).
 */
export async function updateShowSettings(
  id: string,
  settings: {
    author: string;
    ownerName: string;
    ownerEmail: string;
    itunesCategory: string;
    itunesSubcategory: string;
    explicit: boolean;
    language: string;
  }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("shows")
    .update({
      author: settings.author.trim() || null,
      owner_name: settings.ownerName.trim() || null,
      owner_email: settings.ownerEmail.trim() || null,
      itunes_category: settings.itunesCategory.trim() || null,
      itunes_subcategory: settings.itunesSubcategory.trim() || null,
      explicit: settings.explicit,
      language: settings.language.trim() || "en-us",
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getEpisodes(): Promise<Episode[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, guest, status, cover_art_url, shows(title)")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  type EpisodeRow = {
    id: string;
    title: string;
    guest: string | null;
    status: EpisodeStatus | null;
    cover_art_url: string | null;
    shows: { title?: string } | null;
  };

  return (data as EpisodeRow[]).map((episode) => ({
    id: episode.id,
    title: episode.title,
    guest: episode.guest || "Pending",
    status: episode.status || "Planning",
    show: episode.shows?.title || "Untitled Show",
    coverArtUrl: episode.cover_art_url || "",
  }));
}

// Load the saved AI chapter markers for one episode (#31). Returned as an
// ordered array of { startTime, title }. Empty if none have been generated.
export async function getEpisodeChapters(
  episodeId: string
): Promise<{ startTime: number; title: string }[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select("chapters")
    .eq("id", episodeId)
    .single();

  if (error || !data?.chapters || !Array.isArray(data.chapters)) {
    return [];
  }

  return data.chapters as { startTime: number; title: string }[];
}

// ---- Analytics (Phase 7) ----
// These read from the events table via SECURITY DEFINER Postgres functions.
// Each is scoped to the signed-in user, so a creator only sees their own data.

export type AnalyticsDailyRow = { day: string; type: string; count: number };
export type AnalyticsTopEpisode = {
  episodeId: string;
  title: string;
  listens: number;
};
export type AnalyticsTotal = { type: string; total: number; recent: number };

// Daily event counts by type over the last `days` days.
export async function getAnalyticsDaily(
  days = 30
): Promise<AnalyticsDailyRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Owner is derived server-side from auth.uid() inside the *_secure wrapper,
  // so we intentionally do NOT send an owner_id the client could spoof (#59).
  const { data, error } = await supabase.rpc("analytics_daily_secure", {
    days,
  });

  if (error || !data) return [];

  return (data as { day: string; type: string; count: number }[]).map((r) => ({
    day: r.day,
    type: r.type,
    count: Number(r.count),
  }));
}

// Top episodes by listens over the last `days` days.
export async function getAnalyticsTopEpisodes(
  days = 30,
  maxRows = 5
): Promise<AnalyticsTopEpisode[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("analytics_top_episodes_secure", {
    days,
    max_rows: maxRows,
  });

  if (error || !data) return [];

  return (
    data as { episode_id: string; title: string; listens: number }[]
  ).map((r) => ({
    episodeId: r.episode_id,
    title: r.title,
    listens: Number(r.listens),
  }));
}

// Lifetime + recent totals per event type (for KPI cards).
export async function getAnalyticsTotals(
  days = 30
): Promise<AnalyticsTotal[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("analytics_totals_secure", {
    days,
  });

  if (error || !data) return [];

  return (data as { type: string; total: number; recent: number }[]).map(
    (r) => ({
      type: r.type,
      total: Number(r.total),
      recent: Number(r.recent),
    })
  );
}




export async function createEpisode(data: {
  title: string;
  guest: string;
  show: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: matchingShow, error: showError } = await supabase
    .from("shows")
    .select("id")
    .eq("user_id", user.id)
    .eq("title", data.show)
    .single();

  if (showError || !matchingShow) {
    throw new Error("Matching show not found");
  }

  const { data: createdEpisode, error } = await supabase
    .from("episodes")
    .insert({
      user_id: user.id,
      show_id: matchingShow.id,
      title: data.title,
      guest: data.guest,
      status: "Planning",
    })
    .select("id, title, guest, status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: createdEpisode.id,
    title: createdEpisode.title,
    guest: createdEpisode.guest || "Pending",
    status: createdEpisode.status || "Planning",
    show: data.show,
  };
}
export async function updateEpisodeStatus(
  id: string,
  status: EpisodeStatus
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data, error } = await supabase
    .from("episodes")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, guest, status, show_id, shows(title)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Audit true publishes (status crossing into "Published").
  if (status === "Published" && data.show_id) {
    void logAudit(data.show_id as string, "episode.published", data.title);
  }

  return {
    id: data.id,
    title: data.title,
    guest: data.guest || "Pending",
    status: data.status || "Planning",
    show:
      (Array.isArray(data.shows) ? data.shows[0] : data.shows)?.title ||
      "Untitled Show",
  };
}

// Reverse of publishing: move an episode from "Published" back to
// "Ready to Publish" and clear the permanent published_* metadata so the
// public page / RSS feed no longer serve it. The copied files in the public
// bucket are left in place (harmless — they get overwritten on the next
// publish), so this stays a fast, single-row update scoped to the owner.
export async function unpublishEpisode(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data, error } = await supabase
    .from("episodes")
    .update({
      status: "Ready to Publish",
      published_audio_url: null,
      published_audio_size: null,
      published_audio_mime: null,
      published_audio_duration: null,
      published_artwork_url: null,
      published_at: null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, guest, status, show_id, shows(title)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (data.show_id) {
    void logAudit(data.show_id as string, "episode.unpublished", data.title);
  }

  return {
    id: data.id,
    title: data.title,
    guest: data.guest || "Pending",
    status: data.status || "Ready to Publish",
    show:
      (Array.isArray(data.shows) ? data.shows[0] : data.shows)?.title ||
      "Untitled Show",
  };
}


export async function updateEpisode(data: {
  id: string;
  title: string;
  guest: string;
  show: string;
  status: EpisodeStatus;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: matchingShow, error: showError } = await supabase
    .from("shows")
    .select("id")
    .eq("user_id", user.id)
    .eq("title", data.show)
    .single();

  if (showError || !matchingShow) {
    throw new Error("Matching show not found");
  }

  const { data: updatedEpisode, error } = await supabase
    .from("episodes")
    .update({
      title: data.title,
      guest: data.guest,
      status: data.status,
      show_id: matchingShow.id,
    })
    .eq("id", data.id)
    .eq("user_id", user.id)
    .select("id, title, guest, status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: updatedEpisode.id,
    title: updatedEpisode.title,
    guest: updatedEpisode.guest || "Pending",
    status: updatedEpisode.status || "Planning",
    show: data.show,
  };
}

/**
 * Update just an episode's title. Used by the Live-to-Published Studio review
 * screen so a creator can accept an AI-suggested title before publishing,
 * without touching guest/status/show. Scoped to the current user's own episode.
 */
export async function updateEpisodeTitle(id: string, title: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const clean = title.trim();
  if (!clean) throw new Error("Title cannot be empty.");

  const { data, error } = await supabase
    .from("episodes")
    .update({ title: clean })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { id: data.id, title: data.title };
}

export async function getRecordings(): Promise<Recording[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((recording) => ({
    id: recording.id,
    episodeId: recording.episode_id,
    name: recording.name,
    duration: recording.duration || 0,
    createdAt: recording.created_at,
    audioUrl: recording.audio_url,
  }));
}

export async function createRecording(data: {
  episodeId: string;
  name: string;
  duration: number;
  audioUrl: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: recording, error } = await supabase
    .from("recordings")
    .insert({
      user_id: user.id,
      episode_id: data.episodeId,
      name: data.name,
      duration: data.duration,
      audio_url: data.audioUrl,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: recording.id,
    episodeId: recording.episode_id,
    name: recording.name,
    duration: recording.duration || 0,
    createdAt: recording.created_at,
    audioUrl: recording.audio_url,
  };
}




export async function getTranscripts(): Promise<Transcript[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((transcript) => ({
    id: transcript.id,
    episodeId: transcript.episode_id,
    createdAt: transcript.created_at,
    segments: transcript.segments || [],
  }));
}
export async function createTranscript(data: {
  episodeId: string;
  segments: Transcript["segments"];
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: transcript, error } = await supabase
    .from("transcripts")
    .insert({
      user_id: user.id,
      episode_id: data.episodeId,
      segments: data.segments,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: transcript.id,
    episodeId: transcript.episode_id,
    createdAt: transcript.created_at,
    segments: transcript.segments || [],
  };
}

export async function updateTranscript(data: {
  id: string;
  segments: Transcript["segments"];
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: transcript, error } = await supabase
    .from("transcripts")
    .update({
      segments: data.segments,
    })
    .eq("id", data.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: transcript.id,
    episodeId: transcript.episode_id,
    createdAt: transcript.created_at,
    segments: transcript.segments || [],
  };
}
export async function getAssets(): Promise<Asset[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((asset) => ({
    id: asset.id,
    episodeId: asset.episode_id,
    name: asset.name,
    type: asset.type,
    fileName: asset.file_name,
    fileSize: asset.file_size,
    mimeType: asset.mime_type,
    createdAt: asset.created_at,
    url: asset.url,
  }));
}

export async function createAsset(data: {
  episodeId: string;
  name: string;
  type: Asset["type"];
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      episode_id: data.episodeId,
      name: data.name,
      type: data.type,
      file_name: data.fileName,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      url: data.url,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asset;
}

export async function deleteAsset(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Pull the storage path out of a Supabase URL for the private assets bucket.
 *
 * Signed URLs look like:
 *   .../storage/v1/object/sign/soundstage-assets/<user>/<folder>/<file>?token=...
 * Public URLs look like:
 *   .../storage/v1/object/public/soundstage-assets/<path>
 *
 * We return just the "<user>/<folder>/<file>" part (no query string), which is
 * what storage.remove() expects. Returns null if the URL isn't a soundstage
 * bucket URL (e.g. an external link), so callers can skip file deletion.
 */
function storagePathFromUrl(
  url: string,
  bucket: string
): string | null {
  if (!url) return null;

  const marker = `/${bucket}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  const afterBucket = url.slice(index + marker.length);

  // Strip any query string (the signed-URL token) and decode %20 etc.
  const withoutQuery = afterBucket.split("?")[0];

  return decodeURIComponent(withoutQuery);
}

/**
 * Best-effort delete of an audio file from the private assets bucket. Never
 * throws — if the file is already gone or the URL isn't ours, we just skip it,
 * because failing to remove a leftover file should not block deleting the row.
 */
export async function deleteStorageFile(url: string) {
  const path = storagePathFromUrl(url, "soundstage-assets");

  if (!path) return;

  try {
    await supabase.storage.from("soundstage-assets").remove([path]);
  } catch {
    // Non-fatal: the row deletion is what matters to the user.
  }
}

/**
 * Delete the recordings-table row(s) that point at a given audio URL for this
 * user. A recording is stored in TWO tables (assets + recordings), so deleting
 * only the asset would leave an orphan recording row behind.
 */
export async function deleteRecordingByUrl(audioUrl: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { error } = await supabase
    .from("recordings")
    .delete()
    .eq("user_id", user.id)
    .eq("audio_url", audioUrl);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Fully delete a recording asset: the storage file, the recordings row, and
 * the assets row. Use this instead of deleteAsset for type === "recording" so
 * nothing is left orphaned. Non-recording assets can keep using deleteAsset.
 */
export async function deleteRecordingAsset(asset: {
  id: string;
  url: string;
}) {
  // 1) Remove the underlying audio file (best effort).
  await deleteStorageFile(asset.url);

  // 2) Remove the matching recordings-table row(s).
  await deleteRecordingByUrl(asset.url);

  // 3) Remove the assets-table row.
  await deleteAsset(asset.id);

  return { success: true };
}

/**
 * Point an existing recording asset (and its recordings row) at a new audio
 * file, then delete the old file from storage. This is the "Replace audio"
 * action: the asset keeps its identity/slot but its audio is swapped.
 */
export async function replaceRecordingAudio(data: {
  assetId: string;
  oldUrl: string;
  newUrl: string;
  fileName: string;
  fileSize: number;
  duration: number;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  // Update the assets row to reference the new file.
  const { error: assetErr } = await supabase
    .from("assets")
    .update({
      url: data.newUrl,
      file_name: data.fileName,
      file_size: data.fileSize,
      mime_type: "audio/mpeg",
    })
    .eq("id", data.assetId)
    .eq("user_id", user.id);

  if (assetErr) {
    throw new Error(assetErr.message);
  }

  // Update any recordings row(s) that pointed at the old file.
  const { error: recErr } = await supabase
    .from("recordings")
    .update({
      audio_url: data.newUrl,
      duration: data.duration,
    })
    .eq("user_id", user.id)
    .eq("audio_url", data.oldUrl);

  if (recErr) {
    throw new Error(recErr.message);
  }

  // Finally remove the old file from storage (best effort).
  await deleteStorageFile(data.oldUrl);

  return { success: true };
}

export async function getShowNotes(): Promise<ShowNote[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("show_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((note) => ({
    id: note.id,
    episodeId: note.episode_id,
    title: note.title,
    summary: note.summary || "",
    bulletPoints: note.bullet_points || [],
    createdAt: note.created_at,
  }));
}


export async function createShowNote(data: {
  episodeId: string;
  title: string;
  summary: string;
  bulletPoints: string[];
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: note, error } = await supabase
    .from("show_notes")
    .insert({
      user_id: user.id,
      episode_id: data.episodeId,
      title: data.title,
      summary: data.summary,
      bullet_points: data.bulletPoints,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: note.id,
    episodeId: note.episode_id,
    title: note.title,
    summary: note.summary || "",
    bulletPoints: note.bullet_points || [],
    createdAt: note.created_at,
  };
}

/**
 * Update an existing show note's title, summary, and bullet points.
 * Used by the editor so creators can revise AI-generated notes before
 * publishing. Only the current user's own note can be updated.
 */
export async function updateShowNote(data: {
  id: string;
  title: string;
  summary: string;
  bulletPoints: string[];
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data: note, error } = await supabase
    .from("show_notes")
    .update({
      title: data.title,
      summary: data.summary,
      bullet_points: data.bulletPoints,
    })
    .eq("id", data.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: note.id,
    episodeId: note.episode_id,
    title: note.title,
    summary: note.summary || "",
    bulletPoints: note.bullet_points || [],
    createdAt: note.created_at,
  };
}

export async function updateEpisodeCoverArt(
  id: string,
  coverArtUrl: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data, error } = await supabase
    .from("episodes")
    .update({
      cover_art_url: coverArtUrl,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateShowCoverArt(
  id: string,
  coverArtUrl: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const { data, error } = await supabase
    .from("shows")
    .update({
      cover_art_url: coverArtUrl,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function uploadFileToStorage(
  file: File,
  folder: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in");
  }

  const filePath = `${user.id}/${folder}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from("soundstage-assets")
    .upload(filePath, file);

  if (error) {
    throw new Error(error.message);
  }

  const { data: signedUrlData, error: signedUrlError } =
    await supabase.storage
      .from("soundstage-assets")
      .createSignedUrl(data.path, 60 * 60);

  if (signedUrlError) {
    throw new Error(signedUrlError.message);
  }

  return {
    path: data.path,
    url: signedUrlData.signedUrl,
  };
}

// =====================================================================
// #33 Tags — free-form labels attached to shows and episodes.
// Tags are owner-scoped (each creator has their own set) and power the
// browse filters and public-page labels.
// =====================================================================

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

// Turn a human label into a URL/lookup-safe slug: "True Crime" -> "true-crime".
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// List the current creator's tags.
export async function getTags(): Promise<Tag[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Create a tag (or return the existing one with the same slug). Idempotent so
// callers can "ensure" a tag without worrying about duplicates.
export async function createTag(name: string): Promise<Tag> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const clean = name.trim();
  if (!clean) throw new Error("Tag name cannot be empty.");
  const slug = slugify(clean);

  // Try to find an existing tag first (unique per user_id+slug).
  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, slug")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: user.id, name: clean, slug })
    .select("id, name, slug")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw new Error(error.message);
}

// --- Tag <-> Show links ---

export async function getShowTags(showId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("show_tags")
    .select("tags(id, name, slug)")
    .eq("show_id", showId);
  if (error) throw new Error(error.message);
  // Supabase types embedded relations as arrays; the runtime value is a single
  // object. Cast through unknown to the shape we actually get back.
  const rows = (data ?? []) as unknown as { tags: Tag | null }[];
  return rows.map((row) => row.tags).filter((t): t is Tag => Boolean(t));
}

export async function setShowTags(
  showId: string,
  tagIds: string[]
): Promise<void> {
  // Replace the show's tags with the provided set: clear then insert.
  const { error: delErr } = await supabase
    .from("show_tags")
    .delete()
    .eq("show_id", showId);
  if (delErr) throw new Error(delErr.message);

  if (tagIds.length === 0) return;
  const rows = tagIds.map((tag_id) => ({ show_id: showId, tag_id }));
  const { error: insErr } = await supabase.from("show_tags").insert(rows);
  if (insErr) throw new Error(insErr.message);
}

// --- Tag <-> Episode links ---

export async function getEpisodeTags(episodeId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("episode_tags")
    .select("tags(id, name, slug)")
    .eq("episode_id", episodeId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as { tags: Tag | null }[];
  return rows.map((row) => row.tags).filter((t): t is Tag => Boolean(t));
}

export async function setEpisodeTags(
  episodeId: string,
  tagIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("episode_tags")
    .delete()
    .eq("episode_id", episodeId);
  if (delErr) throw new Error(delErr.message);

  if (tagIds.length === 0) return;
  const rows = tagIds.map((tag_id) => ({ episode_id: episodeId, tag_id }));
  const { error: insErr } = await supabase.from("episode_tags").insert(rows);
  if (insErr) throw new Error(insErr.message);
}

// =====================================================================
// #19 Guest profiles — real guest records with bio, photo, and links,
// linkable to episodes, each with a public profile page.
// =====================================================================

export type Guest = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
};

type GuestRow = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
};

function mapGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio,
    photoUrl: row.photo_url,
    websiteUrl: row.website_url,
    twitterUrl: row.twitter_url,
    linkedinUrl: row.linkedin_url,
  };
}

export async function getGuests(): Promise<Guest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as GuestRow[]).map(mapGuest);
}

export async function getGuest(guestId: string): Promise<Guest | null> {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapGuest(data as GuestRow) : null;
}

export type GuestInput = {
  name: string;
  bio?: string;
  photoUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
};

export async function createGuest(input: GuestInput): Promise<Guest> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const name = input.name.trim();
  if (!name) throw new Error("Guest name is required.");

  const { data, error } = await supabase
    .from("guests")
    .insert({
      user_id: user.id,
      name,
      slug: slugify(name) || crypto.randomUUID().slice(0, 8),
      bio: input.bio?.trim() || null,
      photo_url: input.photoUrl?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      twitter_url: input.twitterUrl?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapGuest(data as GuestRow);
}

export async function updateGuest(
  guestId: string,
  input: GuestInput
): Promise<void> {
  const { error } = await supabase
    .from("guests")
    .update({
      name: input.name.trim(),
      bio: input.bio?.trim() || null,
      photo_url: input.photoUrl?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      twitter_url: input.twitterUrl?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
    })
    .eq("id", guestId);
  if (error) throw new Error(error.message);
}

export async function deleteGuest(guestId: string): Promise<void> {
  // Soft-delete to match shows/episodes convention.
  const { error } = await supabase
    .from("guests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", guestId);
  if (error) throw new Error(error.message);
}

// --- Guest <-> Episode links ---

export async function getEpisodeGuests(episodeId: string): Promise<Guest[]> {
  const { data, error } = await supabase
    .from("episode_guests")
    .select("guests(*)")
    .eq("episode_id", episodeId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as { guests: GuestRow | null }[];
  return rows
    .map((row) => row.guests)
    .filter((g): g is GuestRow => Boolean(g))
    .map(mapGuest);
}

export async function setEpisodeGuests(
  episodeId: string,
  guestIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("episode_guests")
    .delete()
    .eq("episode_id", episodeId);
  if (delErr) throw new Error(delErr.message);

  if (guestIds.length === 0) return;
  const rows = guestIds.map((guest_id) => ({ episode_id: episodeId, guest_id }));
  const { error: insErr } = await supabase
    .from("episode_guests")
    .insert(rows);
  if (insErr) throw new Error(insErr.message);
}

// Episodes a guest has appeared in (published only — for the public profile).
export async function getGuestEpisodes(guestId: string): Promise<
  { id: string; title: string; showId: string; publishedAt: string | null }[]
> {
  const { data, error } = await supabase
    .from("episode_guests")
    .select("episodes(id, title, show_id, published_at, status, deleted_at)")
    .eq("guest_id", guestId);
  if (error) throw new Error(error.message);

  type EpRow = {
    id: string;
    title: string;
    show_id: string;
    published_at: string | null;
    status: string;
    deleted_at: string | null;
  };
  const rows = (data ?? []) as unknown as { episodes: EpRow | null }[];
  return rows
    .map((row) => row.episodes)
    .filter(
      (e): e is EpRow =>
        Boolean(e) && e!.status === "Published" && !e!.deleted_at
    )
    .map((e) => ({
      id: e.id,
      title: e.title,
      showId: e.show_id,
      publishedAt: e.published_at,
    }));
}

// =====================================================================
// #20 Guest invitation system — FOUNDATION.
// NOTE: Actually EMAILING the invite is deferred to Phase 9 (needs the
// transactional-email service, #41). Everything else is built: an invite
// record with a secure token, creation by the owner, and server-side
// acceptance by token. Until Phase 9, createGuestInvite returns a shareable
// link the creator can send manually. When email lands, call the email
// sender right after createGuestInvite — that is the only missing wire.
// =====================================================================

export type GuestInvite = {
  id: string;
  guestName: string;
  guestEmail: string;
  token: string;
  status: string;
  episodeId: string | null;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
};

type GuestInviteRow = {
  id: string;
  guest_name: string;
  guest_email: string;
  token: string;
  status: string;
  episode_id: string | null;
  message: string | null;
  created_at: string;
  responded_at: string | null;
};

function mapInvite(r: GuestInviteRow): GuestInvite {
  return {
    id: r.id,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    token: r.token,
    status: r.status,
    episodeId: r.episode_id,
    message: r.message,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
  };
}

// Generate a URL-safe random token for the invite link.
function makeInviteToken(): string {
  // 32 hex chars from two UUIDs — plenty of entropy, no special chars.
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  ).slice(0, 40);
}

export async function getGuestInvites(): Promise<GuestInvite[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("guest_invites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as GuestInviteRow[]).map(mapInvite);
}

export async function createGuestInvite(input: {
  guestName: string;
  guestEmail: string;
  episodeId?: string | null;
  message?: string;
}): Promise<{ invite: GuestInvite; acceptUrl: string; emailSent: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const guestName = input.guestName.trim();
  const guestEmail = input.guestEmail.trim();
  if (!guestName) throw new Error("Guest name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  const token = makeInviteToken();

  const { data, error } = await supabase
    .from("guest_invites")
    .insert({
      user_id: user.id,
      guest_name: guestName,
      guest_email: guestEmail,
      episode_id: input.episodeId || null,
      message: input.message?.trim() || null,
      token,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const acceptUrl = `${origin}/invite/${token}`;

  // Phase 9 (#20 close-the-loop): ask the server to email the guest. This is
  // best-effort — if email isn't configured yet (no RESEND_API_KEY) the server
  // safely no-ops and reports emailSent=false, so the UI falls back to
  // "copy this link and send it yourself." A failure here never blocks the
  // invite itself, which is already saved.
  let emailSent = false;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/invites/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        email?: { sent?: boolean };
      };
      emailSent = Boolean(json?.email?.sent);
    }
  } catch {
    // ignore — fall back to manual link sharing
  }

  return { invite: mapInvite(data as GuestInviteRow), acceptUrl, emailSent };
}

export async function cancelGuestInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from("guest_invites")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw new Error(error.message);
}

/* ============================================================
 * Notifications (#40) — the in-app notification center.
 * These run in the browser as the signed-in user; RLS ensures
 * each user only ever sees/updates their own notifications.
 * ============================================================ */

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Latest notifications for the signed-in user (newest first). */
export async function getNotifications(limit = 30): Promise<Notification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as NotificationRow[]).map(mapNotification);
}

/** How many unread notifications the signed-in user has (for the bell badge). */
export async function getUnreadNotificationCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Mark one notification as read. */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/** Mark every unread notification as read (for the signed-in user). */
export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/* ============================================================
 * Team memberships (#35-39, 46) — per-show teams.
 * Reading/removing members and changing roles go through a
 * server route because we need to resolve user emails (auth
 * admin) and enforce owner-protection rules server-side.
 * ============================================================ */

export type ShowMember = {
  id: string;
  userId: string;
  email: string | null;
  role: "owner" | "producer" | "editor" | "host";
  createdAt: string;
  isYou: boolean;
};

async function authedFetch(path: string, body: unknown) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

/** List all members of a show (with emails). Any member can view the roster. */
export async function getShowMembers(showId: string): Promise<ShowMember[]> {
  const json = await authedFetch("/api/team/list", { showId });
  return (json.members ?? []) as ShowMember[];
}

/** Add a member by email with a role. Owner/Producer only (enforced server-side). */
export async function addShowMember(
  showId: string,
  email: string,
  role: "producer" | "editor" | "host"
): Promise<{ added: boolean; email: string }> {
  const json = await authedFetch("/api/team/add", { showId, email, role });
  return { added: Boolean(json.added), email: json.email };
}

/** Change a member's role. Owner/Producer only. Cannot change the owner's role. */
export async function changeMemberRole(
  showId: string,
  userId: string,
  role: "producer" | "editor" | "host"
): Promise<void> {
  await authedFetch("/api/team/role", { showId, userId, role });
}

/** Remove a member. Owner/Producer only. Cannot remove the owner. */
export async function removeShowMember(
  showId: string,
  userId: string
): Promise<void> {
  await authedFetch("/api/team/remove", { showId, userId });
}

// =====================================================================
// Phase 11 — Data portability (#55 import, #56 export)
// =====================================================================

/** A lightweight preview of an external RSS feed before importing it (#55). */
export type ImportPreview = {
  title: string;
  description: string;
  author: string | null;
  imageUrl: string | null;
  language: string | null;
  explicit: boolean;
  itunesCategory: string | null;
  itunesSubcategory: string | null;
  episodeCount: number;
  episodesWithAudio: number;
  sampleTitles: string[];
};

/** Fetch + parse an external podcast RSS feed for review. Writes nothing. */
export async function previewImport(feedUrl: string): Promise<ImportPreview> {
  const json = await authedFetch("/api/import/preview", { feedUrl });
  return json.preview as ImportPreview;
}

export type ImportResult = {
  showId: string;
  showTitle: string;
  totalInFeed: number;
  imported: number;
  cappedAt: number | null;
  audioCopied: number;
  audioLinked: number;
};

/**
 * Import a show from an external RSS feed. Creates the show + episodes and
 * (when copyAudio is true) copies each episode's audio into our storage.
 */
export async function importFromRss(
  feedUrl: string,
  copyAudio: boolean
): Promise<ImportResult> {
  const json = await authedFetch("/api/import", { feedUrl, copyAudio });
  return json as ImportResult;
}

/**
 * Build the export URL for a show. We navigate the browser straight to this
 * authenticated endpoint so the browser downloads the JSON file (#56). The
 * access token is passed as a query param because a plain link can't set an
 * Authorization header.
 */
export async function getExportUrl(showId: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  return `/api/export/${showId}?token=${encodeURIComponent(token)}`;
}

// =====================================================================
// Phase 12 — Audit log (#58)
// =====================================================================

/**
 * Record an audit entry for a client-side action (best-effort; never throws).
 * The server verifies we belong to the show and stamps the real actor, so a
 * failed audit write must not block the action the user just performed.
 */
export async function logAudit(
  showId: string,
  action: "show.deleted" | "episode.published" | "episode.unpublished",
  target?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await authedFetch("/api/audit/record", { showId, action, target, metadata });
  } catch {
    // Best-effort only.
  }
}

export type AuditEntry = {
  id: string;
  action: string;
  actorEmail: string | null;
  target: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** Read a show's audit trail (newest first). Any member of the show may view. */
export async function getAuditLog(showId: string, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, actor_email, target, metadata, created_at")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    actorEmail: r.actor_email,
    target: r.target,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}
