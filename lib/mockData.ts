import type { Show } from "@/types/show";
import type { Episode } from "@/types/episode";

export const shows: Show[] = [
  {
    id: "show-1",
    title: "SoundStage Live Demo",
    description: "Your flagship podcast and broadcast channel.",
    episodes: 4,
    status: "Active",
  },
  {
    id: "show-2",
    title: "Creator Conversations",
    description: "Interviews, guest episodes, and live discussions.",
    episodes: 0,
    status: "Draft",
  },
];

export const episodes: Episode[] = [
  {
    id: "episode-1",
    title: "Building Better Podcasts",
    show: "SoundStage Live Demo",
    status: "Draft",
    guest: "Pending",
  },
  {
    id: "episode-2",
    title: "Remote Recording Basics",
    show: "SoundStage Live Demo",
    status: "Planning",
    guest: "Accepted",
  },
  {
    id: "episode-3",
    title: "AI Audio Cleanup",
    show: "SoundStage Live Demo",
    status: "Editing",
    guest: "None",
  },
];