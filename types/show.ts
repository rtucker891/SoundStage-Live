export type Show = {
  id: string;
  title: string;
  description: string;
  episodes: number;
  status: "Active" | "Draft" | "Archived";
};