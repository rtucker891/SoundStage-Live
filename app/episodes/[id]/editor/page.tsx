"use client";

import EpisodeNavigation from "@/components/episodes/EpisodeNavigation";
import EpisodeMetaManager from "@/components/episodes/EpisodeMetaManager";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import {
  createAsset,
  createRecording,
  createShowNote,
  createTranscript,
  getAssets,
  getEpisodeChapters,
  getEpisodes,
  getShowNotes,
  getTranscripts,
  updateEpisodeStatus,
  updateShowNote,
  updateTranscript,
  uploadFileToStorage,
} from "@/lib/api";
import { addIntroOutro } from "@/lib/audio/addIntroOutro";

import type { Asset } from "@/types/asset";
import type { Episode } from "@/types/episode";
import type { Plan } from "@/lib/plan";
import type { ShowNote } from "@/types/show-note";
import type { Transcript } from "@/types/transcript";

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

export default function EpisodeEditorPage() {
  const params = useParams();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [transcriptMessage, setTranscriptMessage] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [showNote, setShowNote] = useState<ShowNote | null>(null);
  const [recordingAsset, setRecordingAsset] = useState<Asset | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [episodeDescription, setEpisodeDescription] = useState("");
  const [publishPackage, setPublishPackage] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [coverArtUrl, setCoverArtUrl] = useState("");
  const [coverArtPrompt, setCoverArtPrompt] = useState("");
  const [generatingArtwork, setGeneratingArtwork] = useState(false);
  const [artworkMessage, setArtworkMessage] = useState("");

  // Intro / Outro Music. The plan gates access (creator/studio only). The
  // combined result is previewed as a blob URL before the user saves it, and
  // saving creates a NEW recording so the original is never overwritten.
  const [plan, setPlan] = useState<Plan | null>(null);
  const [introFile, setIntroFile] = useState<File | null>(null);
  const [outroFile, setOutroFile] = useState<File | null>(null);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(false);
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(1);
  const [processingMusic, setProcessingMusic] = useState(false);
  const [musicMessage, setMusicMessage] = useState("");
  const [combinedUrl, setCombinedUrl] = useState("");
  const [combinedBlob, setCombinedBlob] = useState<Blob | null>(null);
  const [savingMusic, setSavingMusic] = useState(false);

  // Show-notes editing state. When editing is true, the read-only view is
  // swapped for editable fields. The "draft" values hold in-progress edits so
  // we can cancel without losing the saved note.
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState("");
  const [draftNoteTitle, setDraftNoteTitle] = useState("");
  const [draftNoteSummary, setDraftNoteSummary] = useState("");
  const [draftNoteBullets, setDraftNoteBullets] = useState("");

  // Phase 6 AI creator toolkit state (#27 highlights, #28 social posts,
  // #31 chapters). Each holds the generated list plus a loading + message flag.
  const [highlights, setHighlights] = useState<
    { quote: string; reason: string; timestamp: number }[]
  >([]);
  const [generatingHighlights, setGeneratingHighlights] = useState(false);
  const [highlightsMessage, setHighlightsMessage] = useState("");

  const [socialPosts, setSocialPosts] = useState<
    { platform: string; content: string }[]
  >([]);
  const [generatingSocial, setGeneratingSocial] = useState(false);
  const [socialMessage, setSocialMessage] = useState("");

  const [chapters, setChapters] = useState<
    { startTime: number; title: string }[]
  >([]);
  const [generatingChapters, setGeneratingChapters] = useState(false);
  const [chaptersMessage, setChaptersMessage] = useState("");

  useEffect(() => {
    async function load() {
      // Resolve the caller's plan so we can lock the Intro/Outro feature for
      // free users. Same signal the AI Studio uses; the value is UX-only.
      try {
        const res = await fetch("/api/plan", { headers: await authHeaders() });
        const json = (await res.json()) as { plan?: Plan };
        setPlan(json.plan ?? "free");
      } catch {
        setPlan("free");
      }

      const episodes = await getEpisodes();

      const selectedEpisode = episodes.find(
        (item) => item.id === params.id
      );

      if (
        selectedEpisode &&
        selectedEpisode.status === "Recording"
      ) {
        await updateEpisodeStatus(
          selectedEpisode.id,
          "Editing"
        );

        selectedEpisode.status = "Editing";
      }

      setEpisode(selectedEpisode || null);

      // Auto-load any artwork already saved on this episode so it shows up in
      // the preview when you re-open the editor.
      if (selectedEpisode?.coverArtUrl) {
        setCoverArtUrl(selectedEpisode.coverArtUrl);
      }

      const transcripts = await getTranscripts();

      const existingTranscript = transcripts.find(
        (item) => item.episodeId === params.id
      );

      if (existingTranscript) {
        setTranscript(existingTranscript);
      }

      const showNotes = await getShowNotes();

      const existingShowNote = showNotes.find(
        (item) => item.episodeId === params.id
      );

      if (existingShowNote) {
        setShowNote(existingShowNote);
      }

      const assets = await getAssets();

      const recording = assets.find(
        (asset) =>
          asset.episodeId === params.id &&
          asset.type === "recording"
      );

      setRecordingAsset(recording || null);

      // Load any previously-saved chapters so they persist across reloads.
      if (selectedEpisode?.id) {
        const savedChapters = await getEpisodeChapters(selectedEpisode.id);
        if (savedChapters.length > 0) {
          setChapters(savedChapters);
        }
      }

      setLoading(false);
    }

    load();
  }, [params.id]);

  async function generateTranscript() {
    if (!episode || !recordingAsset?.url) return;
    // Guard against a second click while transcription is running.
    if (generating) return;

    setGenerating(true);
    setTranscriptMessage("");

    try {
      const audioResponse = await fetch(recordingAsset.url);
      if (!audioResponse.ok) {
        throw new Error(
          "Could not load the recording audio. The link may have expired \u2014 try reopening the episode."
        );
      }
      const audioBlob = await audioResponse.blob();

      const formData = new FormData();
      formData.append("file", audioBlob, recordingAsset.fileName);

      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Transcription failed.");
      }

      const created = await createTranscript({
        episodeId: episode.id,
        segments: [
          {
            id: "1",
            speaker: "Speaker",
            startTime: 0,
            endTime: 0,
            text: data.text,
          },
        ],
      });

      await createAsset({
        episodeId: episode.id,
        name: "AI Transcript",
        type: "transcript",
        fileName: "transcript.json",
        fileSize: JSON.stringify(created).length,
        mimeType: "application/json",
        url: "#",
      });

      setTranscript(created);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTranscriptMessage(`Could not generate transcript: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }

  async function generateShowNotes() {
    if (!episode || !transcript) return;
    // Guard against a second click while the AI is still working.
    if (generatingNotes) return;

    setGeneratingNotes(true);
    setNotesMessage("");

    const transcriptText = transcript.segments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n");

    try {
      const response = await fetch("/api/ai/show-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcriptText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Show notes generation failed.");
      }

      const created = await createShowNote({
        episodeId: episode.id,
        title: episode.title,
        summary: data.showNotes,
        bulletPoints: [],
      });

      setShowNote(created);

      await createAsset({
        episodeId: episode.id,
        name: "AI Show Notes",
        type: "show-notes",
        fileName: "ai-show-notes.md",
        fileSize: JSON.stringify(created).length,
        mimeType: "text/markdown",
        url: "#",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotesMessage(`Could not generate show notes: ${msg}`);
    } finally {
      setGeneratingNotes(false);
    }
  }

  // Open the editor: copy the saved note into the draft fields. Bullet points
  // are shown one per line so they're easy to edit in a plain textarea.
  function startEditingNotes() {
    if (!showNote) return;
    setDraftNoteTitle(showNote.title);
    setDraftNoteSummary(showNote.summary);
    setDraftNoteBullets(showNote.bulletPoints.join("\n"));
    setNotesMessage("");
    setEditingNotes(true);
  }

  function cancelEditingNotes() {
    setEditingNotes(false);
    setNotesMessage("");
  }

  async function saveShowNoteEdits() {
    if (!showNote) return;

    setSavingNotes(true);
    setNotesMessage("");

    // Turn the textarea (one bullet per line) back into a clean array,
    // dropping blank lines.
    const bulletPoints = draftNoteBullets
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    try {
      const saved = await updateShowNote({
        id: showNote.id,
        title: draftNoteTitle.trim() || showNote.title,
        summary: draftNoteSummary,
        bulletPoints,
      });

      setShowNote(saved);
      setEditingNotes(false);
      setNotesMessage("Show notes saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotesMessage(`Could not save show notes: ${msg}`);
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveTranscript() {
    if (!transcript) return;
    if (savingTranscript) return;

    setSavingTranscript(true);
    setSaveMessage("");

    try {
      const saved = await updateTranscript({
        id: transcript.id,
        segments: transcript.segments,
      });

      setTranscript(saved);
      // Note: saving the transcript no longer auto-regenerates show notes.
      // Generating notes is its own explicit action in the Show Notes
      // section, so saving an edit stays fast and predictable.
      setSaveMessage("Transcript saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveMessage(`Could not save transcript: ${msg}`);
    } finally {
      setSavingTranscript(false);
    }
  }

  async function generateEpisodeDescription() {
    if (!transcript) return;

    const content = transcript.segments
      .map((segment) => segment.text)
      .join("\n");

    const response = await fetch(
      "/api/ai/episode-description",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
        }),
      }
    );

    const data = await response.json();

    setEpisodeDescription(data.description);

    if (episode) {
      await createAsset({
        episodeId: episode.id,
        name: "AI Episode Description",
        type: "episode-description",
        fileName: "episode-description.md",
        fileSize: data.description.length,
        mimeType: "text/markdown",
        url: "#",
      });
    }
  }

  async function generatePublishPackage() {
    if (!transcript || !showNote || !episode) return;

    const transcriptText = transcript.segments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n");

    const response = await fetch("/api/ai/publish-package", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript: transcriptText,
        showNotes: showNote.summary,
      }),
    });

    const data = await response.json();

    setPublishPackage(data.publishPackage);

    await createAsset({
      episodeId: episode.id,
      name: "AI Publish Package",
      type: "publish-package",
      fileName: "publish-package.md",
      fileSize: data.publishPackage.length,
      mimeType: "text/markdown",
      url: "#",
    });

    setPublishMessage(
      "Publish package generated successfully."
    );
  }

  // #27 Generate shareable highlight moments from the transcript.
  async function generateHighlights() {
    if (!transcript || generatingHighlights) return;

    setGeneratingHighlights(true);
    setHighlightsMessage("");

    // Include timing so the model can attach an approximate timestamp to each
    // highlight, e.g. "[12s] Alex: ...".
    const timedTranscript = transcript.segments
      .map(
        (segment) =>
          `[${Math.round(segment.startTime)}s] ${segment.speaker}: ${segment.text}`
      )
      .join("\n");

    try {
      const response = await fetch("/api/ai/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: timedTranscript }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Highlight generation failed.");
      }

      setHighlights(data.highlights || []);

      if ((data.highlights || []).length === 0) {
        setHighlightsMessage("No highlights were found. Try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHighlightsMessage(`Could not generate highlights: ${msg}`);
    } finally {
      setGeneratingHighlights(false);
    }
  }

  // #28 Generate platform-specific social posts.
  async function generateSocialPosts() {
    if (!transcript || generatingSocial) return;

    setGeneratingSocial(true);
    setSocialMessage("");

    const transcriptText = transcript.segments
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join("\n");

    try {
      const response = await fetch("/api/ai/social-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          showNotes: showNote?.summary || "",
          episodeTitle: episode?.title || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Social post generation failed.");
      }

      setSocialPosts(data.posts || []);

      if ((data.posts || []).length === 0) {
        setSocialMessage("No posts were generated. Try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSocialMessage(`Could not generate social posts: ${msg}`);
    } finally {
      setGeneratingSocial(false);
    }
  }

  // #31 Generate chapter markers from the timed transcript, then persist them
  // on the episode so the RSS feed can embed them.
  async function generateChapters() {
    if (!transcript || !episode || generatingChapters) return;

    setGeneratingChapters(true);
    setChaptersMessage("");

    const timedTranscript = transcript.segments
      .map(
        (segment) =>
          `[${Math.round(segment.startTime)}s] ${segment.speaker}: ${segment.text}`
      )
      .join("\n");

    try {
      const response = await fetch("/api/ai/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: timedTranscript }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Chapter generation failed.");
      }

      const generated = data.chapters || [];
      setChapters(generated);

      if (generated.length === 0) {
        setChaptersMessage("No chapters were generated. Try again.");
      } else {
        // Persist the chapters on the episode so the public feed can use them.
        const saveResponse = await fetch(`/api/episodes/${episode.id}/chapters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapters: generated }),
        });

        if (saveResponse.ok) {
          setChaptersMessage("Chapters generated and saved.");
        } else {
          setChaptersMessage(
            "Chapters generated, but saving to the episode failed."
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setChaptersMessage(`Could not generate chapters: ${msg}`);
    } finally {
      setGeneratingChapters(false);
    }
  }

  // Format seconds as m:ss (e.g. 270 -> "4:30") for display.
  function formatTimestamp(totalSeconds: number) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  }

  async function generateCoverArt() {
    if (!episode) return;
    // Guard against a double-click while the image is still generating.
    if (generatingArtwork) return;

    setGeneratingArtwork(true);
    setArtworkMessage("Generating artwork with AI...");

    try {
      const prompt =
        coverArtPrompt ||
        `Podcast cover art for an episode titled ${episode.title}`;

      // Step 1: ask the AI for an image. It comes back as a base64 data URL.
      const response = await fetch("/api/ai/cover-art", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        setArtworkMessage(
          data.error || "Could not generate artwork. Please try again."
        );
        return;
      }

      setArtworkMessage("Saving artwork to storage...");

      // Step 2: hand the base64 image to our route, which saves it as a real
      // file in the public bucket, attaches it to the episode, and returns a
      // permanent public URL.
      const saveResponse = await fetch(
        `/api/episodes/${episode.id}/cover-art`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ base64: data.imageUrl }),
        }
      );

      const saved = await saveResponse.json();

      if (!saveResponse.ok || !saved.url) {
        setArtworkMessage(
          saved.error || "Could not save artwork. Please try again."
        );
        return;
      }

      // Step 3: show the permanent image and record it as an asset.
      setCoverArtUrl(saved.url);

      await createAsset({
        episodeId: episode.id,
        name: "AI Cover Art",
        type: "artwork",
        fileName: "cover-art.png",
        fileSize: 0,
        mimeType: "image/png",
        url: saved.url,
      });

      setArtworkMessage("Artwork saved and attached to this episode.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setArtworkMessage(`Something went wrong: ${message}`);
    } finally {
      setGeneratingArtwork(false);
    }
  }

  async function uploadCoverArt(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!episode) return;

    const file = event.target.files?.[0];

    if (!file) return;

    setGeneratingArtwork(true);
    setArtworkMessage("Uploading artwork...");

    try {
      // Send the raw file to the same route the AI flow uses, so uploads also
      // land as permanent public files (not expiring signed URLs).
      const formData = new FormData();
      formData.append("file", file);

      const saveResponse = await fetch(
        `/api/episodes/${episode.id}/cover-art`,
        {
          method: "POST",
          body: formData,
        }
      );

      const saved = await saveResponse.json();

      if (!saveResponse.ok || !saved.url) {
        setArtworkMessage(
          saved.error || "Could not upload artwork. Please try again."
        );
        return;
      }

      setCoverArtUrl(saved.url);

      await createAsset({
        episodeId: episode.id,
        name: "Cover Art",
        type: "artwork",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        url: saved.url,
      });

      setArtworkMessage("Artwork uploaded and attached to this episode.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setArtworkMessage(`Something went wrong: ${message}`);
    } finally {
      setGeneratingArtwork(false);
    }
  }

  // Build the combined intro -> episode -> outro MP3 in the browser and show a
  // preview. Nothing is uploaded here — the user reviews it first.
  async function applyMusic() {
    if (processingMusic) return;
    if (!recordingAsset?.url) {
      setMusicMessage(
        "No episode recording found to add music to. Add a recording first."
      );
      return;
    }
    if (!introFile && !outroFile) {
      setMusicMessage("Choose an intro and/or outro clip first.");
      return;
    }

    setProcessingMusic(true);
    setMusicMessage("Loading audio engine…");
    // Release any previous preview URL before making a new one.
    if (combinedUrl) URL.revokeObjectURL(combinedUrl);
    setCombinedUrl("");
    setCombinedBlob(null);

    try {
      const blob = await addIntroOutro(
        {
          episode: recordingAsset.url,
          intro: introFile,
          outro: outroFile,
          crossfadeSeconds: crossfadeEnabled ? crossfadeSeconds : 0,
          onProgress: (message) => setMusicMessage(message),
        }
      );

      const url = URL.createObjectURL(blob);
      setCombinedBlob(blob);
      setCombinedUrl(url);
      setMusicMessage("Preview ready. Save it to attach it to this episode.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMusicMessage(`Could not combine audio: ${msg}`);
    } finally {
      setProcessingMusic(false);
    }
  }

  // Upload the combined MP3 as a NEW recording + asset. The original recording
  // row/file is left untouched, so the action is fully reversible.
  async function saveMusic() {
    if (!episode || !combinedBlob || savingMusic) return;

    setSavingMusic(true);
    setMusicMessage("Saving combined episode…");

    try {
      const file = new File(
        [combinedBlob],
        `episode-with-music-${Date.now()}.mp3`,
        { type: "audio/mpeg" }
      );

      const uploaded = await uploadFileToStorage(
        file,
        `episodes/${episode.id}/recordings`
      );

      await createRecording({
        episodeId: episode.id,
        name: `With intro/outro ${new Date().toLocaleTimeString()}`,
        duration: 0,
        audioUrl: uploaded.url,
      });

      await createAsset({
        episodeId: episode.id,
        name: "Episode with intro/outro",
        type: "recording",
        fileName: file.name,
        fileSize: file.size,
        mimeType: "audio/mpeg",
        url: uploaded.url,
      });

      setMusicMessage(
        "Saved as a new recording. Your original recording is untouched."
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMusicMessage(`Could not save combined episode: ${msg}`);
    } finally {
      setSavingMusic(false);
    }
  }

  return (
    <AppShell>
      {loading ? (
        <p>Loading editor...</p>
      ) : !episode ? (
        <p>Episode not found.</p>
      ) : (
        <>
          <EpisodeNavigation episodeId={episode.id} />

          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  SoundStage Live Studio
                </p>

                <h1 className="mt-2 text-4xl font-bold">
                  Editor: {episode.title}
                </h1>

                <p className="mt-3 text-white/80">
                  Show: {episode.show}
                </p>
              </div>

              <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                {episode.status}
              </span>
            </div>
          </div>

          <EpisodeMetaManager episodeId={episode.id} />
<div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow">
  <h2 className="text-lg font-bold text-slate-900">
    Episode Progress
  </h2>

  <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
  <div className="rounded-xl bg-blue-50 p-3 text-center">
    <p className="text-sm font-semibold text-blue-700">
      ✓ Recording
    </p>
  </div>

  <div className="rounded-xl bg-blue-50 p-3 text-center">
    <p className="text-sm font-semibold text-blue-700">
      {transcript ? "✓ Transcript" : "○ Transcript"}
    </p>
  </div>

  <div className="rounded-xl bg-purple-50 p-3 text-center">
    <p className="text-sm font-semibold text-purple-700">
      {showNote ? "✓ Show Notes" : "○ Show Notes"}
    </p>
  </div>

  <div className="rounded-xl bg-emerald-50 p-3 text-center">
    <p className="text-sm font-semibold text-emerald-700">
      {episodeDescription ? "✓ Description" : "○ Description"}
    </p>
  </div>

  <div className="rounded-xl bg-orange-50 p-3 text-center">
    <p className="text-sm font-semibold text-orange-700">
      {publishPackage ? "✓ Publish" : "○ Publish"}
    </p>
  </div>

  <div className="rounded-xl bg-pink-50 p-3 text-center">
    <p className="text-sm font-semibold text-pink-700">
      {coverArtUrl ? "✓ Cover Art" : "○ Cover Art"}
    </p>
  </div>
</div>
  </div>

          <div className="mt-8 rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  AI Editing
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Transcript
                </h2>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                Speech to Text
              </span>
            </div>

            {!transcript ? (
              <>
                <p className="mt-4 text-slate-600">
                  Generate an AI transcript from the saved recording. This can
                  take a bit while the AI listens to the full recording.
                </p>

                <button
                  onClick={generateTranscript}
                  disabled={generating}
                  className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {generating
                    ? "Transcribing recording..."
                    : "Generate AI Transcript"}
                </button>

                {transcriptMessage && (
                  <p className="mt-4 text-sm font-semibold text-red-600">
                    {transcriptMessage}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-6 space-y-6">
                {transcript.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="rounded-lg border border-blue-100 bg-white p-4"
                  >
                    <p className="font-semibold">
                      {segment.speaker}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {segment.startTime}s - {segment.endTime}s
                    </p>

                    <textarea
                      value={segment.text}
                      onChange={(event) => {
                        const updatedSegments =
                          transcript.segments.map((item) =>
                            item.id === segment.id
                              ? {
                                  ...item,
                                  text: event.target.value,
                                }
                              : item
                          );

                        setTranscript({
                          ...transcript,
                          segments: updatedSegments,
                        });
                      }}
                      className="mt-3 w-full rounded-lg border border-slate-200 p-3"
                      rows={4}
                    />

                    <button
                      onClick={saveTranscript}
                      disabled={savingTranscript}
                      className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
                    >
                      {savingTranscript ? "Saving..." : "Save Transcript"}
                    </button>

                    {saveMessage && (
                      <p
                        className={
                          saveMessage.startsWith("Could not")
                            ? "mt-3 text-sm font-semibold text-red-600"
                            : "mt-3 text-sm font-semibold text-green-600"
                        }
                      >
                        {saveMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-purple-200 bg-gradient-to-br from-white to-purple-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
                  AI Content
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Show Notes
                </h2>
              </div>

              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                Summary Generated
              </span>
            </div>

            {!showNote ? (
              <>
                <p className="mt-4 text-slate-600">
                  Generate show notes from this episode. This can take several
                  seconds while the AI reads the transcript.
                </p>

                <button
                  onClick={generateShowNotes}
                  disabled={generatingNotes}
                  className="mt-6 rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {generatingNotes
                    ? "Generating show notes..."
                    : "Generate Show Notes"}
                </button>

                {notesMessage && (
                  <p className="mt-4 text-sm font-semibold text-red-600">
                    {notesMessage}
                  </p>
                )}
              </>
            ) : editingNotes ? (
              <div className="mt-6 space-y-4 rounded-lg border border-purple-100 bg-white p-4">
                <div>
                  <label
                    htmlFor="note-title"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Title
                  </label>
                  <input
                    id="note-title"
                    type="text"
                    value={draftNoteTitle}
                    onChange={(e) => setDraftNoteTitle(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="note-summary"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Summary
                  </label>
                  <textarea
                    id="note-summary"
                    value={draftNoteSummary}
                    onChange={(e) => setDraftNoteSummary(e.target.value)}
                    rows={8}
                    className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="note-bullets"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Key points
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    One point per line.
                  </p>
                  <textarea
                    id="note-bullets"
                    value={draftNoteBullets}
                    onChange={(e) => setDraftNoteBullets(e.target.value)}
                    rows={5}
                    placeholder={"First key point\nSecond key point"}
                    className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={saveShowNoteEdits}
                    disabled={savingNotes}
                    className="rounded-lg bg-purple-600 px-5 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    {savingNotes ? "Saving..." : "Save Show Notes"}
                  </button>
                  <button
                    onClick={cancelEditingNotes}
                    disabled={savingNotes}
                    className="rounded-lg border border-slate-300 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>

                {notesMessage && (
                  <p
                    className={
                      notesMessage.startsWith("Could not")
                        ? "text-sm font-semibold text-red-600"
                        : "text-sm font-semibold text-green-600"
                    }
                  >
                    {notesMessage}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-purple-100 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-bold">{showNote.title}</h3>
                  <button
                    onClick={startEditingNotes}
                    className="shrink-0 rounded-lg border border-purple-300 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-50"
                  >
                    Edit
                  </button>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-slate-600">
                  {showNote.summary}
                </p>

                {showNote.bulletPoints.length > 0 && (
                  <ul className="mt-4 list-disc space-y-2 pl-6">
                    {showNote.bulletPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}

                {notesMessage && (
                  <p
                    className={
                      notesMessage.startsWith("Could not")
                        ? "mt-3 text-sm font-semibold text-red-600"
                        : "mt-3 text-sm font-semibold text-green-600"
                    }
                  >
                    {notesMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                  AI Writing
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Episode Description
                </h2>
              </div>

              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                Publishing Copy
              </span>
            </div>

            <button
              onClick={generateEpisodeDescription}
              className="mt-4 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white"
            >
              Generate Episode Description
            </button>

            {episodeDescription && (
              <div className="mt-6 rounded-lg border border-emerald-100 bg-white p-4">
                <p>{episodeDescription}</p>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-orange-200 bg-gradient-to-br from-white to-orange-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                  Distribution
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Publish Package
                </h2>
              </div>

              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                Marketing Assets
              </span>
            </div>

            <button
              onClick={generatePublishPackage}
              className="mt-4 rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white"
            >
              Generate Publish Package
            </button>

            {publishMessage && (
              <p className="mt-4 text-sm font-semibold text-green-600">
                {publishMessage}
              </p>
            )}

            {publishPackage && (
              <>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(publishPackage);
                    setCopyMessage(
                      "Publish package copied successfully."
                    );
                  }}
                  className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Copy Publish Package
                </button>

                {copyMessage && (
                  <p className="mt-4 text-sm font-semibold text-green-600">
                    {copyMessage}
                  </p>
                )}

                <div className="mt-6 rounded-lg border border-orange-100 bg-white p-4 whitespace-pre-wrap">
                  {publishPackage}
                </div>
              </>
            )}
          </div>

          {/* #27 AI Highlights */}
          <div className="mt-8 rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
                  AI Toolkit
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Highlights
                </h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                Shareable Moments
              </span>
            </div>

            <p className="mt-2 text-slate-600">
              Pull the most memorable, clip-worthy moments out of the
              transcript.
            </p>

            <button
              onClick={generateHighlights}
              disabled={!transcript || generatingHighlights}
              className="mt-4 rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {generatingHighlights ? "Finding highlights..." : "Generate Highlights"}
            </button>

            {highlightsMessage && (
              <p className="mt-4 text-sm font-semibold text-slate-600">
                {highlightsMessage}
              </p>
            )}

            {highlights.length > 0 && (
              <div className="mt-6 space-y-4">
                {highlights.map((h, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-amber-100 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-amber-700">
                      {formatTimestamp(h.timestamp)}
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      “{h.quote}”
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{h.reason}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(h.quote);
                        setHighlightsMessage("Highlight copied.");
                      }}
                      className="mt-3 rounded-lg bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"
                    >
                      Copy quote
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* #28 AI Social Posts */}
          <div className="mt-8 rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                  AI Toolkit
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Social Posts
                </h2>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">
                Promotion
              </span>
            </div>

            <p className="mt-2 text-slate-600">
              Generate ready-to-post captions tuned for each platform.
            </p>

            <button
              onClick={generateSocialPosts}
              disabled={!transcript || generatingSocial}
              className="mt-4 rounded-lg bg-sky-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {generatingSocial ? "Writing posts..." : "Generate Social Posts"}
            </button>

            {socialMessage && (
              <p className="mt-4 text-sm font-semibold text-slate-600">
                {socialMessage}
              </p>
            )}

            {socialPosts.length > 0 && (
              <div className="mt-6 space-y-4">
                {socialPosts.map((post, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-sky-100 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-sky-700">
                        {post.platform}
                      </p>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(post.content);
                          setSocialMessage(`${post.platform} post copied.`);
                        }}
                        className="rounded-lg bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-slate-800">
                      {post.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* #31 AI Chapters */}
          <div className="mt-8 rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">
                  AI Toolkit
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Chapters
                </h2>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">
                Feed Navigation
              </span>
            </div>

            <p className="mt-2 text-slate-600">
              Split the episode into chapters. Saved chapters appear in your RSS
              feed so podcast apps can show clickable navigation.
            </p>

            <button
              onClick={generateChapters}
              disabled={!transcript || generatingChapters}
              className="mt-4 rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {generatingChapters ? "Building chapters..." : "Generate Chapters"}
            </button>

            {chaptersMessage && (
              <p className="mt-4 text-sm font-semibold text-slate-600">
                {chaptersMessage}
              </p>
            )}

            {chapters.length > 0 && (
              <ol className="mt-6 space-y-2">
                {chapters.map((chapter, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 rounded-lg border border-violet-100 bg-white p-3"
                  >
                    <span className="rounded bg-violet-100 px-2 py-1 text-sm font-mono font-semibold text-violet-800">
                      {formatTimestamp(chapter.startTime)}
                    </span>
                    <span className="font-medium text-slate-900">
                      {chapter.title}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-pink-200 bg-gradient-to-br from-white to-pink-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-pink-600">
                  AI Artwork
                </p>

                <h2 className="text-2xl font-bold text-slate-900">
                  Cover Art Studio
                </h2>
              </div>

              <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700">
                Image Generation
              </span>
            </div>

            <input
              type="text"
              value={coverArtPrompt}
              onChange={(event) =>
                setCoverArtPrompt(event.target.value)
              }
              placeholder="Describe the cover art..."
              className="mt-4 w-full rounded-lg border border-slate-200 p-3"
            />
<input
  type="file"
  accept="image/png,image/jpeg,image/webp"
  onChange={uploadCoverArt}
  disabled={generatingArtwork}
  className="mt-4 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-60"
/>
            <button
              onClick={generateCoverArt}
              disabled={generatingArtwork}
              className="mt-4 rounded-lg bg-pink-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {generatingArtwork ? "Working..." : "Generate Cover Art"}
            </button>

            {artworkMessage && (
              <p className="mt-3 text-sm text-slate-600">
                {artworkMessage}
              </p>
            )}

            {coverArtUrl && (
              <>
                <img
                  src={coverArtUrl}
                  alt="Generated Cover Art"
                  className="mt-6 rounded-xl border border-pink-200 shadow"
                />

                <a
                  href={coverArtUrl}
                  download="cover-art.png"
                  className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Download Cover Art
                </a>
              </>
            )}
          </div>

          {/* Intro / Outro Music */}
          <div className="mt-8 rounded-2xl border border-teal-200 bg-gradient-to-br from-white to-teal-50 p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                  Audio Production
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Intro / Outro Music
                </h2>
              </div>
              <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-700">
                Client-side
              </span>
            </div>

            {plan === null ? (
              <p className="mt-2 text-sm text-slate-500">Checking your plan…</p>
            ) : plan === "free" ? (
              // Locked state for free users — mirrors the AI Studio gate.
              <div className="mt-4 rounded-xl border border-teal-200 bg-white p-6">
                <p className="text-lg font-bold text-slate-900">
                  🔒 Add branded intro &amp; outro music
                </p>
                <p className="mt-2 text-slate-600">
                  Top and tail every episode with your own intro and outro,
                  optionally crossfaded — all processed privately in your
                  browser. Available on the Creator and Studio plans.
                </p>
                <a
                  href="/pricing"
                  className="mt-4 inline-block rounded-lg border border-teal-300 px-5 py-3 font-semibold text-teal-700 hover:bg-teal-50"
                >
                  Upgrade to unlock
                </a>
              </div>
            ) : (
              <>
                <p className="mt-2 text-slate-600">
                  Upload a short intro and/or outro clip. We combine intro →
                  episode → outro into one MP3, right here in your browser. Your
                  original recording is kept — the result is saved as a new
                  recording.
                </p>

                {!recordingAsset?.url && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                    No episode recording found yet. Add a recording before
                    combining music.
                  </p>
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Intro clip
                    </label>
                    <input
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4"
                      onChange={(e) =>
                        setIntroFile(e.target.files?.[0] ?? null)
                      }
                      disabled={processingMusic}
                      className="mt-2 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800">
                      Outro clip
                    </label>
                    <input
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4"
                      onChange={(e) =>
                        setOutroFile(e.target.files?.[0] ?? null)
                      }
                      disabled={processingMusic}
                      className="mt-2 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={crossfadeEnabled}
                      onChange={(e) => setCrossfadeEnabled(e.target.checked)}
                      disabled={processingMusic}
                    />
                    Crossfade between segments
                  </label>

                  {crossfadeEnabled && (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      Seconds:
                      <input
                        type="number"
                        min={0}
                        max={3}
                        step={0.5}
                        value={crossfadeSeconds}
                        onChange={(e) =>
                          setCrossfadeSeconds(
                            Math.min(3, Math.max(0, Number(e.target.value) || 0))
                          )
                        }
                        disabled={processingMusic}
                        className="w-20 rounded-lg border border-slate-200 p-2"
                      />
                    </label>
                  )}
                </div>

                <button
                  onClick={applyMusic}
                  disabled={
                    processingMusic ||
                    !recordingAsset?.url ||
                    (!introFile && !outroFile)
                  }
                  className="mt-6 rounded-lg bg-teal-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {processingMusic ? "Processing…" : "Apply music"}
                </button>

                {musicMessage && (
                  <p
                    className={
                      musicMessage.startsWith("Could not") ||
                      musicMessage.startsWith("No ")
                        ? "mt-4 text-sm font-semibold text-red-600"
                        : "mt-4 text-sm font-semibold text-slate-600"
                    }
                  >
                    {musicMessage}
                  </p>
                )}

                {combinedUrl && (
                  <div className="mt-6 rounded-lg border border-teal-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      Preview
                    </p>
                    <audio
                      controls
                      src={combinedUrl}
                      className="mt-3 w-full"
                    />
                    <button
                      onClick={saveMusic}
                      disabled={savingMusic}
                      className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white disabled:opacity-60"
                    >
                      {savingMusic
                        ? "Saving…"
                        : "Save as new recording"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}