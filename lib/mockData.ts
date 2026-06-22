import type { Episode } from "@/types/episode";
import type { Show } from "@/types/show";

export const shows: Show[] = [
  {
    id: "show-1",
    title: "SoundStage Live Demo",
    description: "Learn how to create professional podcasts remotely.",
    status: "Active",
    episodes: 3,
  },
  {
    id: "show-2",
    title: "Creator Spotlight",
    description: "Interviews with creators, podcasters, and streamers.",
    status: "Active",
    episodes: 2,
  },
];

export const episodes: Episode[] = [
  {
    id: "episode-1",
    title: "Building Better Podcasts",
    show: "SoundStage Live Demo",
    status: "Planning",
    guest: "Sarah Johnson",
  },
  {
    id: "episode-2",
    title: "Remote Recording Basics",
    show: "SoundStage Live Demo",
    status: "Recording",
    guest: "Michael Lee",
  },
  {
    id: "episode-3",
    title: "AI Audio Cleanup",
    show: "SoundStage Live Demo",
    status: "Editing",
    guest: "Emily Carter",
  },
  {
    id: "episode-4",
    title: "Creator Growth Strategies",
    show: "Creator Spotlight",
    status: "Ready to Publish",
    guest: "James Wilson",
  },
  {
    id: "episode-5",
    title: "Monetizing Your Audience",
    show: "Creator Spotlight",
    status: "Published",
    guest: "Olivia Martinez",
  },
];