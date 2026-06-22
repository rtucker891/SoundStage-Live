import type { Show } from "@/types/show";
import type { Episode } from "@/types/episode";

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