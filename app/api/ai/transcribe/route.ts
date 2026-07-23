import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai/client";
import { requireUser } from "@/lib/apiAuth";

/**
 * Transcription route with TWO modes:
 *
 *  - Default (text-only): model `gpt-4o-mini-transcribe`, returns `{ text }`.
 *    Cheap; used for show-notes / social / plain display where timing is not
 *    needed.
 *
 *  - Word-timestamp mode (send form field `words=1` OR `?words=1`): model
 *    `whisper-1` with `response_format: "verbose_json"` and
 *    `timestamp_granularities: ["word", "segment"]`. Returns
 *    `{ text, words: [{ word, start, end }], segments: [{ start, end, text }] }`.
 *    This is what powers Descript-style transcript editing, so we only pay the
 *    higher whisper-1 cost when word timing is actually required.
 *
 * Timings here are PER-CHUNK (relative to the uploaded audio). The client is
 * responsible for offsetting each chunk by the cumulative duration of prior
 * chunks when reassembling a chunked episode (see lib/transcript/offsetWords).
 */
export async function POST(request: Request) {
  const guard = await requireUser(request, "ai-transcribe");
  if (!guard.ok) return guard.response;

  let file: FormDataEntryValue | null;
  let wantWords: boolean;
  try {
    const formData = await request.formData();
    file = formData.get("file");
    const wordsField = formData.get("words");
    const wordsQuery = new URL(request.url).searchParams.get("words");
    wantWords =
      wordsField === "1" ||
      wordsField === "true" ||
      wordsQuery === "1" ||
      wordsQuery === "true";
  } catch {
    // Malformed/absent multipart body — respond with JSON 400 instead of a
    // bare 500 so the client's parser always has JSON to work with.
    return NextResponse.json(
      { message: "Invalid form data" },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "No audio file uploaded" },
      { status: 400 }
    );
  }

  try {
    if (wantWords) {
      const transcription = await getOpenAI().audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
      });

      // The SDK types `verbose_json` loosely; narrow defensively so a missing
      // field can never throw here.
      const verbose = transcription as unknown as {
        text?: string;
        words?: { word: string; start: number; end: number }[];
        segments?: { start: number; end: number; text: string }[];
      };

      return NextResponse.json({
        text: verbose.text ?? "",
        words: (verbose.words ?? []).map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })),
        segments: (verbose.segments ?? []).map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
      });
    }

    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (err) {
    // Never let this route return non-JSON: on any OpenAI/SDK failure, respond
    // with a JSON error so the client's parser always has JSON to work with.
    const message =
      err instanceof Error ? err.message : "Transcription failed.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
