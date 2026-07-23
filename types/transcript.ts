/**
 * A single word with absolute start/end times (in seconds) relative to the
 * WHOLE episode. Word timings are what make Descript-style transcript editing
 * possible: deleting a word maps to cutting the audio span [start, end].
 */
export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};

export type TranscriptSegment = {
  id: string;
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
  /**
   * Optional word-level timings for this segment. Present only for transcripts
   * generated for the editor (whisper-1 word timestamps). Existing readers that
   * only use `text` are unaffected, so this stays backward-compatible.
   */
  words?: TranscriptWord[];
};

export type Transcript = {
  id: string;
  episodeId: string;
  createdAt: string;
  segments: TranscriptSegment[];
};
