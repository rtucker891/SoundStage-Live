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

  


export async function getEpisodes(): Promise<Episode[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, guest, status, shows(title)")
    .eq("user_id", user.id)
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
  }));
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
    show: data.shows?.title || "Untitled Show",
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
  };
}
export async function uploadFileToStorage(file: File, folder: string) {
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