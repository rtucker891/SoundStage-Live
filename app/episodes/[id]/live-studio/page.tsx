"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import {
  createAsset,
  createRecording,
  createShowNote,
  createTranscript,
  getEpisodes,
  getRecordings,
  updateEpisodeTitle,
  uploadFileToStorage,
} from "@/lib/api";
import { formatTimestamp, type Chapter } from "@/lib/studio/chapters";
import { trimSilenceFromBlob } from "@/lib/audio/trimSilence";

import type { Episode } from "@/types/episode";

// The shape returned by POST /api/ai/live-to-published.
type EpisodePackage = {
  ok: true;
  episodeId: string;
  recordingId: string | null;
  transcript: string | null;
  titleOptions: string[];
  showNotes: string | null;
  description: string | null;
  chapters: Chapter[];
  highlights: { quote: string; reason: string; timestamp: number }[];
  socialPosts: { platform: string; content: string }[];
  audiogram: {
    highlight: { quote: string; reason: string; timestamp: number } | null;
    caption: string | null;
  };
  errors: Record<string, string>;
};

// The pipeline runs as one request, so we can't stream true per-step progress.
// Instead we show this checklist and mark each row done/failed from the
// response's per-field values + error flags once it returns.
const STEP_LABELS: { key: string; label: string }[] = [
  { key: "transcript", label: "Transcribe audio" },
  { key: "titleOptions", label: "Suggest episode titles" },
  { key: "showNotes", label: "Write show notes" },
  { key: "description", label: "Draft episode description" },
  { key: "chapters", label: "Detect chapters" },
  { key: "highlights", label: "Find highlights" },
  { key: "socialPosts", label: "Generate social posts" },
];

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

export default function LiveStudioPage() {
  const params = useParams();
  const episodeId = params.id as string;

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<"free" | "studio" | null>(null);

  const [generating, setGenerating] = useState(false);
  const [pkg, setPkg] = useState<EpisodePackage | null>(null);
  const [error, setError] = useState("");

  // Editable review fields (pre-filled from the package).
  const [title, setTitle] = useState("");
  const [showNotes, setShowNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Audio: original recording + optional client-trimmed version.
  const [originalUrl, setOriginalUrl] = useState("");
  const [trimmedUrl, setTrimmedUrl] = useState("");
  const [trimInfo, setTrimInfo] = useState("");
  const [trimming, setTrimming] = useState(false);
  const [useTrimmed, setUseTrimmed] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function load() {
      const [episodes, recordings, planRes] = await Promise.all([
        getEpisodes(),
        getRecordings(),
        (async () => {
          try {
            const res = await fetch("/api/plan", { headers: await authHeaders() });
            const json = (await res.json()) as { plan?: "free" | "studio" };
            return json.plan ?? "free";
          } catch {
            return "free" as const;
          }
        })(),
      ]);

      setEpisode(episodes.find((e) => e.id === episodeId) ?? null);
      setPlan(planRes);

      const latest = recordings
        .filter((r) => r.episodeId === episodeId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (latest?.audioUrl) setOriginalUrl(latest.audioUrl);

      setLoading(false);
    }
    load();
  }, [episodeId]);

  const isStudio = plan === "studio";

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setPkg(null);
    try {
      const res = await fetch("/api/ai/live-to-published", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ episodeId }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 402 = not Studio tier; surface the upgrade message.
        setError(data?.error ?? "Generation failed.");
        return;
      }

      const p = data as EpisodePackage;
      setPkg(p);
      setTitle(p.titleOptions[0] ?? episode?.title ?? "");
      setShowNotes(p.showNotes ?? "");
      setTranscript(p.transcript ?? "");
      setChapters(p.chapters ?? []);
    } catch {
      setError("Generation failed — please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Draw a static waveform for the currently-selected audio into the canvas and
  // overlay the social caption. This is the "audiogram" preview; full video
  // export is a documented follow-up.
  async function drawAudiogram(url: string, caption: string | null) {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctxAudio = new AudioCtx();
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      const audio = await ctxAudio.decodeAudioData(buf);
      const data = audio.getChannelData(0);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#4f46e5");
      grad.addColorStop(0.5, "#9333ea");
      grad.addColorStop(1, "#db2777");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Peaks downsample.
      const mid = h * 0.55;
      const bars = Math.min(w, 200);
      const step = Math.floor(data.length / bars) || 1;
      const barW = w / bars;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < bars; i++) {
        let peak = 0;
        for (let j = 0; j < step; j++) {
          const v = Math.abs(data[i * step + j] ?? 0);
          if (v > peak) peak = v;
        }
        const barH = Math.max(2, peak * (h * 0.5));
        ctx.fillRect(i * barW, mid - barH / 2, Math.max(1, barW - 1), barH);
      }

      if (caption) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, h - 70, w, 70);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px sans-serif";
        const words = caption.split(/\s+/);
        let line = "";
        let y = h - 46;
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > w - 24 && line) {
            ctx.fillText(line, 12, y);
            y += 22;
            line = word;
            if (y > h - 6) break;
          } else {
            line = test;
          }
        }
        if (line && y <= h - 6) ctx.fillText(line, 12, y);
      }
    } catch {
      // Non-fatal: leave the canvas blank if decode fails.
    } finally {
      try {
        await ctxAudio.close();
      } catch {
        /* ignore */
      }
    }
  }

  // Redraw the audiogram whenever the package or selected audio changes.
  useEffect(() => {
    if (!pkg) return;
    const url = useTrimmed && trimmedUrl ? trimmedUrl : originalUrl;
    void drawAudiogram(url, pkg.audiogram.caption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, useTrimmed, trimmedUrl, originalUrl]);

  // Auto-trim dead air — CLIENT-SIDE and NON-DESTRUCTIVE. Produces a new WAV in
  // the browser; nothing is saved until the user clicks "Save trimmed version".
  async function handleAutoTrim() {
    if (!originalUrl) return;
    setTrimming(true);
    setTrimInfo("Analyzing audio for dead air…");
    try {
      const blob = await (await fetch(originalUrl)).blob();
      const result = await trimSilenceFromBlob(blob);
      if (!result) {
        setTrimInfo("No significant dead air found — original left as-is.");
        return;
      }
      const url = URL.createObjectURL(result.blob);
      setTrimmedUrl(url);
      setUseTrimmed(true);
      setTrimInfo(
        `Trimmed ${result.secondsRemoved.toFixed(1)}s of silence ` +
          `(${result.originalSeconds.toFixed(1)}s → ${result.trimmedSeconds.toFixed(
            1
          )}s). Preview below — nothing is saved until you choose to.`
      );
    } catch {
      setTrimInfo("Auto-trim could not process this recording.");
    } finally {
      setTrimming(false);
    }
  }

  // Persist the trimmed audio as a NEW recording + asset (original untouched).
  async function handleSaveTrimmed() {
    if (!trimmedUrl || !episode) return;
    setTrimInfo("Saving trimmed version as a new recording…");
    try {
      const blob = await (await fetch(trimmedUrl)).blob();
      const file = new File([blob], `trimmed-${Date.now()}.wav`, {
        type: "audio/wav",
      });
      const uploaded = await uploadFileToStorage(
        file,
        `episodes/${episode.id}/recordings`
      );
      await createRecording({
        episodeId: episode.id,
        name: `Trimmed ${new Date().toLocaleTimeString()}`,
        duration: 0,
        audioUrl: uploaded.url,
      });
      await createAsset({
        episodeId: episode.id,
        name: `Trimmed recording`,
        type: "recording",
        fileName: file.name,
        fileSize: file.size,
        mimeType: "audio/wav",
        url: uploaded.url,
      });
      setTrimInfo("Saved as a new recording. Your original is untouched.");
    } catch {
      setTrimInfo("Could not save the trimmed recording.");
    }
  }

  function updateChapter(i: number, patch: Partial<Chapter>) {
    setChapters((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    );
  }

  async function persistEdits() {
    if (!episode) return;
    // Title
    if (title.trim() && title.trim() !== episode.title) {
      await updateEpisodeTitle(episode.id, title.trim());
    }
    // Show notes
    if (showNotes.trim()) {
      await createShowNote({
        episodeId: episode.id,
        title: title.trim() || episode.title,
        summary: showNotes.trim(),
        bulletPoints: [],
      });
    }
    // Transcript (stored as a single segment of plain text).
    if (transcript.trim()) {
      await createTranscript({
        episodeId: episode.id,
        segments: [
          {
            id: crypto.randomUUID(),
            speaker: "",
            startTime: 0,
            endTime: 0,
            text: transcript.trim(),
          },
        ],
      });
    }
    // Chapters (server route sanitizes + sorts).
    if (chapters.length) {
      await fetch(`/api/episodes/${episode.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapters }),
      });
    }
  }

  async function handleSaveDraft() {
    setSaveMessage("Saving your edits…");
    try {
      await persistEdits();
      setSaveMessage("Saved. Edits are attached to the episode.");
    } catch (e) {
      setSaveMessage(
        e instanceof Error ? `Save failed: ${e.message}` : "Save failed."
      );
    }
  }

  async function handleReviewAndPublish() {
    if (!episode) return;
    setPublishing(true);
    setPublishMessage("Saving edits, then publishing…");
    try {
      await persistEdits();
      const res = await fetch(`/api/episodes/${episode.id}/publish`, {
        method: "POST",
        headers: await authHeaders(),
      });
      const result = await res.json();
      if (!res.ok) {
        setPublishMessage(`Publish failed: ${result.error ?? "Unknown error"}`);
        return;
      }
      setEpisode({ ...episode, status: "Published" });
      setPublishMessage(
        "Published! Your episode is live." +
          (result.note ? ` Note: ${result.note}` : "")
      );
    } catch (e) {
      setPublishMessage(
        e instanceof Error ? `Publish failed: ${e.message}` : "Publish failed."
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-slate-500">Loading AI Studio…</p>
      </AppShell>
    );
  }

  if (!episode) {
    return (
      <AppShell>
        <p className="text-red-500">Episode not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <EpisodeNavigation episodeId={episode.id} />

      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Live-to-Published · AI Episode Studio
        </p>
        <h1 className="mt-2 text-4xl font-bold">{episode.title}</h1>
        <p className="mt-3 text-white/80">
          Show: {episode.show} · Guest: {episode.guest} · {episode.status}
        </p>
      </div>

      {/* Generate panel */}
      <div className="mt-8 rounded-2xl bg-white p-6 shadow">
        <h2 className="text-2xl font-bold">One-Click Episode Package</h2>
        <p className="mt-2 text-slate-600">
          Turn your latest recording into a review-ready episode: transcript,
          title ideas, show notes, description, chapters, highlights, social
          posts and an audiogram preview — all in one pass.
        </p>

        {!originalUrl && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            No recording found for this episode. Add audio in the Studio first.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          {isStudio ? (
            <button
              onClick={handleGenerate}
              disabled={generating || !originalUrl}
              className="rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-3 font-semibold text-white disabled:opacity-60"
            >
              {generating ? "Generating…" : "Generate Episode"}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button
                disabled
                title="Studio-tier feature"
                className="cursor-not-allowed rounded-lg bg-slate-300 px-6 py-3 font-semibold text-slate-600"
              >
                🔒 Generate Episode
              </button>
              <a
                href="/settings/billing"
                className="rounded-lg border border-purple-300 px-5 py-3 font-semibold text-purple-700 hover:bg-purple-50"
              >
                Upgrade to Studio
              </a>
            </div>
          )}
          {plan === "free" && (
            <span className="text-sm text-slate-500">
              The AI Episode Studio is a Studio-tier feature.
            </span>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {(generating || pkg) && (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {STEP_LABELS.map((step) => {
              const failed = pkg?.errors?.[step.key];
              const done =
                pkg &&
                !failed &&
                (() => {
                  switch (step.key) {
                    case "transcript":
                      return Boolean(pkg.transcript);
                    case "titleOptions":
                      return pkg.titleOptions.length > 0;
                    case "showNotes":
                      return Boolean(pkg.showNotes);
                    case "description":
                      return Boolean(pkg.description);
                    case "chapters":
                      return pkg.chapters.length > 0;
                    case "highlights":
                      return pkg.highlights.length > 0;
                    case "socialPosts":
                      return pkg.socialPosts.length > 0;
                    default:
                      return false;
                  }
                })();
              return (
                <div
                  key={step.key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>
                    {generating && !pkg
                      ? "⏳"
                      : failed
                      ? "⚠️"
                      : done
                      ? "✓"
                      : "○"}
                  </span>
                  <span className={failed ? "text-amber-700" : "text-slate-700"}>
                    {step.label}
                    {failed ? " — failed" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review screen */}
      {pkg && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Title */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="text-lg font-bold">Episode Title</h3>
              {pkg.titleOptions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pkg.titleOptions.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="title-option"
                        checked={title === opt}
                        onChange={() => setTitle(opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-3 w-full rounded-lg border border-slate-200 p-3"
                placeholder="Episode title"
              />
            </div>

            {/* Show notes */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="text-lg font-bold">Show Notes</h3>
              <textarea
                value={showNotes}
                onChange={(e) => setShowNotes(e.target.value)}
                rows={8}
                className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm"
              />
            </div>

            {/* Chapters */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="text-lg font-bold">Chapters</h3>
              {chapters.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No chapters were generated.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {chapters.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-right font-mono text-xs text-slate-500">
                        {formatTimestamp(c.startTime)}
                      </span>
                      <input
                        value={c.title}
                        onChange={(e) =>
                          updateChapter(i, { title: e.target.value })
                        }
                        className="flex-1 rounded-lg border border-slate-200 p-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="text-lg font-bold">Transcript</h3>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={10}
                className="mt-3 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
              />
            </div>
          </div>

          {/* Sidebar: audiogram, audio, publish */}
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="text-lg font-bold">Audiogram Preview</h3>
              <p className="mt-1 text-xs text-slate-500">
                Static waveform + caption. Video export is a follow-up.
              </p>
              <canvas
                ref={canvasRef}
                width={400}
                height={320}
                className="mt-3 w-full rounded-xl border border-slate-200"
              />
              {pkg.audiogram.highlight && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  Highlight @ {formatTimestamp(pkg.audiogram.highlight.timestamp)}:
                  “{pkg.audiogram.highlight.quote}”
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="text-lg font-bold">Audio</h3>
              <div className="mt-3 flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!useTrimmed}
                    onChange={() => setUseTrimmed(false)}
                  />
                  Original
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={useTrimmed}
                    disabled={!trimmedUrl}
                    onChange={() => setUseTrimmed(true)}
                  />
                  Trimmed
                </label>
              </div>
              <audio
                controls
                src={useTrimmed && trimmedUrl ? trimmedUrl : originalUrl}
                className="mt-3 w-full"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleAutoTrim}
                  disabled={trimming || !originalUrl}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {trimming ? "Trimming…" : "Auto-trim dead air (beta)"}
                </button>
                {trimmedUrl && (
                  <button
                    onClick={handleSaveTrimmed}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Save trimmed version
                  </button>
                )}
              </div>
              {trimInfo && (
                <p className="mt-3 text-xs text-slate-500">{trimInfo}</p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="text-lg font-bold">Publish</h3>
              <button
                onClick={handleSaveDraft}
                className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Save Edits
              </button>
              <button
                onClick={handleReviewAndPublish}
                disabled={publishing}
                className="mt-3 w-full rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {publishing ? "Publishing…" : "Review & Publish"}
              </button>
              {saveMessage && (
                <p className="mt-3 text-xs font-semibold text-slate-600">
                  {saveMessage}
                </p>
              )}
              {publishMessage && (
                <div className="mt-3 rounded-lg bg-green-50 p-3">
                  <p className="text-xs font-semibold text-green-700">
                    {publishMessage}
                  </p>
                  {episode.status === "Published" && (
                    <a
                      href={`/listen/${episode.id}`}
                      target="_blank"
                      className="mt-2 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      View Public Page
                    </a>
                  )}
                </div>
              )}
            </div>

            {pkg.socialPosts.length > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow">
                <h3 className="text-lg font-bold">Social Posts</h3>
                <div className="mt-3 space-y-3">
                  {pkg.socialPosts.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-200 p-3 text-sm"
                    >
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        {p.platform}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">
                        {p.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
