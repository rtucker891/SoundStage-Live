export type AssetType =
  | "recording"
  | "transcript"
  | "episode-description"
  | "publish-package"
  | "show-notes"
  | "artwork"
  | "intro-music"
  | "outro-music"
  | "attachment";

export type Asset = {
  id: string;
  episodeId: string;
  name: string;
  type: AssetType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  url: string;
  
};