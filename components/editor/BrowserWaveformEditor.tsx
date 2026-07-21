"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteTimelineClip, formatTimelineTime, positionTimelineClips, rulerInterval,
  splitTimelineAt, timelineDuration, trimTimelineClip,
  type PositionedTimelineClip, type TimelineClip,
} from "@/lib/audio/timeline";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 800;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

type Props = {
  audioUrl: string;
  episodeTitle: string;
  onSave: (blob: Blob, durationSeconds: number) => Promise<void>;
};

type TrimDrag = { clipId: string; edge: "start" | "end"; startX: number; original: TimelineClip[] };

const cloneClips = (clips: TimelineClip[]) => clips.map((clip) => ({ ...clip }));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const zoomToSlider = (zoom: number) => Math.log(zoom / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM) * 100;
const sliderToZoom = (value: number) => MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, value / 100);

function Waveform({ clip, buffer, selected }: { clip: PositionedTimelineClip; buffer: AudioBuffer; selected: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.min(3000, Math.max(1, Math.ceil(canvas.clientWidth * ratio)));
      canvas.height = Math.max(1, Math.ceil(canvas.clientHeight * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      const channel = buffer.getChannelData(0);
      const first = Math.floor(clip.sourceStart * buffer.sampleRate);
      const last = Math.min(channel.length, Math.ceil(clip.sourceEnd * buffer.sampleRate));
      const samplesPerPixel = Math.max(1, (last - first) / canvas.width);
      const center = canvas.height / 2;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = selected ? "#e0f2fe" : "#bfdbfe";
      context.lineWidth = Math.max(1, ratio);
      context.beginPath();
      for (let x = 0; x < canvas.width; x += 1) {
        const start = Math.floor(first + x * samplesPerPixel);
        const end = Math.min(last, Math.ceil(start + samplesPerPixel));
        let peak = 0;
        for (let sample = start; sample < end; sample += 1) peak = Math.max(peak, Math.abs(channel[sample] || 0));
        const amplitude = Math.max(1, peak * center * 0.92);
        context.moveTo(x, center - amplitude);
        context.lineTo(x, center + amplitude);
      }
      context.stroke();
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [buffer, clip, selected]);
  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}

function encodeTimelineAsWav(buffer: AudioBuffer, clips: TimelineClip[]) {
  const sampleRate = buffer.sampleRate;
  const channelCount = Math.min(2, buffer.numberOfChannels);
  const frameCounts = clips.map((clip) => Math.max(0, Math.round((clip.sourceEnd - clip.sourceStart) * sampleRate)));
  const totalFrames = frameCounts.reduce((total, frames) => total + frames, 0);
  const dataBytes = totalFrames * channelCount * 2;
  const wav = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(wav);
  let cursor = 0;
  const text = (value: string) => { for (let index = 0; index < value.length; index += 1) view.setUint8(cursor++, value.charCodeAt(index)); };
  text("RIFF"); view.setUint32(cursor, 36 + dataBytes, true); cursor += 4;
  text("WAVEfmt "); view.setUint32(cursor, 16, true); cursor += 4;
  view.setUint16(cursor, 1, true); cursor += 2;
  view.setUint16(cursor, channelCount, true); cursor += 2;
  view.setUint32(cursor, sampleRate, true); cursor += 4;
  view.setUint32(cursor, sampleRate * channelCount * 2, true); cursor += 4;
  view.setUint16(cursor, channelCount * 2, true); cursor += 2;
  view.setUint16(cursor, 16, true); cursor += 2;
  text("data"); view.setUint32(cursor, dataBytes, true); cursor += 4;
  clips.forEach((clip, clipIndex) => {
    const firstFrame = Math.floor(clip.sourceStart * sampleRate);
    for (let frame = 0; frame < frameCounts[clipIndex]; frame += 1) {
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const sample = clamp(buffer.getChannelData(channelIndex)[firstFrame + frame] || 0, -1, 1);
        view.setInt16(cursor, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        cursor += 2;
      }
    }
  });
  return new Blob([wav], { type: "audio/wav" });
}

export default function BrowserWaveformEditor({ audioUrl, episodeTitle, onSave }: Props) {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(42);
  const [viewportWidth, setViewportWidth] = useState(900);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState("Loading waveform…");
  const [saving, setSaving] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const animationRef = useRef<number | null>(null);
  const clockRef = useRef({ startedAt: 0, timelineAtStart: 0, speed: 1 });
  const historyRef = useRef<TimelineClip[][]>([]);
  const futureRef = useRef<TimelineClip[][]>([]);
  const trimDragRef = useRef<TrimDrag | null>(null);

  const positioned = useMemo(() => positionTimelineClips(clips), [clips]);
  const duration = useMemo(() => timelineDuration(clips), [clips]);
  const contentWidth = Math.max(viewportWidth - 2, duration * pixelsPerSecond, 640);
  const selectedClip = positioned.find((clip) => clip.id === selectedClipId) ?? null;

  const stopSources = useCallback(() => {
    sourcesRef.current.forEach((source) => { try { source.stop(); } catch { /* Already stopped. */ } });
    sourcesRef.current = [];
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }, []);
  const stopPlayback = useCallback(() => { stopSources(); setPlaying(false); }, [stopSources]);
  const ensureVisible = useCallback((time: number) => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const x = time * pixelsPerSecond;
    if (x > viewport.scrollLeft + viewport.clientWidth - 110) viewport.scrollLeft = Math.max(0, x - viewport.clientWidth * 0.38);
    if (x < viewport.scrollLeft + 70) viewport.scrollLeft = Math.max(0, x - viewport.clientWidth * 0.2);
  }, [pixelsPerSecond]);

  const playFrom = useCallback(async (startAt: number, playbackSpeed = speed) => {
    if (!buffer || !clips.length || duration <= 0) return;
    stopSources();
    const start = startAt >= duration - 0.01 ? 0 : clamp(startAt, 0, duration);
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    await context.resume();
    const beginsAt = context.currentTime + 0.03;
    positionTimelineClips(clips).forEach((clip) => {
      const overlap = Math.max(start, clip.timelineStart);
      if (overlap >= clip.timelineEnd) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(context.destination);
      source.start(beginsAt + (overlap - start) / playbackSpeed, clip.sourceStart + overlap - clip.timelineStart, clip.timelineEnd - overlap);
      sourcesRef.current.push(source);
    });
    setPlayhead(start); setPlaying(true);
    clockRef.current = { startedAt: performance.now(), timelineAtStart: start, speed: playbackSpeed };
    const tick = () => {
      const clock = clockRef.current;
      const next = clock.timelineAtStart + (performance.now() - clock.startedAt) / 1000 * clock.speed;
      if (next >= duration) { setPlayhead(duration); setPlaying(false); stopSources(); return; }
      setPlayhead(next); ensureVisible(next); animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [buffer, clips, duration, ensureVisible, speed, stopSources]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error("The recording link could not be opened.");
        const context = new AudioContext();
        const decoded = await context.decodeAudioData((await response.arrayBuffer()).slice(0));
        await context.close();
        if (cancelled) return;
        const initial = [{ id: crypto.randomUUID(), label: episodeTitle, sourceStart: 0, sourceEnd: decoded.duration }];
        setBuffer(decoded); setClips(initial); setSelectedClipId(initial[0].id); setPlayhead(0); setStatus("Ready");
        historyRef.current = []; futureRef.current = []; setUndoCount(0); setRedoCount(0);
      } catch (error) { if (!cancelled) setStatus(error instanceof Error ? error.message : "The waveform could not be loaded."); }
    })();
    return () => { cancelled = true; stopSources(); };
  }, [audioUrl, episodeTitle, stopSources]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => setViewportWidth(viewport.clientWidth));
    observer.observe(viewport); setViewportWidth(viewport.clientWidth);
    return () => observer.disconnect();
  }, []);

  const commit = useCallback((next: TimelineClip[], message: string) => {
    historyRef.current.push(cloneClips(clips)); futureRef.current = [];
    setUndoCount(historyRef.current.length); setRedoCount(0);
    setClips(next); setPlayhead((current) => Math.min(current, timelineDuration(next))); stopPlayback(); setStatus(message);
  }, [clips, stopPlayback]);
  const undo = useCallback(() => {
    const previous = historyRef.current.pop(); if (!previous) return;
    futureRef.current.push(cloneClips(clips)); setClips(previous); setPlayhead((current) => Math.min(current, timelineDuration(previous))); stopPlayback(); setStatus("Undo");
    setUndoCount(historyRef.current.length); setRedoCount(futureRef.current.length);
  }, [clips, stopPlayback]);
  const redo = useCallback(() => {
    const next = futureRef.current.pop(); if (!next) return;
    historyRef.current.push(cloneClips(clips)); setClips(next); setPlayhead((current) => Math.min(current, timelineDuration(next))); stopPlayback(); setStatus("Redo");
    setUndoCount(historyRef.current.length); setRedoCount(futureRef.current.length);
  }, [clips, stopPlayback]);
  const split = useCallback(() => {
    const next = splitTimelineAt(clips, playhead, () => crypto.randomUUID());
    if (next === clips) { setStatus("Move the playhead inside a clip to split."); return; }
    commit(next, `Split at ${formatTimelineTime(playhead, true)}`);
    const right = positionTimelineClips(next).find((clip) => Math.abs(clip.timelineStart - playhead) < 0.02);
    if (right) setSelectedClipId(right.id);
  }, [clips, commit, playhead]);
  const removeSelected = useCallback(() => {
    if (!selectedClipId) return;
    const next = deleteTimelineClip(clips, selectedClipId);
    commit(next, "Clip removed — the timeline rippled closed."); setSelectedClipId(next[0]?.id ?? null);
  }, [clips, commit, selectedClipId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, [contenteditable='true']")) return;
      if (event.code === "Space") { event.preventDefault(); if (playing) stopPlayback(); else void playFrom(playhead); }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); split(); }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if (event.key === "+" || event.key === "=") setPixelsPerSecond((value) => clamp(value * 1.4, MIN_ZOOM, MAX_ZOOM));
      if (event.key === "-") setPixelsPerSecond((value) => clamp(value / 1.4, MIN_ZOOM, MAX_ZOOM));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playFrom, playhead, playing, redo, removeSelected, split, stopPlayback, undo]);

  const seek = (time: number) => { const next = clamp(time, 0, duration); setPlayhead(next); if (playing) void playFrom(next); };
  const beginTrim = (event: React.PointerEvent, clipId: string, edge: "start" | "end") => {
    event.preventDefault(); event.stopPropagation(); historyRef.current.push(cloneClips(clips)); futureRef.current = [];
    setUndoCount(historyRef.current.length); setRedoCount(0);
    trimDragRef.current = { clipId, edge, startX: event.clientX, original: cloneClips(clips) };
    event.currentTarget.setPointerCapture(event.pointerId); setSelectedClipId(clipId); stopPlayback();
  };
  const moveTrim = (event: React.PointerEvent) => {
    const drag = trimDragRef.current; if (!drag) return;
    const original = drag.original.find((clip) => clip.id === drag.clipId); if (!original) return;
    const delta = (event.clientX - drag.startX) / pixelsPerSecond;
    const sourceTime = (drag.edge === "start" ? original.sourceStart : original.sourceEnd) + delta;
    setClips(trimTimelineClip(drag.original, drag.clipId, drag.edge, sourceTime));
    setStatus(`Trimming ${drag.edge} · ${formatTimelineTime(Math.abs(delta), true)}`);
  };
  const endTrim = () => { trimDragRef.current = null; setStatus("Trim applied"); };
  const fitTimeline = () => { if (duration) setPixelsPerSecond(clamp((viewportWidth - 28) / duration, MIN_ZOOM, MAX_ZOOM)); if (scrollRef.current) scrollRef.current.scrollLeft = 0; };
  const handleSave = async () => {
    if (!buffer || !clips.length || saving) return;
    setSaving(true); setStatus("Rendering edited WAV…");
    try { await new Promise((resolve) => setTimeout(resolve, 20)); const blob = encodeTimelineAsWav(buffer, clips); setStatus("Uploading edited recording…"); await onSave(blob, duration); setStatus("Edited recording saved. The original remains untouched."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "The edited recording could not be saved."); }
    finally { setSaving(false); }
  };

  const interval = rulerInterval(pixelsPerSecond);
  const tickCount = Math.ceil(duration / interval) + 1;

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-cyan-300/30 bg-[#111827] text-white shadow-2xl shadow-cyan-950/20">
      <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-fuchsia-500/15 p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">Browser waveform editor</p><h2 className="mt-1 text-2xl font-black lg:text-3xl">Cut the episode where you can see it</h2><p className="mt-2 max-w-3xl text-base text-slate-300">Zoom from the whole episode down to individual sounds. Every clip, ruler mark, and the playhead shares the same clock.</p></div>
          <button onClick={handleSave} disabled={!buffer || !clips.length || saving} className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 font-black text-slate-950 shadow-lg shadow-cyan-500/20 hover:brightness-110 disabled:opacity-50">{saving ? "Saving edit…" : "Save edited recording"}</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-950/70 px-4 py-3">
        <button onClick={() => playing ? stopPlayback() : void playFrom(playhead)} disabled={!buffer || !clips.length} aria-label={playing ? "Pause" : "Play"} className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950 disabled:opacity-40">{playing ? "Ⅱ" : "▶"}</button>
        <button onClick={() => seek(0)} className="rounded-lg border border-white/15 px-3 py-2 font-semibold text-slate-200 hover:bg-white/10">|◀</button>
        <div className="min-w-32 rounded-lg border border-cyan-300/20 bg-black/30 px-3 py-2 font-mono text-lg font-bold text-cyan-200">{formatTimelineTime(playhead, true)}</div>
        <label className="ml-1 flex items-center gap-2 text-sm font-semibold text-slate-300">Speed<select value={speed} onChange={(event) => { const next = Number(event.target.value); setSpeed(next); if (playing) void playFrom(playhead, next); }} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-white">{SPEEDS.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
        <div className="mx-1 h-8 w-px bg-white/10" />
        <button onClick={split} disabled={!selectedClip} className="rounded-lg bg-blue-500 px-4 py-2 font-bold hover:bg-blue-400 disabled:opacity-40">Split at playhead</button>
        <button onClick={removeSelected} disabled={!selectedClip} className="rounded-lg border border-rose-400/40 px-4 py-2 font-bold text-rose-200 hover:bg-rose-500/15 disabled:opacity-40">Delete clip</button>
        <button onClick={undo} disabled={!undoCount} className="rounded-lg border border-white/15 px-3 py-2 font-semibold hover:bg-white/10 disabled:opacity-35">Undo</button>
        <button onClick={redo} disabled={!redoCount} className="rounded-lg border border-white/15 px-3 py-2 font-semibold hover:bg-white/10 disabled:opacity-35">Redo</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 text-sm text-slate-300">
        <span className="font-bold text-white">Zoom</span><button onClick={() => setPixelsPerSecond((value) => clamp(value / 1.4, MIN_ZOOM, MAX_ZOOM))} className="rounded-md border border-white/15 px-3 py-1.5 text-lg">−</button>
        <input aria-label="Timeline zoom" type="range" min={0} max={100} step={0.25} value={zoomToSlider(pixelsPerSecond)} onChange={(event) => setPixelsPerSecond(sliderToZoom(Number(event.target.value)))} className="w-44 accent-cyan-400 lg:w-64" />
        <button onClick={() => setPixelsPerSecond((value) => clamp(value * 1.4, MIN_ZOOM, MAX_ZOOM))} className="rounded-md border border-white/15 px-3 py-1.5 text-lg">+</button><button onClick={fitTimeline} className="rounded-lg border border-cyan-300/30 px-3 py-2 font-semibold text-cyan-200">Fit episode</button>
        <span className="ml-auto font-mono text-xs text-slate-400">{pixelsPerSecond < 1 ? pixelsPerSecond.toFixed(2) : pixelsPerSecond.toFixed(0)} px/sec · {formatTimelineTime(duration)}</span>
      </div>
      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden bg-[#0b1020]" aria-label="Scrollable audio timeline">
        <div style={{ width: contentWidth }} className="relative h-56 select-none" onPointerDown={(event) => { if (event.button !== 0) return; const rect = event.currentTarget.getBoundingClientRect(); seek((event.clientX - rect.left) / pixelsPerSecond); }}>
          <div className="absolute inset-x-0 top-0 h-9 border-b border-white/10 bg-slate-950/90">{Array.from({ length: tickCount }, (_, index) => index * interval).map((time) => <div key={time} className="absolute top-0 h-full border-l border-slate-500/60" style={{ left: time * pixelsPerSecond }}><span className="ml-1.5 font-mono text-[11px] font-semibold text-slate-300">{formatTimelineTime(time, interval < 1)}</span></div>)}</div>
          <div className="absolute inset-x-0 bottom-0 top-9 border-b border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/90">
            <div className="absolute left-0 top-3 rounded-r-lg bg-slate-950/80 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Main mix</div>
            {positioned.map((clip, index) => { const selected = clip.id === selectedClipId; return <div key={clip.id} onPointerDown={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setSelectedClipId(clip.id); seek(clip.timelineStart + (event.clientX - rect.left) / pixelsPerSecond); }} className={`absolute bottom-5 top-10 overflow-hidden rounded-lg border-2 shadow-lg ${selected ? "border-cyan-300 bg-gradient-to-b from-blue-500 to-indigo-700 shadow-cyan-500/20" : "border-blue-400/40 bg-gradient-to-b from-blue-600/90 to-indigo-800/90"}`} style={{ left: clip.timelineStart * pixelsPerSecond, width: Math.max(3, clip.duration * pixelsPerSecond) }}>
              <div className="pointer-events-none absolute inset-0"><Waveform clip={clip} buffer={buffer!} selected={selected} /></div><div className="pointer-events-none absolute left-2 top-1 max-w-[calc(100%-1rem)] truncate rounded bg-slate-950/55 px-2 py-0.5 text-[11px] font-bold">{index + 1}. {clip.label}</div>
              <button aria-label="Trim clip start" title="Drag to trim the beginning" onPointerDown={(event) => beginTrim(event, clip.id, "start")} onPointerMove={moveTrim} onPointerUp={endTrim} onPointerCancel={endTrim} className="absolute inset-y-0 left-0 w-3 cursor-ew-resize bg-cyan-200/80 opacity-75 hover:opacity-100" /><button aria-label="Trim clip end" title="Drag to trim the end" onPointerDown={(event) => beginTrim(event, clip.id, "end")} onPointerMove={moveTrim} onPointerUp={endTrim} onPointerCancel={endTrim} className="absolute inset-y-0 right-0 w-3 cursor-ew-resize bg-cyan-200/80 opacity-75 hover:opacity-100" />
            </div>; })}
          </div>
          <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-0 border-l-2 border-rose-400" style={{ left: playhead * pixelsPerSecond }}><div className="-ml-[6px] h-0 w-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-rose-400" /></div>
        </div>
      </div>
      <div className="grid gap-3 border-t border-white/10 bg-slate-950/70 p-4 md:grid-cols-[1fr_auto] md:items-center"><div><p className="font-semibold text-slate-200">{status}</p><p className="mt-1 text-xs text-slate-500">Shortcuts: Space play/pause · S split · Delete remove · Ctrl/Cmd+Z undo · +/- zoom</p></div>{selectedClip && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300"><span className="font-bold text-cyan-200">Selected:</span> {formatTimelineTime(selectedClip.duration, true)} · source {formatTimelineTime(selectedClip.sourceStart, true)}–{formatTimelineTime(selectedClip.sourceEnd, true)}</div>}</div>
    </section>
  );
}
