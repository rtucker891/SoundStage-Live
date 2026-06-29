export type EpisodeStatus =
  | "Draft"
  | "Planning"
  | "Recording"
  | "Editing"
  | "Ready to Publish"
  | "Published";

export type Episode = {
  id: string;
  title: string;
  show: string;
  status: EpisodeStatus;
  guest: string;
};