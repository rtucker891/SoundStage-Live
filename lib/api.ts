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

  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((show) => ({
    id: show.id,
    title: show.title,
    description: show.description || "",
    status: show.status || "Draft",
    episodes: 0,
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

  return data.map((episode: any) => ({
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

  const { data, error } = await supabase.rpc("analytics_daily", {
    owner_id: user.id,
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

  const { data, error } = await supabase.rpc("analytics_top_episodes", {
    owner_id: user.id,
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

  const { data, error } = await supabase.rpc("analytics_totals", {
    owner_id: user.id,
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
    .select("id, title, guest, status, shows(title)")
    .single();

  if (error) {
    throw new Error(error.message);
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
    .select("id, title, guest, status, shows(title)")
    .single();

  if (error) {
    throw new Error(error.message);
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
