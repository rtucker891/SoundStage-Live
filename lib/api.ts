import type { Recording } from "@/types/recording";
import type { Show } from "@/types/show";
import type {
  Episode,
  EpisodeStatus,
} from "@/types/episode";

export async function getShows(): Promise<Show[]> {
  const response = await fetch("/api/shows");

  if (!response.ok) {
    throw new Error("Failed to fetch shows");
  }

  return response.json();
}

export async function getEpisodes(): Promise<Episode[]> {
  const response = await fetch("/api/episodes");

  if (!response.ok) {
    throw new Error("Failed to fetch episodes");
  }

  return response.json();
}

export async function createShow(data: {
  title: string;
  description: string;
}) {
  const response = await fetch("/api/shows", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create show");
  }

  return response.json();
}

export async function createEpisode(data: {
  title: string;
  guest: string;
  show: string;
}) {
  const response = await fetch("/api/episodes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create episode");
  }

  return response.json();
}

export async function updateEpisodeStatus(
  id: string,
  status: EpisodeStatus
) {
  const response = await fetch("/api/episodes", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
      status,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to update episode status");
  }

  return response.json();
}

export async function updateEpisode(data: {
  id: string;
  title: string;
  guest: string;
  show: string;
  status: EpisodeStatus;
}) {
  const response = await fetch("/api/episodes", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update episode");
  }

  return response.json();
}

export async function getRecordings(): Promise<Recording[]> {
  const response = await fetch("/api/recordings");

  if (!response.ok) {
    throw new Error("Failed to fetch recordings");
  }

  return response.json();
}

export async function createRecording(data: {
  episodeId: string;
  name: string;
  duration: number;
  audioUrl: string;
}) {
  const response = await fetch("/api/recordings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create recording");
  }

  return response.json();
}