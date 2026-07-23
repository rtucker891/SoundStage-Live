"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TranscriptWord } from "@/types/transcript";
import {
  keptRangesFromDeletions,
  totalKept,
  type TimeRange,
} from "@/lib/audio/edl";
import { renderBlobFromEdl } from "@/lib/audio/renderFromEdl";
import { formatTimelineTime } from "@/lib/audio/timeline";

/**
 * TranscriptEditor — Descript-style editing: the transcript is the editing
 * surface. Deleting words marks their audio spans as cut (an EDL of KEPT
 * ranges, never a destructive edit), clicking a word seeks playback there, and
 * the current word highlights as audio plays.
 *
 * Playback uses this component's own <audio> element pointed at the same source
 * URL as the waveform editor, so click-to-seek and the highlight share one
 * playhead here. Full two-way sync with BrowserWaveformEditor (which uses raw
 * Web Audio buffers, not an <audio> element) is intentionally out of scope; see
 * the report for what is / isn't synced.
 */

type Props = {
  /** Absolute-timed words for the whole episode. */
  words: TranscriptWord[];
  /** Source audio URL (same recording the waveform editor uses). */
  audioUrl: string;
  /** Optional export hook; if absent, export triggers a local download. */
  onExport?: (blob: Blob) => Promise<void>;
};

export default function TranscriptEditor({ words, audioUrl, onExport }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wordRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Deletion model: which word indexes are removed. History enables undo.
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<Set<number>[]>([]);

  // Selection: click sets anchor; shift-click extends to a contiguous range.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());

  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");

  // Duration falls back to the last word's end until <audio> metadata loads.
  const lastWordEnd = useMemo(
    () => words.reduce((max, w) => Math.max(max, w.end), 0),
    [words]
  );
  const effectiveDuration = duration || lastWordEnd;

  // The deleted words' [start,end] spans -> kept ranges (the EDL).
  const keptRanges: TimeRange[] = useMemo(() => {
    const spans = words
      .map((w, i) => ({ w, i }))
      .filter(({ i }) => deleted.has(i))
      .map(({ w }) => ({ start: w.start, end: w.end }));
    return keptRangesFromDeletions(effectiveDuration, spans);
  }, [words, deleted, effectiveDuration]);

  const removedSeconds = Math.max(0, effectiveDuration - totalKept(keptRanges));

  // The index of the word currently being spoken (for the highlight).
  const activeIndex = useMemo(() => {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (currentTime >= w.start && currentTime < w.end) return i;
    }
    return -1;
  }, [words, currentTime]);

  // Auto-scroll the active word into view during playback.
  useEffect(() => {
    if (activeIndex < 0) return;
    wordRefs.current[activeIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeIndex]);

  const pushHistory = useCallback((snapshot: Set<number>) => {
    setHistory((h) => [...h, new Set(snapshot)]);
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  function handleWordClick(index: number, shiftKey: boolean) {
    if (shiftKey && anchor !== null) {
      const lo = Math.min(anchor, index);
      const hi = Math.max(anchor, index);
      const next = new Set<number>();
      for (let i = lo; i <= hi; i++) next.add(i);
      setSelection(next);
    } else {
      setAnchor(index);
      setSelection(new Set([index]));
      seekTo(words[index].start);
    }
  }

  function deleteSelection() {
    if (selection.size === 0) return;
    pushHistory(deleted);
    const next = new Set(deleted);
    for (const i of selection) next.add(i);
    setDeleted(next);
    setSelection(new Set());
    setAnchor(null);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setDeleted(new Set(prev));
      return h.slice(0, -1);
    });
  }

  function restoreAll() {
    if (deleted.size === 0) return;
    pushHistory(deleted);
    setDeleted(new Set());
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setStatus("Rendering edited audio…");
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error("Could not load the source audio.");
      const sourceBlob = await response.blob();
      const rendered = await renderBlobFromEdl(sourceBlob, keptRanges);
      if (!rendered) {
        throw new Error(
          "Nothing to export — the edit removed all audio, or decoding is unavailable here."
        );
      }
      if (onExport) {
        await onExport(rendered);
        setStatus("Edited audio saved.");
      } else {
        const url = URL.createObjectURL(rendered);
        const a = document.createElement("a");
        a.href = url;
        a.download = "edited-episode.wav";
        a.click();
        URL.revokeObjectURL(url);
        setStatus("Edited audio downloaded.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Transcript editing
          </p>
          <h2 className="text-2xl font-bold text-slate-900">
            Edit by transcript
          </h2>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
          Delete words to cut audio
        </span>
      </div>

      <p className="mb-4 text-sm text-slate-600">
        Click a word to jump there. Select words (click, then shift-click to
        extend) and delete them to cut the matching audio. Nothing is destroyed
        until you export.
      </p>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="hidden"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={togglePlay}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={deleteSelection}
          disabled={selection.size === 0}
          className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Delete selected ({selection.size})
        </button>
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-800 disabled:opacity-50"
        >
          Undo
        </button>
        <button
          onClick={restoreAll}
          disabled={deleted.size === 0}
          className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-800 disabled:opacity-50"
        >
          Restore all
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export edited audio"}
        </button>
      </div>

      <p className="mb-3 text-xs font-medium text-slate-500">
        {formatTimelineTime(currentTime, true)} /{" "}
        {formatTimelineTime(effectiveDuration)} · {deleted.size} word
        {deleted.size === 1 ? "" : "s"} cut · {removedSeconds.toFixed(1)}s
        removed
      </p>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-indigo-100 bg-white p-4 leading-8">
        {words.length === 0 ? (
          <p className="text-sm text-slate-500">
            No word timings available for this transcript.
          </p>
        ) : (
          words.map((word, index) => {
            const isDeleted = deleted.has(index);
            const isSelected = selection.has(index);
            const isActive = index === activeIndex;
            const classes = [
              "cursor-pointer rounded px-1 transition-colors",
              isDeleted ? "text-slate-300 line-through" : "text-slate-800",
              isSelected ? "bg-red-100 ring-1 ring-red-300" : "",
              isActive && !isDeleted ? "bg-yellow-200" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={index}
                ref={(el) => {
                  wordRefs.current[index] = el;
                }}
                type="button"
                onClick={(e) => handleWordClick(index, e.shiftKey)}
                className={classes}
              >
                {word.text}
              </button>
            );
          })
        )}
      </div>

      {status && (
        <p
          className={
            /fail|could not|nothing/i.test(status)
              ? "mt-3 text-sm font-semibold text-red-600"
              : "mt-3 text-sm font-semibold text-emerald-600"
          }
        >
          {status}
        </p>
      )}
    </div>
  );
}
