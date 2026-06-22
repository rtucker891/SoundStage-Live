export type Episode = {
  id: string;
  title: string;
  show: string;
  status: "Draft" | "Planning" | "Editing" | "Published";
  guest: string;
};