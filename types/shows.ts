export type Show = {
  id: string;
  title: string;
  description: string;
  status: "Active" | "Draft";
  episodes: number;
};