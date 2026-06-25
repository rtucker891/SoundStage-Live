export type TranscriptSegment = {
  id: string;
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
};

export type Transcript = {
  id: string;
  episodeId: string;
  createdAt: string;
  segments: TranscriptSegment[];
};