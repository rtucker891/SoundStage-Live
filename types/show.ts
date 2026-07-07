export type ShowRole = "owner" | "producer" | "editor" | "host";

export type Show = {
  id: string;
  title: string;
  description: string;
  episodes: number;
  status: "Active" | "Draft" | "Archived";
  /** The current user's role on this show (Phase 8). Undefined for public/legacy reads. */
  myRole?: ShowRole;
};