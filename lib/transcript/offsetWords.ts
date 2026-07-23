/**
 * offsetWords — reassemble a CHUNKED transcription into ONE absolutely-timed
 * result.
 *
 * Why this exists: long episodes are split into ~10-minute chunks before
 * transcription (see lib/audio/chunkForTranscription). Each chunk is
 * transcribed independently, so whisper reports timings RELATIVE TO THAT CHUNK
 * — every chunk's words start again near 0. If we naively concatenated them,
 * every word after the first chunk would point at the wrong moment in the
 * audio.
 *
 * The fix is to OFFSET each chunk's word/segment timings by the cumulative
 * duration of all PRIOR chunks, producing timings that are absolute across the
 * whole episode. This module is pure (no browser / no ffmpeg) so it is easy to
 * unit-test.
 */

export type RawWord = { word: string; start: number; end: number };
export type RawSegment = { start: number; end: number; text: string };

export type ChunkTranscription = {
  text: string;
  words: RawWord[];
  segments: RawSegment[];
};

export type MergedWord = { text: string; start: number; end: number };
export type MergedSegment = { start: number; end: number; text: string };

export type MergedTranscription = {
  text: string;
  words: MergedWord[];
  segments: MergedSegment[];
};

/**
 * Estimate a chunk's duration from its own content when the caller does not
 * know it exactly. We use the largest word/segment end time in the chunk, which
 * is the last moment any audio was transcribed. Falls back to 0 for an empty
 * chunk.
 */
export function chunkDurationFromContent(chunk: ChunkTranscription): number {
  let max = 0;
  for (const w of chunk.words) if (w.end > max) max = w.end;
  for (const s of chunk.segments) if (s.end > max) max = s.end;
  return max;
}

/**
 * Merge ordered per-chunk transcriptions into one, shifting each chunk's timings
 * by the cumulative duration of the chunks before it.
 *
 * @param chunks     Per-chunk results, IN PLAYBACK ORDER.
 * @param durations  Optional exact duration (seconds) for each chunk. When a
 *                   duration is missing/invalid we fall back to the chunk's own
 *                   last end time (chunkDurationFromContent). Using the real
 *                   compressed-audio duration is more accurate because a chunk
 *                   can contain trailing silence after the last word.
 */
export function mergeChunkTranscriptions(
  chunks: ChunkTranscription[],
  durations?: number[]
): MergedTranscription {
  const words: MergedWord[] = [];
  const segments: MergedSegment[] = [];
  const texts: string[] = [];

  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    for (const w of chunk.words) {
      words.push({
        text: w.word,
        start: w.start + offset,
        end: w.end + offset,
      });
    }
    for (const s of chunk.segments) {
      segments.push({
        start: s.start + offset,
        end: s.end + offset,
        text: s.text,
      });
    }
    if (chunk.text) texts.push(chunk.text.trim());

    const provided = durations?.[i];
    const duration =
      typeof provided === "number" && Number.isFinite(provided) && provided > 0
        ? provided
        : chunkDurationFromContent(chunk);
    offset += duration;
  }

  return {
    text: texts.join("\n\n"),
    words,
    segments,
  };
}
